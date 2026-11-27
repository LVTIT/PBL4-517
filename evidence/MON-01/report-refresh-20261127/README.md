# Kiểm chứng báo cáo scanner và Telegram

Ngày 2026-11-27, Refs #35. Phạm vi là Windows local với Nmap 7.993 và Chrome
qua Playwright. Scanner chạy trên `127.0.0.1` với file baseline riêng.

| Ca thử | Kết quả |
| --- | --- |
| Khởi tạo với `18080` | Nmap đo thật. Discord và Telegram xác nhận tạo tin baseline. Mã sự kiện khớp với audit. |
| Quét lại | Nmap đo thật, ghi `NO_CHANGE` và không có tin mới. |
| Bật thêm `18079` | Nmap đo thật, HTML ghi **Mở mới 18079/tcp**. Mã sự kiện khớp giữa HTML, audit, Discord và Telegram. |
| Vừa mở và vừa đóng | Nmap đo thật. HTML và audit cùng ghi mở `18081` và đóng `18080` trong một lượt. |
| Chưa xác định | Mô phỏng kết quả Nmap `filtered` cho `18081`. Scanner thoát mã 1, giữ cổng từng mở trong baseline, HTML và Markdown ghi chưa xác định. |
| Nmap lỗi | Chạy với đường dẫn executable không tồn tại. Scanner thoát mã 2, giữ nguyên hash của baseline và xuất báo cáo lỗi. |

Bộ `scanner/tests` pass 64/64. Hai chiều lỗi gửi thiếu file HTML hoặc Markdown
được mô phỏng. Kiểm thử xác nhận nút Báo cáo trả phản hồi trước khi gửi file.

Chrome mở cả sáu báo cáo tại 1440, 390 và 320 px, xác minh kết luận nằm trong
khung nhìn và không tràn ngang. Bảng có bốn cột. Nút in nhận focus bàn phím.
Chrome in A4 ba báo cáo gồm mở/đóng, chưa xác định và lỗi. Mỗi báo cáo mẫu ra
một trang, giữ đầy đủ nhãn trạng thái cần đọc. Kiểm tra văn bản PDF và ảnh
render để xác minh kết quả.

Báo cáo và bản kiểm tra Chrome lưu trên máy ở `.local/reports/report-refresh-6nkvo5eq`.
Cài đặt và chạy lại theo [README scanner](../../../scanner/README.md).
