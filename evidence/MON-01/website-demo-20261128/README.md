# Demo scanner với website KEVILO local

Ngày 2026-11-28, Refs #35. Windows, Nmap 7.993, `127.0.0.1`, state riêng
cho lượt demo. Nmap đo đúng ba cổng website. Express trả health có kết nối
PostgreSQL. Vite trả HTTP 200 cho trang chủ KEVILO và chuyển tiếp API health
về Express. [Cách chạy lại](../../../scanner/README.md#35-demo-với-website-kevilo-local).

| Lượt quét | TCP mở | Kết quả | Tin ở mỗi kênh |
| --- | --- | --- | --- |
| Express và PostgreSQL chạy, Vite dừng | `3000`, `55432` | `INITIAL_SCAN` | 1 tin lập mốc, liệt kê `3000/tcp`, `55432/tcp` |
| Bật Vite | `3000`, `5173`, `55432` | `NEW_PORT_DETECTED` | 1 tin cổng mới, chỉ liệt kê `5173/tcp` ở mục cổng mới |
| Quét lại khi giữ nguyên | `3000`, `5173`, `55432` | `NO_CHANGE` | 0 |
| Dừng Vite | `3000`, `55432` | `PORT_CLOSED` | 1 tin ghi `5173/tcp` đóng theo hành vi hiện tại |
| Bật lại Vite | `3000`, `5173`, `55432` | `NEW_PORT_DETECTED` | 1 tin cổng mới, chỉ liệt kê `5173/tcp` ở mục cổng mới |

Đã kiểm tra nội dung phản hồi của Discord Webhook và Telegram Bot API. Mỗi
kênh xác nhận bốn tin. Danh sách cổng trong mục thay đổi và mã sự kiện khớp
audit, HTML và Markdown từng lượt. Mã sự kiện mở lại Vite là
`b7a297ea8abe433591e72e4d0a8385a6`. Tất cả các lượt có hàng đợi cảnh báo rỗng.
Các tiến trình website được đưa về trạng thái ban đầu khi kết thúc demo.

Đã gọi luồng gửi báo cáo của bot cho lượt mở lại Vite. Telegram xác nhận cả
`latest.html` và `latest.md`. Hai file tải lại khớp SHA-256 với nguồn. Chrome
mở HTML ở `1366×768` và `390×844`, hiển thị đúng ba cổng website, hàng đầu là
`5173/tcp` mới mở và mã sự kiện khớp audit. Kiểm thử tự động xác minh riêng
callback **Gửi báo cáo**. Bot demo local dùng thư mục báo cáo của lượt này.

Bộ `scanner/tests` pass 66/66. Các bài kiểm thử báo cáo dùng ba số cổng của
website để giữ kiểm thử mở, đóng và chưa xác định mà không khởi động website
trong CI. Kết quả trên là kiểm chứng local Windows.
