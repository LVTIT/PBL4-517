"""Self-contained HTML and Markdown reports from one scanner observation."""

from __future__ import annotations

from collections import Counter
import datetime
from html import escape
from pathlib import Path

from alerts.notifier import KNOWN_SERVICES
from scanner.config import reports_dir
from scanner.risk_matrix import assess_port
from scanner.scan_result import ScanEvent, ScanResult

REPORTS_DIR: Path | None = None
MAX_ARCHIVED_REPORTS = 10
REPORT_STYLE = Path(__file__).with_name("report.css").read_text(encoding="utf-8")
PORT_STATES = {"open": "Mở", "closed": "Đóng", "filtered": "Chưa xác định"}
EVENTS = {
    "INITIAL_SCAN": "Đã lưu baseline",
    "NEW_PORT_DETECTED": "Phát hiện cổng mới",
    "PORT_CLOSED": "Đã xác nhận đóng cổng",
    "SCAN_UNCERTAIN": "Kết quả quét chưa đầy đủ",
    "SCAN_RECOVERED": "Lần quét này đã có đủ trạng thái",
    "NO_CHANGE": "Không có thay đổi đã xác nhận",
    "MANUAL_SCAN": "Kết quả quét TCP",
}
LIMITS = (
    "Trạng thái cổng phản ánh kết nối từ máy quét vào thời điểm ghi nhận.",
    "Chưa xác định (timeout/filtered) nghĩa là phép đo chưa xác nhận được cổng mở hay đóng.",
    "Tên dịch vụ trong bảng là gợi ý theo số cổng. Chi tiết có banner nếu đã thu thập.",
    "Đây không phải kiểm thử toàn diện ứng dụng, TLS hay quyền truy cập.",
    "Không đưa báo cáo này lên Internet nếu có thông tin hạ tầng nhạy cảm.",
)


def ensure_reports_dir() -> Path:
    directory = REPORTS_DIR if REPORTS_DIR is not None else reports_dir()
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def clean_old_reports(directory: Path, max_keep: int = MAX_ARCHIVED_REPORTS) -> None:
    try:
        snapshots = sorted((file for file in directory.glob("audit_*.html") if file.is_file()),
                           key=lambda file: file.stat().st_mtime, reverse=True)
    except OSError:
        return
    for snapshot in snapshots[max_keep:]:
        try:
            snapshot.unlink()
        except OSError:
            pass


def _time_text(moment: datetime.datetime) -> str:
    return moment.astimezone().isoformat(sep=" ", timespec="seconds")


def _port_summary(ports: tuple[int, ...]) -> str:
    labels = ", ".join(f"{port}/tcp" for port in ports[:4])
    return f"{labels} và {len(ports) - 4} cổng khác" if len(ports) > 4 else labels


def _event_ports(events: tuple[ScanEvent, ...], event_type: str) -> tuple[int, ...]:
    return tuple(port for event in events if event.event_type == event_type for port in event.ports)


def _page(
    title: str, target_host: str, target_ip: str, moment: datetime.datetime, body: str,
    scan_duration: float | None = None,
) -> str:
    host = escape(target_host)
    ip = f" ({escape(target_ip)})" if target_ip and target_ip != target_host else ""
    duration = (
        f"<div><dt>Phép đo</dt><dd>Nmap TCP Connect · {scan_duration:.2f} giây</dd></div>"
        if scan_duration is not None else ""
    )
    return f"""<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} — {host}</title>
  <style>{REPORT_STYLE}</style>
</head>
<body>
  <main>
    <header>
      <div class="heading">
        <h1>{escape(title)}</h1>
        <button type="button" onclick="window.print()">In / Lưu PDF</button>
      </div>
      <dl class="metadata">
        <div><dt>Mục tiêu</dt><dd><code>{host}</code>{ip}</dd></div>
        <div><dt>Thời điểm</dt><dd><time datetime="{moment.isoformat()}">{_time_text(moment)}</time></dd></div>
        {duration}
      </dl>
    </header>
    {body}
  </main>
</body>
</html>
"""


