# External Security Scanner & Anomaly Detector — Issue #10 (SCAN-02)

Chương trình phân tích bề mặt tấn công bên ngoài (Attack Surface Management) và giám sát điểm yếu bảo mật theo chuẩn **OWASP Top 10 - A05: Security Misconfiguration**:
- **Quét mạng đa luồng:** Quét nhanh danh sách cổng TCP với `ThreadPoolExecutor`, hỗ trợ cả IP và Domain.
- **Thu thập Banner giao thức (Deep Banner Grabbing):** Thăm dò chi tiết phiên bản HTTP (`Server`, `X-Powered-By`), SSH handshake, PostgreSQL SSLRequest, MySQL packet, Redis PING.
- **Đánh giá rủi ro theo CVSS v3.1 & OWASP A05:** Chấm điểm Base Score, xếp hạng độ nghiêm trọng (CRITICAL / HIGH / MEDIUM / INFO) và xếp loại Posture hệ thống (Grade A+ đến F).
- **Phát hiện dị thường theo Baseline (Diffing Engine):** Tự động phát hiện cổng mới mở thêm hoặc cổng đã được bịt lại dựa trên mốc lưu trữ tại `scanner_state.json`.
- **Hệ thống cảnh báo kép (Dual Alerts) với nút bấm tương tác:**
  - **Discord Webhook:** Rich Embed trực quan kèm Action Row Link Buttons dẫn tới cẩm nang khắc phục AWS Security Group & tài liệu chuẩn OWASP A05.
  - **Telegram Group Bot:** Thông báo định dạng Markdown an toàn kèm Inline Keyboard nút bấm tương tác nhanh.
- **Telegram ChatOps Bot hai chiều:** Module `alerts/bot_listener.py` chạy nền tiếp nhận lệnh điều khiển từ xa (`/scan`, `/status`, `/ping`, `/help`).
- **Xuất báo cáo kép (Dual Reporting):**
  - **Living HTML Dashboard (`latest.html`):** Giao diện Dark Cyber Glassmorphism hiện đại, tự động lưu trữ tối đa 10 snapshot sự kiện, tích hợp nút in/xuất PDF trực tiếp từ trình duyệt (`window.print()`).
  - **Markdown Report (`latest.md`):** Tự động sinh báo cáo chuẩn Markdown phục vụ việc sao chép vào báo cáo đề tài/đồ án.
- **Không phụ thuộc thư viện ngoài:** 100% sử dụng thư viện chuẩn của Python (`socket`, `concurrent.futures`, `urllib.request`, `json`, `datetime`).

---

## 1. Mối liên hệ giữa Scanner và OWASP Top 10 - A05 (Security Misconfiguration)

Tại sao một công cụ Network/Port Scanner lại thuộc danh mục **OWASP Top 10 - A05**?

Theo tài liệu chuẩn [OWASP Top 10:2021 - A05: Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/):
1. **Mở cổng và dịch vụ không cần thiết:** OWASP A05 chỉ rõ lỗi cấu hình bảo mật xảy ra khi hệ thống để lộ các cổng/dịch vụ không cần thiết ra ngoài Internet (ví dụ: mở cổng cơ sở dữ liệu `5432/PostgreSQL`, `3306/MySQL`, `6379/Redis` hoặc cổng ứng dụng thô `3000/NodeJS`, `8080/Tomcat` thay vì chỉ mở `80/443` qua Reverse Proxy / Cloudflare).
2. **Cấu hình tường lửa / Cloud Security Group lỏng lẻo:** Việc gán nhầm luật Inbound `0.0.0.0/0` trong AWS EC2 Security Group cho các cổng nội bộ là ví dụ điển hình nhất của A05 trên hạ tầng Cloud.
3. **Tiết lộ thông tin phiên bản (Banner Leaking / Information Disclosure):** Việc để lộ phiên bản phần mềm chi tiết qua HTTP headers hoặc SSH banners giúp tin tặc tra cứu mã khai thác (CVE/Exploit) tương ứng, vi phạm nguyên tắc làm cứng hệ thống (Hardening) của A05.

Do đó, **External Scanner** đóng vai trò là công cụ kiểm toán tự động (Automated Audit Tool) nhằm phát hiện sớm các vi phạm thuộc nhóm lỗi **OWASP A05**.

---

## 2. Cấu hình Cảnh báo (Alerts & Tokens)

Tạo file `.env` ở thư mục gốc của dự án (đã có mẫu hướng dẫn tại [`.env.example`](../.env.example)):

```ini
# Cấu hình Discord & Telegram (Issue #10)
DISCORD_WEBHOOK_URL="https://discordapp.com/api/webhooks/your_id/your_token"
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
TELEGRAM_CHAT_ID="-1001234567890"
```

Kiểm tra kết nối và bắn thử tin nhắn kiểm thử:
```bash
python alerts/notifier.py
```

---

## 3. Hướng dẫn Sử dụng Scanner

### 3.1. Quét cơ bản & Khởi tạo Baseline:
```bash
# Quét danh sách port phổ biến (22, 80, 443, 3000, 5432, 8080)
python scanner/scan.py 127.0.0.1

# Chỉ định cổng cụ thể và số luồng song song
python scanner/scan.py 127.0.0.1 --ports 22,80,443,3000,5432,6379 --workers 10

# Reset mốc Baseline ban đầu cho mục tiêu
python scanner/scan.py 127.0.0.1 --reset-baseline
```

