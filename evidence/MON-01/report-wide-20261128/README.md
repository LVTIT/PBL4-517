# Kiểm chứng giao diện báo cáo quét cổng

Ngày 2026-11-28, Refs #35. Scanner trên Windows dùng Nmap với `127.0.0.1` và
baseline riêng. Bộ `python -m unittest discover -s scanner/tests -q` pass 66/66.

Kịch bản trình diễn hiện tại dùng [website KEVILO local](../website-demo-20261128/README.md).

| Ca thử | Kết quả |
| --- | --- |
| Lập mốc | Nmap kết nối được `18080/tcp`. HTML nêu mốc vừa lưu. |
| Có cổng mới | Nmap kết nối thêm `18079/tcp`. Hàng thay đổi nằm đầu bảng. `18080/tcp` là cổng đã mở từ trước, `18081/tcp` bị từ chối kết nối. Hai cổng mở giữ điểm `LOW · 3.5/10` và dùng chung hướng dẫn. |
| Không thay đổi | Nmap giữ nguyên hai cổng mở. Báo cáo nêu không ghi nhận thay đổi. |
| Vừa mở và vừa đóng | Nmap thấy `18081/tcp` mới mở và xác nhận `18080/tcp` đã đóng. Hai mã sự kiện khớp audit. |
| Chưa xác định | Giả lập Nmap trả `filtered` cho `18081/tcp`. HTML ghi rõ trạng thái và chưa đủ dữ liệu so sánh. |
| Lỗi quét | Dùng đường dẫn Nmap thiếu executable. HTML hiện nguyên nhân lỗi, hướng dẫn kiểm tra và giữ nguyên hash của baseline. |

Chrome mở sáu trạng thái ở `1920×1080`, `1366×768`, `1093×615`, `844×390`,
`390×844` và `320×720`, không tràn ngang. Mẫu cổng mới hiển thị kết luận, bảng,
việc cần kiểm tra và mã sự kiện trong khung nhìn đầu tiên ở cả ba kích thước
desktop. Nút in hoạt động bằng bàn phím. Sáu lượt axe kiểm tra mẫu cổng mới,
chưa xác định và lỗi ở hai kích thước không báo lỗi WCAG A/AA trong phạm vi đo.

Đã render và đọc lại bốn bản in một trang A4 từ Chrome gồm cổng mới, mở/đóng
cùng lượt, chưa xác định và lỗi. Bản in xếp nội dung theo chiều dọc và giữ các
nhãn trạng thái.

Đã gọi luồng gửi báo cáo của bot cho mẫu `127.0.0.1` trong chat thử được duyệt.
Bot API xác nhận cả hai file. Tải lại, đối chiếu SHA-256 và mở chính HTML nhận
từ Telegram ở `1920×1080`, `1366×768` và `390×844`. Lần gửi này gọi trực tiếp hàm
gửi báo cáo. Kiểm thử tự động kiểm tra riêng việc nút **Báo cáo** gọi đúng lệnh.

Mẫu HTML, ảnh và bản in lưu local dưới `.local/reports/report-wide-20261128/`.
[Cách chạy scanner](../../../scanner/README.md).