def _port_table(port_results: dict[int, str], new_ports: tuple[int, ...], closed_ports: tuple[int, ...]) -> str:
    new, closed = set(new_ports), set(closed_ports)
    rows = []
    for port, state in sorted(port_results.items()):
        service = KNOWN_SERVICES.get(port, "—") if state == "open" else "—"
        if port in new:
            note = "Mới mở"
        elif port in closed:
            note = "Vừa đóng"
        else:
            note = "—"
        rows.append(
            f'<tr><th scope="row"><code>{port}/tcp</code></th>'
            f'<td><span class="state {state}">{PORT_STATES[state]}</span></td>'
            f'<td>{escape(service)}</td><td>{note}</td></tr>'
        )
    return f"""<section aria-labelledby="ports-title">
      <h2 id="ports-title">Kết quả theo cổng</h2>
      <table>
        <colgroup><col class="port-col"><col class="state-col"><col><col class="note-col"></colgroup>
        <thead><tr><th scope="col">Cổng</th><th scope="col">Trạng thái</th>
          <th scope="col">Dịch vụ</th><th scope="col">Ghi chú</th></tr></thead>
        <tbody>{"".join(rows)}</tbody>
      </table>
    </section>"""


def _open_port_details(port_results: dict[int, str], banners: dict[int, str | None]) -> str:
    items = []
    for port, state in sorted(port_results.items()):
        if state != "open":
            continue
        banner = banners.get(port)
        profile = assess_port(port, banner)
        banner_html = f"<p>Banner <code>{escape(banner)}</code></p>" if banner else ""
        items.append(
            f"<li><strong>{port}/tcp</strong> · {escape(profile.severity)} · "
            f"Điểm tham khảo {profile.cvss_score:.1f}/10{banner_html}"
            f"<p>{escape(profile.impact)}</p><p>{escape(profile.recommendation)}</p></li>"
        )
    return f'<details><summary>Chi tiết cổng mở</summary><ul>{"".join(items)}</ul></details>' if items else ""


def _markdown_value(value: str) -> str:
    return escape(value, quote=False).replace("|", r"\|").replace("`", "&#96;").replace("\n", " ").replace("\r", "")


def _markdown_report(
    target_host: str, target_ip: str, moment: datetime.datetime, scan_duration: float,
    event_type: str, events: tuple[ScanEvent, ...], port_results: dict[int, str],
    banners: dict[int, str | None],
) -> str:
    lines = [
        "# Báo cáo quét cổng", "",
        f"- Mục tiêu **{_markdown_value(target_host)}** (`{_markdown_value(target_ip)}`)",
        f"- Thời điểm {_time_text(moment)}",
        f"- Phép đo Nmap TCP Connect · {scan_duration:.2f} giây",
        f"- Sự kiện `{event_type}`",
    ]
    for event in events:
        ports = f" · {_port_summary(event.ports)}" if event.ports else ""
        lines.append(f"- {EVENTS[event.event_type]}{ports} · `{event.event_id}`")
    lines.extend(["", "| Cổng | Trạng thái | Dịch vụ (tham khảo) |", "| --- | --- | --- |"])
    for port, state in sorted(port_results.items()):
        service = KNOWN_SERVICES.get(port, "—") if state == "open" else "—"
        lines.append(f"| `{port}/tcp` | {PORT_STATES[state]} | {_markdown_value(service)} |")
    open_ports = [port for port, state in sorted(port_results.items()) if state == "open"]
    if open_ports:
        lines.extend(["", "## Chi tiết cổng mở", ""])
    for port in open_ports:
        banner = banners.get(port)
        profile = assess_port(port, banner)
        lines.append(f"- **{port}/tcp** · {profile.severity} · Điểm tham khảo {profile.cvss_score:.1f}/10")
        if banner:
            lines.append(f"  - Banner `{_markdown_value(banner)}`")
        lines.append(f"  - {_markdown_value(profile.impact)}")
        lines.append(f"  - {_markdown_value(profile.recommendation)}")
    lines.extend(["", "## Cách đọc kết quả", "", *(f"- {text}" for text in LIMITS), ""])
    return "\n".join(lines)


