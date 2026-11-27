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
TCP_RESULTS = {"open": "Kết nối được", "closed": "Kết nối bị từ chối", "filtered": "Chưa xác định"}
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
        f"<div><dt>Cách quét</dt><dd>Nmap TCP Connect</dd></div>"
        f"<div><dt>Thời gian quét</dt><dd>{scan_duration:.2f} giây</dd></div>"
        if scan_duration is not None else ""
    )
    local_time = moment.astimezone()
    offset = local_time.strftime('%z')
    timestamp = f"{local_time:%d/%m/%Y %H:%M:%S} (UTC{offset[:3]}:{offset[3:]})"
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
    <header class="report-header">
      <div class="heading">
        <h1>{escape(title)}</h1>
        <button type="button" onclick="window.print()">In / Lưu PDF</button>
      </div>
      <dl class="metadata">
        <div><dt>Địa chỉ quét</dt><dd><code>{host}</code>{ip}</dd></div>
        <div><dt>Lúc quét</dt><dd><time datetime="{moment.isoformat()}">{timestamp}</time></dd></div>
        {duration}
      </dl>
    </header>
    {body}
  </main>
</body>
</html>
"""


def _port_table(port_results: dict[int, str], new: set[int], closed: set[int], comparison: str) -> str:
    ordered = sorted(port_results, key=lambda port: (
        port not in new, port not in closed, port_results[port] != "open", port,
    ))
    rows = []
    for port in ordered:
        state = port_results[port]
        service = KNOWN_SERVICES.get(port)
        hint = ""
        if state == "open":
            hint = f'<small>{escape(service)} (gợi ý theo cổng)</small>' if service else '<small>Chưa rõ dịch vụ</small>'
        note = "Chưa so sánh"
        if comparison == "initial":
            note = "Ghi nhận vào mốc" if state == "open" else "Lần quét lập mốc"
        elif comparison == "saved":
            if port in new:
                note = "Mới phát hiện mở"
            elif port in closed:
                note = "Vừa xác nhận đóng"
            elif state == "open":
                note = "Đã mở từ trước"
            else:
                note = "Không ghi nhận thay đổi"
        if state == "filtered":
            note = "Chưa đủ dữ liệu so sánh"
        highlight = ' class="changed-row"' if port in new or port in closed else ""
        rows.append(
            f'<tr{highlight}><th scope="row"><code>{port}/tcp</code>{hint}</th>'
            f'<td><span class="state {state}">{TCP_RESULTS[state]}</span></td><td>{note}</td></tr>'
        )
    table = f"""<table aria-labelledby="ports-title">
        <colgroup><col class="port-col"><col class="state-col"><col></colgroup>
        <thead><tr><th scope="col">Cổng</th><th scope="col">Kết quả TCP</th>
          <th scope="col">So với mốc đã lưu</th></tr></thead>
        <tbody>{''.join(rows)}</tbody>
      </table>""" if rows else "<p>Lần quét này chưa có kết quả theo cổng.</p>"
    return f"""<section class="panel results" aria-labelledby="ports-title">
      <h2 id="ports-title">Kết quả theo cổng</h2>
      {table}
    </section>"""


def _open_port_details(port_results: dict[int, str], banners: dict[int, str | None]) -> str:
    groups: dict[tuple[str, float, str], list[tuple[int, str | None]]] = {}
    for port, state in sorted(port_results.items()):
        if state != "open":
            continue
        banner = banners.get(port)
        profile = assess_port(port, banner)
        key = (profile.severity, profile.cvss_score, profile.recommendation)
        groups.setdefault(key, []).append((port, banner))
    items = []
    for (severity, score, recommendation), entries in groups.items():
        ports = ", ".join(f"<code>{port}/tcp</code>" for port, _ in entries)
        guidance = "".join(f"<code>{escape(part)}</code>" if index % 2 else escape(part)
                           for index, part in enumerate(recommendation.split("`")))
        observed_banners = "".join(
            f"<p>Phản hồi từ <code>{port}/tcp</code> <code>{escape(banner)}</code></p>"
            for port, banner in entries if banner
        )
        items.append(
            f"<li><h3>{ports}</h3><p class=\"score\">{escape(severity)} · Điểm tham khảo {score:.1f}/10</p>"
            f"<p>{guidance}</p>{observed_banners}</li>"
        )
    if not items:
        return ""
    return f"""<section class="panel port-details" aria-labelledby="details-title">
      <h2 id="details-title">Chi tiết cổng mở</h2>
      <p class="help">Điểm tham khảo dựa trên quy tắc theo cổng. Quét TCP chỉ xác nhận khả năng kết nối.</p>
      <ul class="entries">{''.join(items)}</ul>
    </section>"""


def _next_step(new_ports: tuple[int, ...], counts: Counter[str]) -> str:
    if new_ports:
        ports = escape(_port_summary(new_ports))
        return (f"Kiểm tra tiến trình đang lắng nghe trên <strong>{ports}</strong> và đối chiếu "
                "với dịch vụ nhóm vừa bật hoặc cấu hình vừa thay đổi.")
    if counts["filtered"]:
        return "Kiểm tra đường mạng và tường lửa từ máy quét, sau đó đo lại các cổng chưa xác định."
    if counts["open"]:
        return "Đối chiếu các cổng kết nối được với danh sách dịch vụ dự kiến trên máy đích."
    return "Nếu máy đích dự kiến có dịch vụ đang chạy, đối chiếu lại địa chỉ, danh sách cổng và cấu hình truy cập."


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

    comparison = "manual"
    if event_type == "INITIAL_SCAN":
        comparison = "initial"
    elif scan_result is not None:
        comparison = "saved"

    notes = []
    if new_ports:
        heading = f"Phát hiện thêm cổng {_port_summary(new_ports)} có thể kết nối"
        if closed_ports:
            notes.append(f"Đồng thời xác nhận đóng {_port_summary(closed_ports)}.")
    elif closed_ports:
        heading = f"Xác nhận đóng cổng {_port_summary(closed_ports)}"
    elif comparison == "initial":
        heading = "Đã lưu mốc so sánh cho các lần quét sau"
        notes.append("Các cổng kết nối được trong lần này được ghi vào mốc đã lưu.")
    elif counts["filtered"]:
        heading = "Kết quả quét chưa đầy đủ"
    elif event_type == "NO_CHANGE":
        heading = "Không ghi nhận cổng mới mở hoặc vừa đóng"
    elif event_type == "SCAN_RECOVERED":
        heading = "Đã xác định lại trạng thái các cổng"
    else:
        heading = EVENTS[event_type]

    if counts["filtered"]:
        notes.append(f"{counts['filtered']} cổng chưa xác định (timeout/filtered). Không kết luận các cổng đó đã đóng.")
    elif port_results and not counts["open"]:
        notes.append("Không quan sát thấy cổng mở trong phạm vi quét.")
    summary_notes = "".join(f"<p>{escape(note)}</p>" for note in notes)
    metrics = "".join(
        f'<div class="{state}"><dt>{label}</dt><dd>{counts[state]}</dd></div>'
        for state, label in TCP_RESULTS.items()
    )
    event_labels = {
        "INITIAL_SCAN": "Lưu mốc so sánh",
        "NEW_PORT_DETECTED": "Phát hiện cổng mới mở",
        "PORT_CLOSED": "Xác nhận đóng cổng",
        "SCAN_UNCERTAIN": "Có cổng chưa xác định",
        "SCAN_RECOVERED": "Đã xác định lại trạng thái cổng",
    }
    event_lines = "".join(
        f"<li><span>{escape(event_labels.get(event.event_type, event.event_type))}</span>"
        f"<code>{escape(event.event_id)}</code></li>"
        for event in events
    )
    event_codes = f"""<section class="panel" aria-labelledby="events-title">
        <h2 id="events-title">Mã sự kiện</h2>
        <ul class="entries events">{event_lines}</ul>
      </section>""" if event_lines else ""
    limits = "".join(f"<li>{text}</li>" for text in LIMITS)
    body = f"""<section class="outcome{' partial' if counts['filtered'] else ''}" aria-labelledby="outcome-title">
      <div>
        <p class="scan-count">Đã quét {len(port_results)} cổng</p>
        <h2 id="outcome-title">{escape(heading)}</h2>
        {summary_notes}
      </div>
      <dl class="metrics" aria-label="Tổng hợp kết quả TCP">{metrics}</dl>
    </section>
    <div class="report-grid">
      {_port_table(port_results, set(new_ports), set(closed_ports), comparison)}
      <div class="side-column">
        <section class="panel next-step" aria-labelledby="next-title">
          <h2 id="next-title">Việc cần kiểm tra</h2>
          <p>{_next_step(new_ports, counts)}</p>
        </section>
        {event_codes}
      </div>
    </div>
    {_open_port_details(port_results, banners)}
    <section class="limits" aria-labelledby="limits-title">
      <h2 id="limits-title">Cách đọc kết quả</h2>
      <ul>{limits}</ul>
    </section>"""

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
      <div>
        <h2 id="failure-title">Lần quét này chưa có kết quả theo cổng</h2>
        <p class="reason">{escape(reason)}</p>
        <p>Loại sự kiện <code>{escape(event_type)}</code></p>
      </div>
    </section>
    <section class="panel next-step" aria-labelledby="next-title">
      <h2 id="next-title">Việc cần kiểm tra</h2>
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