### 3.2. Quét mục tiêu Cloud / AWS EC2:
```bash
python scanner/scan.py <EC2_PUBLIC_IP> --ports 22,80,443,3000,5432,8080
```

### 3.3. Chế độ Giám sát liên tục (Watch Mode / Daemon):
Tự động quét lặp lại định kỳ mỗi `N` giây. Khi phát hiện thay đổi trạng thái cổng (mở thêm hoặc đóng lại), cảnh báo sẽ được kích hoạt tức thì:
```bash
python scanner/scan.py 127.0.0.1 --watch 30
```

### 3.4. Chế độ Im lặng (Local Validation không bắn Bot):
```bash
python scanner/scan.py 127.0.0.1 --no-alert
```

---

## 4. Telegram ChatOps Bot tương tác hai chiều

Hệ thống cung cấp một Bot Listener chạy ngầm qua giao thức Long Polling của Telegram Bot API. Người quản trị có thể tra cứu và kích hoạt quét trực tiếp từ nhóm chat:

Khởi động Bot Listener:
```bash
python alerts/bot_listener.py
```

Các lệnh tương tác hỗ trợ:
- `/scan [target] [ports]`: Kích hoạt scanner từ xa cho mục tiêu chỉ định (mặc định: `127.0.0.1`).
- `/status [target]`: Kiểm tra nhanh các cổng đang mở trong Baseline mà không cần quét lại.
- `/ping`: Kiểm tra độ trễ và tình trạng sẵn sàng của ChatOps Bot.
- `/help`: Xem hướng dẫn sử dụng và danh sách lệnh.

---

## 5. Báo cáo & Bằng chứng Kiểm định (Reports & Evidence)

Hệ thống tự động đồng bộ hóa hai dạng báo cáo tại thư mục `scanner/reports/`:
1. **`latest.html` (Living Dashboard):** Giao diện động, hiển thị điểm CVSS, cảnh báo trực quan, biểu đồ tình trạng, và nút bấm **🖨️ Xuất PDF / In Báo Cáo** chuẩn định dạng in ấn.
2. **`latest.md` (Markdown Report):** Báo cáo văn bản dạng bảng Markdown, sẵn sàng sao chép vào báo cáo đề tài/đồ án.
3. **Lưu trữ Snapshot:** Mỗi khi có sự kiện `NEW_PORT_DETECTED` hoặc `PORT_CLOSED`, hệ thống sẽ lưu một bản sao thời gian thực (giới hạn tối đa 10 bản ghi gần nhất để tránh phình dung lượng ổ đĩa).

Toàn bộ bộ bằng chứng thực nghiệm đạt chuẩn kiểm thử cho Issue #10 được lưu trữ tại [`evidence/SCAN-01/`](../evidence/SCAN-01/).

---

## 6. Ma trận Đánh giá Rủi ro (CVSS v3.1 & OWASP A05)

| Cổng | Dịch vụ | CVSS Score | Mức độ | Định danh OWASP | Mô tả Rủi ro & Hành động |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **5432** | PostgreSQL | **9.8** | 🔴 CRITICAL | OWASP A05 | Cổng cơ sở dữ liệu mở công khai! Cần đóng ngay trên AWS Security Group. |
| **3306** | MySQL | **9.8** | 🔴 CRITICAL | OWASP A05 | Cổng RDBMS mở công khai! Nguy cơ rò rỉ dữ liệu hoặc brute-force mật khẩu. |
| **6379** | Redis | **9.8** | 🔴 CRITICAL | OWASP A05 | In-memory cache không xác thực! Nguy cơ thực thi mã từ xa (RCE). |
| **3000** | Backend API | **7.5** | 🟠 HIGH | OWASP A05 | Backend thô mở trực tiếp ra Internet. Nên đặt sau Nginx/Cloudflare. |
| **8080** | Proxy/App | **7.5** | 🟠 HIGH | OWASP A05 | Cổng ứng dụng thay thế để lộ trực tiếp không qua bảo vệ WAF. |
| **22** | SSH | **5.3** | 🟡 MEDIUM | OWASP A05 | Dịch vụ quản trị từ xa. Cần giới hạn IP truy cập hoặc chuyển đổi sang AWS SSM. |
| **80/443**| HTTP/HTTPS | **0.0** | ⚪ INFO | — | Lưu lượng Web hợp lệ công khai. |

---

## 7. Các Sự kiện Cảnh báo (Event Types)

| Sự kiện | Điều kiện kích hoạt | Hành động của Hệ thống |
| :--- | :--- | :--- |
| **`INITIAL_SCAN`** | Lần đầu quét một host (hoặc dùng `--reset-baseline`) | Ghi nhận mốc Baseline. Gửi thông báo khởi tạo thành công tới Discord & Telegram. |
| **`NEW_PORT_DETECTED`** | Phát hiện cổng mới mở thêm ($P_{\text{mới}} = P_{\text{hiện tại}} \setminus P_{\text{baseline}}$) | Cập nhật Baseline. **Bắn chuông báo động đỏ khẩn cấp** kèm điểm CVSS và nút hướng dẫn xử lý! |
| **`PORT_CLOSED`** | Cổng bất thường đã được đóng lại/bịt thành công | Cập nhật Baseline. Gửi thông báo xanh lá xác nhận hệ thống an toàn trở lại. |
| **`NO_CHANGE`** | Trạng thái cổng không đổi so với Baseline | Cập nhật thời gian quét. **Im lặng hoàn toàn** (tránh gây phiền nhiễu cho nhóm chat). |