def generate_html_report(
    target_host: str, target_ip: str, port_results: dict[int, str],
    banners: dict[int, str | None], scan_duration: float, event_type: str = "MANUAL_SCAN",
    output_path: Path | None = None, archive_snapshot: bool = False,
    *, scan_result: ScanResult | None = None,
) -> Path:
    """Write the latest report pair and optionally retain the HTML snapshot."""
    directory = ensure_reports_dir()
    moment = (datetime.datetime.fromisoformat(scan_result.detected_at) if scan_result
              else datetime.datetime.now(datetime.timezone.utc))
    if scan_result is not None:
        event_type = scan_result.event_type
    if event_type not in EVENTS:
        event_type = "MANUAL_SCAN"
    events = scan_result.events if scan_result else ()
    port_results = {port: state if state in PORT_STATES else "filtered" for port, state in port_results.items()}
    counts = Counter(port_results.values())
    new_ports = _event_ports(events, "NEW_PORT_DETECTED")
    closed_ports = _event_ports(events, "PORT_CLOSED")

    heading = EVENTS["SCAN_UNCERTAIN"] if counts["filtered"] else EVENTS[event_type]
    if new_ports or closed_ports:
        heading = f"Mở mới {_port_summary(new_ports)}" if new_ports else f"Vừa đóng {_port_summary(closed_ports)}"
    notes = []
    if new_ports and closed_ports:
        notes.append(f"Vừa đóng {_port_summary(closed_ports)}.")
    if counts["filtered"]:
        notes.append(f"{counts['filtered']} cổng chưa xác định (timeout/filtered). Không kết luận các cổng đó đã đóng.")
    elif not counts["open"]:
        notes.append("Không quan sát thấy cổng mở trong phạm vi quét.")
    summary_notes = "".join(f"<p>{escape(note)}</p>" for note in notes)
    counters = "".join(f"<span><strong>{counts[state]}</strong> {label.lower()}</span>" for state, label in PORT_STATES.items())
    event_lines = "".join(
        f"<li>{escape(EVENTS[event.event_type])} · <code>{escape(event.event_id)}</code></li>"
        for event in events
    )
    event_codes = f"<details><summary>Mã sự kiện</summary><ul>{event_lines}</ul></details>" if event_lines else ""
    limits = "".join(f"<li>{text}</li>" for text in LIMITS)
    body = f"""<section class="outcome" aria-labelledby="outcome-title">
      <h2 id="outcome-title">{escape(heading)}</h2>
      {summary_notes}
      <p class="counts">{counters}</p>
    </section>
    {_port_table(port_results, new_ports, closed_ports)}
    {_open_port_details(port_results, banners)}
    {event_codes}
    <details><summary>Cách đọc kết quả</summary><ul>{limits}</ul></details>"""

    html = _page("Báo cáo quét cổng", target_host, target_ip, moment, body, scan_duration)
    latest = output_path or directory / "latest.html"
    latest.write_text(html, encoding="utf-8")
    (directory / "latest.md").write_text(
        _markdown_report(target_host, target_ip, moment, scan_duration, event_type, events, port_results, banners),
        encoding="utf-8",
    )
    if archive_snapshot:
        snapshot = directory / f"audit_{moment:%Y%m%d_%H%M%S_%f}_{event_type}.html"
        snapshot.write_text(html, encoding="utf-8")
        clean_old_reports(directory)
    return latest


def generate_error_report(
    target_host: str, reason: str, *, target_ip: str = "", event_type: str = "SCAN_FAILED",
    output_path: Path | None = None,
) -> Path:
    """Replace the latest reports with the failure, while preserving snapshots."""
    directory = ensure_reports_dir()
    moment = datetime.datetime.now(datetime.timezone.utc)
    checks = (
        "Kiểm tra thông báo lỗi, cấu hình Nmap và quyền đọc ghi của scanner.",
        "Đối chiếu DNS, đường mạng và quy tắc truy cập tại điểm đo.",
        "Đối chiếu log và audit trước khi chạy lại.",
    )
    items = "".join(f"<li>{text}</li>" for text in checks)
    body = f"""<section class="outcome error" aria-labelledby="failure-title">
      <h2 id="failure-title">Lý do</h2>
      <p class="reason">{escape(reason)}</p>
      <p>Sự kiện <code>{escape(event_type)}</code></p>
    </section>
    <section>
      <h2>Việc cần kiểm tra</h2>
      <ul>{items}</ul>
      <p>Không kết luận mục tiêu đã đóng cổng hoặc đã an toàn.</p>
    </section>"""
    latest = output_path or directory / "latest.html"
    latest.write_text(_page("Không thể hoàn tất lần quét", target_host, target_ip, moment, body), encoding="utf-8")
    (directory / "latest.md").write_text(
        "# Báo cáo quét thất bại\n\n"
        f"- Mục tiêu **{_markdown_value(target_host)}** ({_markdown_value(target_ip) or 'chưa phân giải được'})\n"
        f"- Thời điểm {_time_text(moment)}\n"
        f"- Sự kiện `{_markdown_value(event_type)}`\n"
        f"- Lý do {_markdown_value(reason)}\n\n"
        "Không kết luận mục tiêu đã đóng cổng hoặc đã an toàn.\n",
        encoding="utf-8",
    )
    return latest
