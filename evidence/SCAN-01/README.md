# SCAN-01 Evidence — Issue #10: External Security Scanner & Dual-Channel Alerts

Ngày thực nghiệm: **2026-09-26**. Nhánh: `feature/10-scanner-dual-alerts`.

Tài liệu này ghi nhận toàn bộ hồ sơ kiểm thử, phân tích kiến trúc, ma trận rủi ro CVSS, cơ chế chống đầy ổ đĩa (Living Dashboard) và bộ bằng chứng thực nghiệm đầy đủ cho **Module External Security Scanner (Issue #10)** trong đề tài PBL4-517.

---

## 1. Mục tiêu & Chuẩn mực Đồ án Đạt được

Module Scanner đáp ứng trọn vẹn yêu cầu trong bản đặc tả Đề tài 517:
* **Đầu vào:** Máy tấn công / máy kiểm toán bên ngoài chứa script tự động dò quét các IP, cổng mở trên AWS của công ty (hoặc localhost thử nghiệm).
* **Đầu ra:**
  1. Tự động dò quét và cảnh báo về **Telegram / Discord** các cổng đang mở đối với lần scan đầu tiên (Baseline).
  2. Phát hiện và cảnh báo khẩn cấp các cổng vừa mở thêm đối với các lần dò quét tiếp theo (Điểm yếu cấu hình **OWASP Top 10 - A05: Security Misconfiguration**).
  3. Ghi nhận và thông báo an toàn trở lại sau khi triển khai bịt các điểm yếu trên (đóng cổng).

---

## 2. Kiến trúc Nâng cấp Toàn diện (Branch 1 Improvements)

Hệ thống được nâng cấp vượt bậc so với prototype ban đầu, đạt chuẩn công nghiệp:

```
                            ┌──────────────────────────────────────────────┐
                            │      EXTERNAL SECURITY SCANNER ENGINE        │
                            │      (Pure Python Standard Library)          │
                            └──────────────────────┬───────────────────────┘
                                                   │
             ┌─────────────────────────────────────┼─────────────────────────────────────┐
             ▼                                     ▼                                     ▼
 [1. ThreadPoolExecutor]                [2. Banner Grabbing]                  [3. Risk Matrix & CVSS]
 - Quét song song đa luồng             - Thăm dò phiên bản thật               - Đánh giá rủi ro theo cổng
 - Quét 50 ports trong ~1.0s           - HTTP HEAD (Nginx, Express)           - CRITICAL: 5432, 3306 (CVSS 9.8)
 - Nhận diện OPEN/CLOSED/FILTERED      - SSH greeting (OpenSSH)               - HIGH: 3000, 8080 (CVSS 7.0-7.5)
             │                         - Postgres SSLRequest probe            - MEDIUM: 22 (CVSS 5.3)
             │                                     │                          - INFO: 80, 443 (CVSS 0.0)
             └─────────────────────────────────────┼─────────────────────────────────────┘
                                                   ▼
                                     [4. Smart Diffing Engine]
                                     - Lưu mốc vào scanner_state.json
                                     - So sánh trạng thái (4 Sự kiện):
                                       + INITIAL_SCAN: Lưu mốc Baseline
                                       + NO_CHANGE: Im lặng (Chống spam)
                                       + NEW_PORT_DETECTED: Báo động đỏ khẩn cấp!
                                       + PORT_CLOSED: Báo an toàn đã bịt lỗi
                                                   │
             ┌─────────────────────────────────────┴─────────────────────────────────────┐
             ▼                                                                           ▼
[5. Dual-Channel Notifier]                                                  [6. Self-Contained HTML Report]
- Discord Webhook (Kênh #scanner):                                          - Living Dashboard: scanner/reports/latest.html
  Khung Rich Embed đổi màu theo rủi ro                                        (Luôn ghi đè, dung lượng cố định ~10KB)
- Telegram Group Bot (PBL4-517 Alerts):                                     - Lưu snapshot lịch sử khi có sự cố
  Tin nhắn Markdown kèm banner & badge CVSS                                 - Tự động dọn dẹp (Retention Policy max 10 files)
```

---

## 3. Danh mục Hồ sơ Bằng chứng Thực nghiệm (Evidence Logs)

Toàn bộ quá trình kiểm thử thực tế được ghi nhận thành các file log chuẩn mực trong thư mục này:

| File Bằng chứng | Thao tác kiểm thử | Trạng thái ghi nhận | Kết quả gửi Alert |
| :--- | :--- | :--- | :--- |
| [01-initial-scan-baseline.txt](01-initial-scan-baseline.txt) | Quét lần đầu thiết lập mốc | **`INITIAL_SCAN`** — Lưu Baseline thành công | 📢 Discord + Telegram (**Xanh dương**) |
| [02-no-change-silent.txt](02-no-change-silent.txt) | Quét lần 2 hệ thống giữ nguyên | **`NO_CHANGE`** — Đối chiếu không có cổng mới | 🔕 **Im lặng** (Chống spam nhóm chat) |
| [03-new-port-anomaly-alert.txt](03-new-port-anomaly-alert.txt) | Vô tình mở cổng 8080 (Sự cố) | **`NEW_PORT_DETECTED`** — Lấy banner & CVSS 7.0 | 🚨 Discord + Telegram (**Đỏ khẩn cấp**) |
| [04-port-closed-remediated.txt](04-port-closed-remediated.txt) | Đóng cổng 8080 (Khắc phục) | **`PORT_CLOSED`** — Xác nhận đã đóng cổng | 🛡️ Discord + Telegram (**Xanh lá an toàn**) |
| [05-sample-audit-report.html](05-sample-audit-report.html) | Báo cáo Kiểm toán HTML mẫu | Báo cáo tự chứa nhúng CSS/SVG, dung lượng ~10KB | Xem trực quan trên trình duyệt |

---

## 4. Giải pháp Chống Đầy Ổ cứng (Storage Hygiene)

Để giải quyết lo ngại việc xuất file HTML liên tục làm nặng ổ đĩa khi chạy chế độ giám sát liên tục (`--watch`), hệ thống áp dụng 2 nguyên tắc:
1. **Living Dashboard (`scanner/reports/latest.html`):** Mọi lần quét thông thường đều ghi đè vào duy nhất một file này. Dung lượng cố định vĩnh viễn ở mức **~10 KB**.
2. **Event-Triggered Archiving & Retention Policy:** Chỉ khi có sự cố an ninh (`NEW_PORT_DETECTED` hoặc `PORT_CLOSED`), hệ thống mới lưu một bản snapshot lịch sử có gắn timestamp. Thư mục tự động dọn dẹp chỉ giữ lại tối đa **10 bản snapshot gần nhất**, ngăn ngừa hoàn toàn nguy cơ đầy ổ đĩa.
3. **Bảo mật Git:** File `.gitignore` đã chặn toàn bộ `scanner/reports/*.html` và `scanner_state.json`, đảm bảo không rác hóa kho mã nguồn chung.

---

## 5. Hướng dẫn Tái hiện Kiểm chứng (2-Minute Live Demo)

Mở 2 cửa sổ terminal:

```bash
# Bước 1: Quét lần đầu thiết lập Baseline
python scanner/scan.py 127.0.0.1 --reset-baseline

# Bước 2: Quét lần 2 (Không có gì thay đổi -> Im lặng chống spam)
python scanner/scan.py 127.0.0.1

# Bước 3: Giả lập sự cố mở cổng 8080 (Ở terminal 2: python -m http.server 8080 --bind 127.0.0.1)
python scanner/scan.py 127.0.0.1

# Bước 4: Tắt server 8080 (Ctrl+C ở terminal 2) và quét lại
python scanner/scan.py 127.0.0.1

# Bước 5: Mở file báo cáo HTML xem giao diện Dashboard an ninh
# Mở file scanner/reports/latest.html trên trình duyệt bất kỳ
```
