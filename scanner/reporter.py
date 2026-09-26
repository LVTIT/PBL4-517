"""PBL4-517: Security Audit HTML & Markdown Reporter (Issue #10).

Tạo báo cáo kiểm toán an ninh mạng chuyên nghiệp định dạng HTML và Markdown:
- Giao diện Dashboard Cyber Security hiện đại, hoàn toàn tự chứa (Self-contained, nhúng sẵn CSS/SVG).
- Không phụ thuộc mạng Internet/CDN (mở xem offline khi chấm bài hoàn hảo).
- Nút bấm In ấn / Xuất PDF trực tiếp trên giao diện trình duyệt.
- Tự động sinh báo cáo định dạng Markdown (latest.md) để dễ dàng kẹp vào bài nộp Word đồ án.
- Cơ chế Living Dashboard chống đầy ổ cứng: Mặc định ghi đè file `scanner/reports/latest.html`.
- Cơ chế lưu trữ sự cố: Tự động lưu snapshot khi có cảnh báo và giới hạn tối đa 10 file gần nhất.
"""

from __future__ import annotations

import datetime
from pathlib import Path

from scanner.risk_matrix import assess_port, calculate_system_posture

REPORTS_DIR = Path(__file__).resolve().parent / "reports"
MAX_ARCHIVED_REPORTS = 10


def ensure_reports_dir() -> Path:
    """Đảm bảo thư mục lưu báo cáo tồn tại."""
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return REPORTS_DIR


def clean_old_reports(reports_dir: Path, max_keep: int = MAX_ARCHIVED_REPORTS) -> None:
    """Dọn dẹp các file báo cáo cũ để không làm đầy ổ đĩa (Retention Policy)."""
    try:
        snapshots = sorted(
            [f for f in reports_dir.glob("audit_*.html") if f.is_file()],
            key=lambda f: f.stat().st_mtime,
            reverse=True,
        )
        for old_file in snapshots[max_keep:]:
            try:
                old_file.unlink()
            except Exception:
                pass
    except Exception:
        pass


