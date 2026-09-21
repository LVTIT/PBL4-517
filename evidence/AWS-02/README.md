# AWS-02 evidence — Issue #6

Ngày thực nghiệm: **2026-09-21**. [Tài liệu môi trường và kiểm chứng](../../docs/aws/ec2-launch.md).

Screenshot là ảnh thật do người dùng cung cấp, được lưu nguyên bản; không dựng lại màn hình. Ảnh Console đã được người dùng cắt bỏ account ID/ARN trước khi lưu. Private key, credential và ảnh Console còn account ID không được đưa vào thư mục này.

| File | Nội dung / nguồn |
| --- | --- |
| [01-ec2-running.png](01-ec2-running.png) | Console: tên instance, Running, instance type và IP |
| [01-status-checks.png](01-status-checks.png) | Console: System, Instance, EBS đều Check passed |
| [02-security-group.png](02-security-group.png) | Console: đầy đủ ba inbound rules 22, 80, 443; SSH theo `/32` |
| [03-ssh-success.png](03-ssh-success.png) | Terminal Windows kết nối EC2; `whoami` trả `ubuntu` |
| [04-private-public-ip.png](04-private-public-ip.png) | Cùng ảnh Console với `01-ec2-running.png`, giữ thêm tên theo checklist IP |
| [05-nginx-status.png](05-nginx-status.png) | Terminal: Nginx active/running và enabled |
| [05-nginx-status-output.md](05-nginx-status-output.md) | Output `systemctl` do người dùng dán: active/running, enabled |
| [06-ss-ports.png](06-ss-ports.png) | Terminal: listener 22/80 và HTTP local 200 OK |
| [06-ss-http-output.md](06-ss-http-output.md) | Output `ss` và HTTP local do người dùng dán: listener 22/80, HTTP 200 |
| [07-browser-nginx.png](07-browser-nginx.png) | Browser ngoài EC2: Public IP và trang Welcome to nginx |
| [08-external-scanner.txt](08-external-scanner.txt) | Agent chạy `scanner/scan.py` thực tế từ Windows ngày 2026-09-21: 22/80 OPEN, 3000/5432 FILTERED |
| [09-linux-output.md](09-linux-output.md) | Output OS, kernel, hostname, IP/route, đĩa và RAM do người dùng dán |

Các file `*-output.md` giữ nguyên nội dung tin nhắn và ký tự escape Markdown; không phải log agent chạy lại. Riêng dòng curl trong tin nhắn được chat định dạng thành link; lệnh chạy đúng được ghi trong tài liệu AWS. Không dùng các file này như script.

**Đã đủ screenshot theo danh sách yêu cầu**, gồm ảnh Nginx/port bổ sung lúc 09:43 UTC. Mini lab tạm gỡ HTTP chưa thực hiện (tùy chọn). Issue #6 giữ OPEN để human review; xem checklist hiện tại trên [GitHub](https://github.com/LVTIT/PBL4-517/issues/6).
