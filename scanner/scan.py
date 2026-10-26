"""PBL4-517: External Security Scanner & Anomaly Detector (Issue #10).

Chương trình phân tích và giám sát các điểm yếu bảo mật từ bên ngoài:
- Quét nhanh danh sách port TCP bằng đa luồng (ThreadPoolExecutor).
- Thu thập banner và nhận diện phiên bản dịch vụ thực tế (Banner Grabbing).
- Đánh giá mức độ rủi ro an ninh theo chuẩn quốc tế (Risk score & OWASP Top 10 - A05).
- Tự động lưu mốc Baseline và phát hiện cổng mới mở thêm (scanner_state.json).
- Tự động đẩy cảnh báo tức thì tới Discord Webhook và Telegram Group Bot.
- Xuất Báo cáo Kiểm toán An ninh mạng chuyên nghiệp (HTML Dashboard tự chứa).
- Chỉ sử dụng thư viện chuẩn Python (không cần cài thêm package).

Phạm vi cho phép: CHỈ quét localhost hoặc máy chủ AWS EC2 do nhóm sở hữu/được cấp phép.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import copy
import datetime
import json
import uuid
import socket
import sys
import time
from pathlib import Path

# Đảm bảo UTF-8 trên Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Thêm thư mục gốc vào sys.path để import module alerts và scanner nếu cần
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from alerts.notifier import KNOWN_SERVICES, notify_scan_event
except ImportError:
    KNOWN_SERVICES = {
        22: "SSH",
        80: "HTTP (Nginx Web)",
        443: "HTTPS (Web TLS)",
        3000: "Express API",
        5432: "PostgreSQL DB",
        8080: "HTTP Alt",
    }
    notify_scan_event = None  # type: ignore

from scanner.state_store import load_state, save_state, state_lock, write_audit
from scanner.prober import grab_banner
from scanner.risk_matrix import assess_port, calculate_system_posture
from scanner.reporter import generate_html_report

DEFAULT_PORTS = (22, 80, 443, 3000, 5432, 8080)
DEFAULT_STATE_FILE = Path(__file__).resolve().parent / "scanner_state.json"


def parse_ports(value: str) -> list[int]:
    """Parse '22,80,3000' hoặc '20-25' thành danh sách port đã sort/khử trùng."""
    ports: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_raw, end_raw = part.split("-", 1)
            start, end = int(start_raw), int(end_raw)
            if not 1 <= start <= end <= 65535:
                raise ValueError(f"Khoảng port không hợp lệ: {part!r}")
            ports.update(range(start, end + 1))
        else:
            port = int(part)
            if not 1 <= port <= 65535:
                raise ValueError(f"Port không hợp lệ: {part!r}")
            ports.add(port)
    if not ports:
        raise ValueError("Danh sách port rỗng.")
    return sorted(ports)


def scan_port(host: str, port: int, timeout: float) -> tuple[int, str]:
    """Trả về (port, 'open' | 'closed' | 'filtered') cho một port TCP."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return port, "open"
    except socket.timeout:
        return port, "filtered"
    except ConnectionRefusedError:
        return port, "closed"
    except OSError:
        # Host không resolve được, network unreachable, firewall drop...
        return port, "filtered"


def scan_ports_parallel(
    host: str,
    ports: list[int],
    timeout: float,
    max_workers: int = 10,
) -> dict[int, str]:
    """Quét đồng thời danh sách port qua ThreadPoolExecutor (tối ưu tốc độ cao)."""
    results: dict[int, str] = {}
    workers = min(max_workers, len(ports)) or 1
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {
            executor.submit(scan_port, host, port, timeout): port
            for port in ports
        }
        for future in concurrent.futures.as_completed(future_map):
            port, status = future.result()
            results[port] = status
    return results


def _deliver_due_alerts(state_file: Path, state: dict, pending: list, now: float, limit: int) -> int:
    if notify_scan_event is None:
        return 0
    due = [event for event in pending if event["next_attempt_at"] <= now][:limit]
    for event in due:
        try:
            result = notify_scan_event(**event["payload"], channels=event["channels"])
        except Exception:
            result = {}
        event["channels"] = [channel for channel in event["channels"] if not result.get(channel)]
        if not event["channels"]:
            pending.remove(event)
        else:
            event["attempts"] += 1
            event["next_attempt_at"] = now + min(300, 2 ** min(event["attempts"], 8) * 5)
        save_state(state_file, state)
    return len(due)