def generate_markdown_report(
    target_host: str,
    target_ip: str,
    port_results: dict[int, str],
    banners: dict[int, str | None],
    scan_duration: float,
    event_type: str = "MANUAL_SCAN",
) -> Path:
    """Xuất báo cáo định dạng Markdown phục vụ dán vào báo cáo Word đồ án."""
    reports_dir = ensure_reports_dir()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    open_ports = [p for p, status in sorted(port_results.items()) if status == "open"]
    posture = calculate_system_posture(open_ports)

    md_lines = [
        f"# Báo Cáo Kiểm Toán An Ninh Mạng Ngoài (External Audit)",
        f"",
        f"- **Mục tiêu:** `{target_host}` (`{target_ip}`)",
        f"- **Thời điểm kiểm toán:** {now_str} (UTC+7)",
        f"- **Thời gian quét:** {scan_duration:.2f} giây",
        f"- **Sự kiện ghi nhận:** `{event_type}`",
        f"- **Xếp hạng an ninh tổng thể:** **[{posture['grade']}] - {posture['status']}** (Điểm CVSS cao nhất: {posture['max_cvss']:.1f}/10)",
        f"",
        f"---",
        f"",
        f"## 1. Chi tiết các cổng đang mở & Đánh giá rủi ro (Findings)",
        f"",
        f"| Cổng | Dịch vụ mạng | Banner / Phiên bản thu thập | Mức rủi ro | CVSS | Nguy cơ an ninh (OWASP A05) | Khuyến nghị khắc phục |",
        f"| :--- | :--- | :--- | :---: | :---: | :--- | :--- |",
    ]

    if open_ports:
        for p in open_ports:
            banner = banners.get(p) or "Không có phản hồi banner"
            profile = assess_port(p, banner)
            service_name = _get_service_name(p)
            md_lines.append(
                f"| **{p}/tcp** | {service_name} | `{banner}` | **{profile.severity}** | {profile.cvss_score:.1f} | {profile.impact} | `{profile.recommendation}` |"
            )
    else:
        md_lines.append(
            "| - | - | - | - | - | ✅ Không có cổng nhạy cảm nào bị phơi bày ra ngoài Internet | Hệ thống an toàn |"
        )

    md_lines.extend([
        f"",
        f"---",
        f"",
        f"## 2. Toàn bộ trạng thái cổng mạng đã rà soát",
        f"",
        f"| Cổng | Trạng thái phản hồi | Ý nghĩa hạ tầng |",
        f"| :--- | :---: | :--- |",
    ])

    for p, status in sorted(port_results.items()):
        status_upper = status.upper()
        meaning = "Đang mở cho Internet truy cập" if status == "open" else (
            "Bị AWS Security Group chặn âm thầm (An toàn)" if status == "filtered" else "Máy chủ từ chối kết nối (Port đóng)"
        )
        md_lines.append(f"| `{p}/tcp` | **{status_upper}** | {meaning} |")

    md_lines.extend([
        f"",
        f"---",
        f"",
        f"## 3. Khuyến nghị khắc phục trên AWS EC2 Security Group",
        f"",
        f"1. Đăng nhập vào **AWS Management Console** &rarr; Vào dịch vụ **EC2** &rarr; Chọn **Security Groups**.",
        f"2. Tìm Security Group đang gắn với máy chủ `{target_host}`.",
        f"3. Vào tab **Inbound rules** &rarr; Nhấn **Edit inbound rules**.",
        f"4. Xóa bỏ hoàn toàn các rule mở cổng cơ sở dữ liệu (`5432`, `3306`, `6379`) hoặc cổng backend (`3000`, `8080`) có nguồn `0.0.0.0/0`.",
        f"5. Đối với cổng **22 (SSH)**: Giới hạn IP cụ thể dạng `x.x.x.x/32`, không mở công khai cho mọi địa chỉ.",
        f"",
        f"> *Báo cáo được sinh tự động bởi module `scanner/reporter.py` thuộc Đề tài PBL4-517.*",
    ])

    md_path = reports_dir / "latest.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    return md_path


