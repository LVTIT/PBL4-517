"""PBL4-517: External Security Scanner & Anomaly Detector (Issue #10).

Chương trình phân tích và giám sát các điểm yếu bảo mật từ bên ngoài:
- Quét nhanh danh sách port TCP bằng đa luồng (ThreadPoolExecutor).
- Thu thập banner và nhận diện phiên bản dịch vụ thực tế (Banner Grabbing).
- Đánh giá mức độ rủi ro an ninh theo chuẩn quốc tế (CVSS & OWASP Top 10 - A05).
- Tự động lưu mốc Baseline và phát hiện cổng mới mở thêm (scanner_state.json).
- Tự động đẩy cảnh báo tức thì tới Discord Webhook và Telegram Group Bot.
- Xuất Báo cáo Kiểm toán An ninh mạng chuyên nghiệp (HTML Dashboard tự chứa).
- Chỉ sử dụng thư viện chuẩn Python (không cần cài thêm package).

Phạm vi cho phép: CHỈ quét localhost hoặc máy chủ AWS EC2 do nhóm sở hữu/được cấp phép.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import json
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


def load_state(state_file: Path) -> dict[str, dict]:
    """Đọc file lịch sử trạng thái scanner."""
    if not state_file.is_file():
        return {}
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(state_file: Path, state_data: dict[str, dict]) -> None:
    """Lưu an toàn trạng thái scanner ra file JSON."""
    try:
        state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(state_file, "w", encoding="utf-8") as f:
            json.dump(state_data, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        print(f"[-] Cảnh báo: Không thể lưu file state ({exc})", file=sys.stderr)


def evaluate_diff_and_notify(
    host_key: str,
    current_open_ports: list[int],
    scan_duration: float,
    state_file: Path,
    banners: dict[int, str | None],
    reset_baseline: bool = False,
    no_alert: bool = False,
    scanned_ports: list[int] | None = None,
) -> str:
    """So sánh với Baseline cũ, phân loại sự kiện và kích hoạt gửi cảnh báo."""
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    state = load_state(state_file)

    host_record = state.get(host_key)
    event_type = "NO_CHANGE"
    new_ports: list[int] = []
    closed_ports: list[int] = []

    if reset_baseline or host_record is None:
        # Lần đầu tiên hoặc yêu cầu reset baseline
        event_type = "INITIAL_SCAN"
        state[host_key] = {
            "last_scan_at": now_str,
            "baseline_open_ports": current_open_ports,
        }
        save_state(state_file, state)
        print(f"\n[+] [EVENT: INITIAL_SCAN] Đã ghi nhận Baseline ban đầu cho {host_key}: {current_open_ports}")
    else:
        prev_open_set = set(host_record.get("baseline_open_ports", []))
        curr_open_set = set(current_open_ports)
        scanned_set = set(scanned_ports) if scanned_ports is not None else (curr_open_set | prev_open_set)

        new_ports = sorted(curr_open_set - prev_open_set)
        # Chỉ đánh dấu closed nếu port đó nằm trong danh sách các port THỰC SỰ ĐƯỢC QUÉT lần này
        closed_ports = sorted((prev_open_set & scanned_set) - curr_open_set)
        updated_open_ports = sorted((prev_open_set - scanned_set) | curr_open_set)

        if new_ports:
            event_type = "NEW_PORT_DETECTED"
            state[host_key] = {
                "last_scan_at": now_str,
                "baseline_open_ports": updated_open_ports,
            }
            save_state(state_file, state)
            print(f"\n[!] [EVENT: NEW_PORT_DETECTED] CẢNH BÁO: Phát hiện cổng mới mở: {new_ports}")
        elif closed_ports:
            event_type = "PORT_CLOSED"
            state[host_key] = {
                "last_scan_at": now_str,
                "baseline_open_ports": updated_open_ports,
            }
            save_state(state_file, state)
            print(f"\n[+] [EVENT: PORT_CLOSED] Cổng đã đóng an toàn: {closed_ports}")
        else:
            event_type = "NO_CHANGE"
            state[host_key]["last_scan_at"] = now_str
            save_state(state_file, state)
            print("\n[*] [EVENT: NO_CHANGE] Không có thay đổi so với Baseline. Không cần gửi alert.")

    # Gửi cảnh báo đa kênh (Discord + Telegram) nếu có sự kiện và không bật --no-alert
    if not no_alert and notify_scan_event is not None and event_type != "NO_CHANGE":
        print(f"[*] Đang gửi thông báo sự kiện '{event_type}' tới Discord & Telegram...")
        res = notify_scan_event(
            event_type=event_type,
            target_host=host_key,
            open_ports=current_open_ports,
            new_ports=new_ports,
            closed_ports=closed_ports,
            scan_duration=scan_duration,
            banners=banners,
        )
        print(f"    - Discord  : {'ĐÃ GỬI' if res.get('discord') else 'BỎ QUA / LỖI'}")
        print(f"    - Telegram : {'ĐÃ GỬI' if res.get('telegram') else 'BỎ QUA / LỖI'}")

    return event_type


def run_single_scan(args: argparse.Namespace, ports: list[int], resolved: str) -> int:
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
            print(f"  {port:>5}/tcp  {mark:<8} [{service_name}]{banner_display} [{risk.severity} - CVSS {risk.cvss_score:.1f}]")
        else:
            service_desc = f" [{service_name}]" if service_name else ""
            print(f"  {port:>5}/tcp  {mark:<8}{service_desc}")

    print("-" * 65)
    posture = calculate_system_posture(open_ports)
    print(f"Thời gian quét : {duration:.2f}s | Cổng đang mở ({len(open_ports)}): {open_ports if open_ports else 'Không có'}")
    print(f"Đánh giá rủi ro : Xếp hạng [{posture['grade']}] - {posture['status']} (Max CVSS: {posture['max_cvss']:.1f})")

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

    return 0


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

    try:
        resolved = socket.gethostbyname(args.host)
    except socket.gaierror:
        print(f"[-] Lỗi: Không thể phân giải DNS/IP cho máy chủ {args.host!r}.", file=sys.stderr)
        return 2

    if args.watch and args.watch > 0:
        print(f"[*] Bắt đầu chế độ Giám sát liên tục (Watch Mode) mỗi {args.watch}s cho mục tiêu: {args.host}")
        print("[*] Nhấn Ctrl + C để dừng giám sát bất kỳ lúc nào.\n")
        try:
            while True:
                run_single_scan(args, ports, resolved)
                # Tắt cờ reset-baseline sau vòng quét đầu tiên trong loop
                args.reset_baseline = False
                print(f"\n[~] Đang chờ {args.watch}s trước lần quét tiếp theo...")
                time.sleep(args.watch)
        except KeyboardInterrupt:
            print("\n[*] Đã dừng chế độ giám sát.")
            return 0
    else:
        return run_single_scan(args, ports, resolved)


if __name__ == "__main__":
    raise SystemExit(main())
