# Kiểm chứng Nmap và cảnh báo trên localhost

Ngày 2026-11-27, trên Windows với Python 3.13.7 và Nmap 7.993. Refs #35.
Listener TCP thử dùng `127.0.0.1` và file state riêng. Mỗi lượt gọi scanner
qua một tiến trình mới.

## Lượt kiểm chứng với đích mô phỏng

Một HTTP server loopback nhận và lưu nội dung POST Discord rồi trả HTTP 204.
Phản hồi Telegram của `/scan` được thu bằng mock.

| Lượt | Trạng thái Nmap | Sự kiện audit | Baseline | POST loopback lũy kế |
| --- | --- | --- | --- | --- |
| 1 | `18079 closed`, `18080 open` | `INITIAL_SCAN` | `18080` | 1 |
| 2 | `18079 closed`, `18080 open` | `NO_CHANGE` | `18080` | 1 |
| 3 | `18079 open`, `18080 open` | `NEW_PORT_DETECTED` | `18079, 18080` | 2 |
| 4, qua Telegram `/scan` | `18079 open`, `18080 open` | `NO_CHANGE` | `18079, 18080` | 2 |

Ở lượt 3, Discord embed ghi đúng `127.0.0.1` và chỉ liệt kê `18079` trong
trường cổng mới. Báo cáo HTML ghi Nmap TCP Connect, còn Markdown ghi
`NEW_PORT_DETECTED`. Ở lượt 4, ChatOps gọi tiến trình scanner thật, đọc lại
state cũ và báo cả hai cổng đang mở. Exit code của cả bốn lượt là `0`.

Bộ `scanner/tests` kiểm tra thêm nội dung sự kiện qua cả Discord và Telegram
với hàm gửi mô phỏng, xử lý XML, bảo toàn baseline khi Nmap hết hạn, và xử lý
cổng chưa xác định. Xem [hướng dẫn kiểm thử](../../../scanner/README.md).

- Windows: 61/61 kiểm thử scanner pass với Python 3.13.7 và Nmap 7.993.
- Container Ubuntu 24.04: 61/61 pass với Python 3.12.3 và Nmap 7.94SVN dưới
  user không đặc quyền. `systemd-analyze verify` pass cho cả service và timer.
- `dev ports` trên bản trích xuất sạch của commit `e1228e1` chạy Nmap, thoát với
  mã `0` và ghi audit cho `127.0.0.1` với `scanner: "nmap"`.

## Lượt gửi đến Discord và Telegram thật

Người dùng xác nhận hai đích đã cấu hình được phép nhận tin thử cho `127.0.0.1`.
Chạy lúc 19:33 ngày 2026-11-27 (UTC+7) trên revision `a1f6fd2` với baseline mới.

| Lượt | Kết quả Nmap | Sự kiện | Tin mới được API xác nhận |
| --- | --- | --- | --- |
| 1 | `18079 closed`, `18080 open` | `INITIAL_SCAN` | Discord 1, Telegram 1 |
| 2 | `18079 closed`, `18080 open` | `NO_CHANGE` | 0 |
| 3 | `18079 open`, `18080 open` | `NEW_PORT_DETECTED` | Discord 1, Telegram 1 |
| 4 | `18079 open`, `18080 open` | `NO_CHANGE` | 0 |

Cả bốn tin có mã tin do API trả về với HTTP 200. Mỗi cặp tin mang cùng mã
sự kiện và IP đích. Cặp cảnh báo cổng mới chỉ liệt kê `18079` trong mục thay
đổi. Bốn lượt có exit `0` và không còn tin chờ gửi. Các phản hồi gốc, baseline
và báo cáo nằm trong thư mục `.local/reports/nmap-live-580sx0v0` của máy chạy thử.

VM Ubuntu thật, reboot và phép đo từ bên ngoài vào EC2 được theo dõi trong
#35, #36 và #43.