def generate_html_report(
    target_host: str,
    target_ip: str,
    port_results: dict[int, str],
    banners: dict[int, str | None],
    scan_duration: float,
    event_type: str = "MANUAL_SCAN",
    output_path: Path | None = None,
    archive_snapshot: bool = False,
) -> Path:
    """Tạo báo cáo HTML kiểm toán an ninh mạng và lưu ra đĩa."""
    reports_dir = ensure_reports_dir()
    now_dt = datetime.datetime.now()
    now_str = now_dt.strftime("%Y-%m-%d %H:%M:%S")
    timestamp_id = now_dt.strftime("%Y%m%d_%H%M%S")

    open_ports = [p for p, status in sorted(port_results.items()) if status == "open"]
    posture = calculate_system_posture(open_ports)

    # 1. Xây dựng các hàng cho bảng phát hiện cổng mở
    findings_rows = []
    if open_ports:
        for p in open_ports:
            banner = banners.get(p) or "Không có phản hồi banner"
            profile = assess_port(p, banner)
            findings_rows.append(f"""
            <tr>
              <td><span class="port-num">{p}/tcp</span></td>
              <td><strong>{_get_service_name(p)}</strong></td>
              <td><code class="banner-code">{banner}</code></td>
              <td><span class="badge {profile.color_badge}">{profile.severity}</span></td>
              <td><span class="cvss-score">{profile.cvss_score:.1f}</span></td>
              <td>{profile.impact}</td>
              <td class="rec-cell"><code>{profile.recommendation}</code></td>
            </tr>
            """)
    else:
        findings_rows.append("""
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: #27ae60;">
            ✅ <strong>Tuyệt vời:</strong> Không phát hiện bất kỳ cổng nhạy cảm nào bị phơi bày ra ngoài Internet!
          </td>
        </tr>
        """)

    # 2. Xây dựng ma trận toàn bộ cổng đã quét
    all_ports_pills = []
    for p, status in sorted(port_results.items()):
        status_upper = status.upper()
        if status == "open":
            pill_class = "pill-open"
        elif status == "filtered":
            pill_class = "pill-filtered"
        else:
            pill_class = "pill-closed"
        all_ports_pills.append(f'<span class="port-pill {pill_class}">{p}/tcp: {status_upper}</span>')

    # 3. Mẫu HTML tự chứa (Self-contained)
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Báo Cáo Kiểm Toán An Ninh Mạng — {target_host}</title>
  <style>
    :root {{
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --danger: #ef4444;
      --warning: #f59e0b;
      --success: #10b981;
      --info: #06b6d4;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 32px 20px;
      line-height: 1.5;
    }}
    .container {{ max-width: 1200px; margin: 0 auto; }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }}
    .eyebrow {{ color: var(--accent); font-size: 0.85rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }}
    h1 {{ font-size: 1.8rem; margin: 4px 0; }}
    .meta-time {{ color: var(--text-muted); font-size: 0.9rem; }}

    /* Print / Action Buttons */
    .header-actions {{
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }}
    .btn-action {{
      background: #0284c7;
      color: white;
      border: 1px solid #38bdf8;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: background 0.2s, transform 0.1s;
    }}
    .btn-action:hover {{
      background: #0369a1;
      transform: translateY(-1px);
    }}

    /* Cards Grid */
    .grid-cards {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }}
    .card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px;
    }}
    .card-title {{ font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px; font-weight: 600; }}
    .card-value {{ font-size: 1.8rem; font-weight: 700; }}
    .grade-badge {{
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 1.4rem;
      font-weight: 800;
      color: white;
      background: {posture['color_hex']};
    }}

    /* Table */
    .section-title {{ font-size: 1.25rem; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }}
    .table-container {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      overflow-x: auto;
      margin-bottom: 32px;
    }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.9rem; text-align: left; }}
    th {{ background: #0b1329; color: var(--text-muted); padding: 14px 16px; font-weight: 600; border-bottom: 1px solid var(--card-border); }}
    td {{ padding: 14px 16px; border-bottom: 1px solid rgba(51, 65, 85, 0.5); vertical-align: top; }}
    tr:last-child td {{ border-bottom: none; }}
    tr:hover {{ background: rgba(56, 189, 248, 0.03); }}
    .port-num {{ font-family: monospace; font-size: 1rem; font-weight: 700; color: var(--accent); }}
    .banner-code {{ font-family: monospace; font-size: 0.8rem; background: #0b1329; padding: 4px 8px; border-radius: 4px; display: inline-block; max-width: 250px; overflow-wrap: break-word; }}
    .cvss-score {{ font-weight: 700; font-size: 1rem; color: #f8fafc; }}
    .rec-cell code {{ font-size: 0.8rem; color: #a5f3fc; }}

    /* Badges */
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }}
    .badge-critical {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }}
    .badge-high {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }}
    .badge-medium {{ background: rgba(245, 158, 11, 0.15); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.5); }}
    .badge-info {{ background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; }}
    .badge-low {{ background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid #64748b; }}

    /* Pills Matrix */
    .pills-box {{ background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 10px; padding: 20px; margin-bottom: 32px; }}
    .pills-grid {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }}
    .port-pill {{ padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 0.82rem; font-weight: 600; }}
    .pill-open {{ background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }}
    .pill-filtered {{ background: rgba(100, 116, 139, 0.2); color: #94a3b8; border: 1px solid #475569; }}
    .pill-closed {{ background: rgba(30, 41, 59, 0.8); color: #64748b; border: 1px solid #334155; }}

    /* Remediation Guide */
    .guide-box {{ background: #091a28; border: 1px solid #0284c7; border-radius: 10px; padding: 24px; margin-bottom: 32px; }}
    .guide-box h3 {{ color: #38bdf8; margin-bottom: 12px; font-size: 1.1rem; }}
    .guide-box ol {{ padding-left: 20px; color: #cbd5e1; font-size: 0.92rem; }}
    .guide-box li {{ margin-bottom: 8px; }}

    .footer {{ text-align: center; color: var(--text-muted); font-size: 0.85rem; padding-top: 24px; border-top: 1px solid var(--card-border); }}

    /* Print / PDF Media Styles */
    @media print {{
      body {{ background: white !important; color: black !important; padding: 0 !important; }}
      .btn-action, .badge {{ display: none !important; }}
      .card, .table-container, .pills-box, .guide-box {{
        background: white !important;
        border: 1px solid #cbd5e1 !important;
        color: black !important;
        box-shadow: none !important;
      }}
      th {{ background: #f1f5f9 !important; color: #0f172a !important; }}
      td, p, h1, h2, h3, .meta-time, .card-title {{ color: #0f172a !important; }}
      .port-num {{ color: #0284c7 !important; }}
      .banner-code {{ background: #f8fafc !important; color: #0f172a !important; border: 1px solid #e2e8f0; }}
      .guide-box {{ border-color: #94a3b8 !important; }}
    }}
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div>
        <p class="eyebrow">PBL4-517 SECURITY AUDIT SUITE</p>
        <h1>Báo Cáo Kiểm Toán An Ninh Mạng Ngoài (External Audit)</h1>
        <p class="meta-time">Mục tiêu: <strong>{target_host}</strong> ({target_ip}) • Thời điểm kiểm toán: <strong>{now_str}</strong></p>
      </div>
      <div class="header-actions">
        <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: var(--accent); border: 1px solid var(--accent); padding: 8px 16px; font-size: .85rem;">
          SỰ KIỆN: {event_type}
        </span>
        <button onclick="window.print()" class="btn-action" title="In báo cáo hoặc lưu ra file PDF">
          🖨️ Xuất PDF / In Báo Cáo
        </button>
      </div>
    </header>

    <!-- Executive Summary Cards -->
    <div class="grid-cards">
      <div class="card">
        <div class="card-title">Xếp hạng an ninh</div>
        <div class="card-value"><span class="grade-badge">{posture['grade']}</span></div>
        <p style="font-size: 0.85rem; margin-top: 8px; color: {posture['color_hex']}; font-weight: 600;">{posture['status']}</p>
      </div>

      <div class="card">
        <div class="card-title">Điểm CVSS cao nhất</div>
        <div class="card-value" style="color: {posture['color_hex']};">{posture['max_cvss']:.1f} <span style="font-size: 1rem; color: var(--text-muted);">/ 10</span></div>
        <p style="font-size: 0.85rem; margin-top: 8px; color: var(--text-muted);">Mức cao nhất: <strong>{posture['highest_severity']}</strong></p>
      </div>

      <div class="card">
        <div class="card-title">Cổng đang mở</div>
        <div class="card-value" style="color: {'#ef4444' if open_ports else '#10b981'};">{len(open_ports)}</div>
        <p style="font-size: 0.85rem; margin-top: 8px; color: var(--text-muted);">Trên tổng số {len(port_results)} cổng quét</p>
      </div>

      <div class="card">
        <div class="card-title">Tốc độ quét</div>
        <div class="card-value" style="color: var(--accent);">{scan_duration:.2f}s</div>
        <p style="font-size: 0.85rem; margin-top: 8px; color: var(--text-muted);">Đa luồng ThreadPoolExecutor</p>
      </div>
    </div>

    <!-- Findings Table -->
    <h2 class="section-title">🔍 Chi tiết các điểm phát hiện an ninh (Findings)</h2>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Port</th>
            <th>Dịch vụ</th>
            <th>Banner / Phiên bản thu thập</th>
            <th>Mức độ</th>
            <th>CVSS</th>
            <th>Tác động / Nguy cơ an ninh (OWASP A05)</th>
            <th>Khuyến nghị khắc phục (AWS)</th>
          </tr>
        </thead>
        <tbody>
          {''.join(findings_rows)}
        </tbody>
      </table>
    </div>

    <!-- All Ports Status Matrix -->
    <div class="pills-box">
      <h3 style="font-size: 1rem; margin-bottom: 4px;">📡 Ma trận toàn bộ các cổng mạng đã kiểm tra:</h3>
      <p style="font-size: 0.85rem; color: var(--text-muted);">Hiển thị cả các cổng bị AWS Security Group chặn (FILTERED) hoặc không có dịch vụ (CLOSED):</p>
      <div class="pills-grid">
        {''.join(all_ports_pills)}
      </div>
    </div>

    <!-- Remediation Guide -->
    <div class="guide-box">
      <h3>🛠️ Hướng dẫn Khắc phục trên AWS EC2 Security Group:</h3>
      <ol>
        <li>Đăng nhập vào <strong>AWS Management Console</strong> &rarr; Vào dịch vụ <strong>EC2</strong> &rarr; Chọn <strong>Security Groups</strong>.</li>
        <li>Tìm Security Group đang gắn với máy chủ EC2 (Mục tiêu <code>{target_host}</code>).</li>
        <li>Chuyển sang tab <strong>Inbound rules</strong> &rarr; Nhấn nút <strong>Edit inbound rules</strong>.</li>
        <li><strong>Xóa bỏ hoàn toàn</strong> các rule mở cổng cơ sở dữ liệu (5432, 3306, 6379, 27017) hoặc backend thô (3000, 8080) có Source là <code>0.0.0.0/0</code>.</li>
        <li>Đối với port <strong>22 (SSH)</strong>: Chỉ cho phép IP tĩnh cụ thể của người quản trị (Dạng <code>x.x.x.x/32</code>), tuyệt đối không mở cho mọi IP.</li>
        <li>Lưu lại cấu hình và chạy lại Scanner để kiểm chứng trạng thái cổng đã chuyển thành <strong>FILTERED</strong>.</li>
      </ol>
    </div>

    <footer class="footer">
      <p>Đề tài PBL4-517: Tìm hiểu AWS Cloud, xây dựng chương trình phân tích và giám sát các điểm yếu bảo mật từ bên ngoài.</p>
      <p style="margin-top: 4px; font-size: 0.8rem;">Báo cáo được sinh tự động bởi <code>scanner/reporter.py</code> • Trường Đại học Bách Khoa - ĐH Đà Nẵng</p>
    </footer>
  </div>
</body>
</html>"""

    # 4. Lưu ra file:
    # A. File Living Dashboard (Luôn ghi đè, dung lượng cố định ~10KB)
    latest_file = output_path or (reports_dir / "latest.html")
    with open(latest_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    # B. Sinh đồng thời file Markdown tương ứng (latest.md)
    generate_markdown_report(
        target_host=target_host,
        target_ip=target_ip,
        port_results=port_results,
        banners=banners,
        scan_duration=scan_duration,
        event_type=event_type,
    )

    # C. Lưu snapshot lịch sử nếu có sự kiện bất thường hoặc yêu cầu lưu trữ
    if archive_snapshot:
        snapshot_file = reports_dir / f"audit_{timestamp_id}_{event_type}.html"
        with open(snapshot_file, "w", encoding="utf-8") as f:
            f.write(html_content)
        clean_old_reports(reports_dir)

    return latest_file


def _get_service_name(port: int) -> str:
    from alerts.notifier import KNOWN_SERVICES
    return KNOWN_SERVICES.get(port, "Dịch vụ mạng")