def evaluate_diff_and_notify(
    host_key: str, current_open_ports: list[int], scan_duration: float,
    state_file: Path, banners: dict[int, str | None], reset_baseline: bool = False,
    no_alert: bool = False, scanned_ports: list[int] | None = None,
    port_results: dict[int, str] | None = None,
) -> str:
    """Preserve uncertain observations; persist an alert outbox before delivery."""
    state = load_state(state_file)
    previous = state.get(host_key)
    record = copy.deepcopy(previous or {"baseline_open_ports": [], "baseline_initialized": False})
    pending = record.setdefault("pending_alerts", [])
    now = time.time()
    observed = port_results or {p: ("open" if p in current_open_ports else "closed")
                                for p in (scanned_ports or current_open_ports)}
    current = set(current_open_ports)
    closed = {p for p, status in observed.items() if status == "closed"}
    uncertain = sorted(p for p, status in observed.items() if status not in ("open", "closed"))
    old = set(record["baseline_open_ports"])
    events = []
    initialized = record.get("baseline_initialized", previous is not None)
    if (not initialized or reset_baseline) and (current or closed):
        record["baseline_open_ports"] = sorted(current)
        record["baseline_initialized"] = True
        events.append(("INITIAL_SCAN", [], []))
    elif initialized and not reset_baseline:
        new_ports = sorted(current - old)
        closed_ports = sorted(old & closed)
        record["baseline_open_ports"] = sorted((old - closed) | current)
        if new_ports:
            events.append(("NEW_PORT_DETECTED", new_ports, []))
        if closed_ports:
            events.append(("PORT_CLOSED", [], closed_ports))
    if uncertain != record.get("uncertain_ports", []):
        events.append(("SCAN_UNCERTAIN" if uncertain else "SCAN_RECOVERED", [], []))
    record["uncertain_ports"] = uncertain
    record["last_scan_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    attempted = 0
    if not no_alert:
        channels = configured_alert_channels()
        # Drain a saturated outbox using the OLD baseline before accepting a
        # change. Delivery recovery must remain possible when the queue is full.
        if channels and len(pending) + len(events) > 100 and previous:
            attempted = _deliver_due_alerts(state_file, state, previous.get("pending_alerts", []), now, 2)
            pending = copy.deepcopy(previous.get("pending_alerts", []))
            record["pending_alerts"] = pending
        if channels and len(pending) + len(events) > 100:
            raise RuntimeError("Alert outbox full; delivery retried, stored baseline preserved.")
        for event_type, new_ports, closed_ports in events:
            if not channels:
                continue
            event_id = uuid.uuid4().hex
            pending.append({"id": event_id, "channels": channels,
                "attempts": 0, "next_attempt_at": 0,
                "payload": {"event_type": event_type, "target_host": host_key,
                    "event_id": event_id, "detected_at": record["last_scan_at"],
                    "open_ports": sorted(current), "new_ports": new_ports,
                    "closed_ports": closed_ports, "scan_duration": scan_duration,
                    "banners": banners}})
    state[host_key] = record
    save_state(state_file, state)
    # Retry only failed channels; successful channels are never deliberately resent.
    if not no_alert:
        _deliver_due_alerts(state_file, state, pending, now, 2 - attempted)
    event_type = events[0][0] if events else "NO_CHANGE"
    print(f"[EVENT: {event_type}] uncertain={uncertain}; pending_alerts={len(pending)}")
    return event_type


def configured_alert_channels() -> list[str]:
    from alerts.notifier import get_credentials
    discord, token, chat = get_credentials()
    return (["discord"] if discord else []) + (["telegram"] if token and chat else [])


def run_single_scan(args: argparse.Namespace, ports: list[int], resolved: str) -> int:
    try:
        with state_lock(Path(args.state_file)):
            return _run_single_scan(args, ports, resolved)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"[-] Monitoring failure: {error}", file=sys.stderr)
        try:
            write_audit(Path(args.state_file), target=args.host, event="SCAN_FAILED", exit_status=2)
        except OSError:
            pass
        return 2


def _run_single_scan(args: argparse.Namespace, ports: list[int], resolved: str) -> int:
    """Thực thi một vòng quét duy nhất."""
    start_time = time.time()
    print(f"\n[>] Bắt đầu quét {args.host} ({resolved}): {len(ports)} ports (Đa luồng {args.workers} workers, timeout={args.timeout}s)")
    print("-" * 65)

    results = scan_ports_parallel(
        host=resolved,
        ports=ports,
        timeout=args.timeout,
        max_workers=args.workers,
    )
    duration = time.time() - start_time

    open_ports: list[int] = []
    banners: dict[int, str | None] = {}

    for port in ports:
        status = results.get(port, "filtered")
        mark = "OPEN" if status == "open" else status.upper()
        service_name = KNOWN_SERVICES.get(port, "")

        if status == "open":
            open_ports.append(port)
            # Thu thập banner nếu không tắt cờ --no-banner
            banner = None if args.no_banner else grab_banner(resolved, port, timeout=args.timeout)
            banners[port] = banner
            risk = assess_port(port, banner)

            banner_display = f" » {banner}" if banner else ""
            print(f"  {port:>5}/tcp  {mark:<8} [{service_name}]{banner_display} [{risk.severity} - Risk score {risk.cvss_score:.1f}]")
        else:
            service_desc = f" [{service_name}]" if service_name else ""
            print(f"  {port:>5}/tcp  {mark:<8}{service_desc}")

    print("-" * 65)
    posture = calculate_system_posture(open_ports)
    print(f"Thời gian quét : {duration:.2f}s | Cổng đang mở ({len(open_ports)}): {open_ports if open_ports else 'Không có'}")
    print(f"Đánh giá rủi ro : Xếp hạng [{posture['grade']}] - {posture['status']} (Max Risk score: {posture['max_cvss']:.1f})")

    # Đánh giá thay đổi và gửi cảnh báo
    state_file = Path(args.state_file)
    host_key = f"{args.host}"
    event_type = evaluate_diff_and_notify(
        host_key=host_key,
        current_open_ports=open_ports,
        scan_duration=duration,
        state_file=state_file,
        banners=banners,
        reset_baseline=args.reset_baseline,
        no_alert=args.no_alert,
        scanned_ports=ports,
        port_results=results,
    )

    # Xuất Báo cáo HTML tự chứa (Living Dashboard + Snapshot nếu có sự cố)
    archive_snapshot = bool(args.save_report or event_type in ("NEW_PORT_DETECTED", "PORT_CLOSED"))
    output_html_path = Path(args.html_output) if args.html_output else None

    latest_report = generate_html_report(
        target_host=args.host,
        target_ip=resolved,
        port_results=results,
        banners=banners,
        scan_duration=duration,
        event_type=event_type,
        output_path=output_html_path,
        archive_snapshot=archive_snapshot,
    )
    print(f"[+] Báo cáo HTML (Living Dashboard) đã cập nhật: {latest_report}")
    if archive_snapshot:
        print("[+] Đã lưu snapshot lịch sử sự cố vào thư mục reports/ (tự động lưu tối đa 10 bản gần nhất).")

    record = load_state(state_file).get(args.host, {})
    result = 1 if record.get("uncertain_ports") or record.get("pending_alerts") else 0
    write_audit(state_file, target=args.host, target_ip=resolved, event=event_type, results=results,
                pending_alerts=len(record.get("pending_alerts", [])), exit_status=result)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="PBL4-517 Security Scanner: Dò quét cổng mở, thu thập banner và cảnh báo tự động về Telegram/Discord."
    )
    parser.add_argument("host", help="Địa chỉ IP hoặc tên miền mục tiêu (VD: 127.0.0.1 hoặc Public IP EC2)")
    parser.add_argument(
        "--ports",
        default=",".join(str(p) for p in DEFAULT_PORTS),
        help=f"Danh sách port: '22,80,3000' hoặc khoảng '20-25' (Mặc định: {','.join(str(p) for p in DEFAULT_PORTS)})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=1.0,
        help="Timeout (giây) cho mỗi kết nối port (Mặc định: 1.0)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=10,
        help="Số luồng quét song song đồng thời (Mặc định: 10)",
    )
    parser.add_argument(
        "--state-file",
        default=str(DEFAULT_STATE_FILE),
        help=f"Đường dẫn file lưu Baseline trạng thái (Mặc định: {DEFAULT_STATE_FILE.name})",
    )
    parser.add_argument(
        "--reset-baseline",
        action="store_true",
        help="Xóa mốc Baseline cũ của host này và ghi nhận kết quả hiện tại làm Baseline mới",
    )
    parser.add_argument(
        "--no-alert",
        action="store_true",
        help="Chỉ quét in kết quả console, không gửi cảnh báo tới Discord/Telegram",
    )
    parser.add_argument(
        "--no-banner",
        action="store_true",
        help="Bỏ qua bước thu thập banner phiên bản dịch vụ",
    )
    parser.add_argument(
        "--save-report",
        action="store_true",
        help="Lưu thêm một bản snapshot lịch sử HTML ngoài file latest.html",
    )
    parser.add_argument(
        "--html-output",
        help="Tùy chỉnh đường dẫn file HTML xuất ra (Mặc định: scanner/reports/latest.html)",
    )
    parser.add_argument(
        "--watch",
        type=int,
        metavar="SECONDS",
        help="Chế độ giám sát liên tục (Daemon mode): Tự động quét lặp lại sau mỗi SECONDS giây",
    )

    args = parser.parse_args(argv)

    if args.timeout <= 0:
        print("[-] Lỗi: --timeout phải lớn hơn 0.", file=sys.stderr)
        return 2
    if args.workers <= 0:
        print("[-] Lỗi: --workers phải lớn hơn 0.", file=sys.stderr)
        return 2

    try:
        ports = parse_ports(args.ports)
    except ValueError as exc:
        print(f"[-] Lỗi danh sách port: {exc}", file=sys.stderr)
        return 2

    def resolve_and_scan():
        try:
            resolved = socket.gethostbyname(args.host)
        except socket.gaierror:
            print("[-] SCAN_FAILED: DNS resolution failed; baseline preserved.", file=sys.stderr)
            try:
                write_audit(Path(args.state_file), target=args.host, event="DNS_FAILED", exit_status=2)
            except OSError:
                pass
            return 2
        return run_single_scan(args, ports, resolved)

    if args.watch and args.watch > 0:
        try:
            while True:
                status = resolve_and_scan()
                if status != 2:
                    args.reset_baseline = False
                time.sleep(args.watch)
        except KeyboardInterrupt:
            return 0
    return resolve_and_scan()


if __name__ == "__main__":
    raise SystemExit(main())
