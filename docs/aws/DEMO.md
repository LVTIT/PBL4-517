# EC2 demo runbook — điểm bắt đầu

Trang này chỉ là **mục lục** tới các tài liệu EC2/AWS canonical. Nó không thay
thế kiểm chứng runtime, evidence có ngày/revision hoặc human review. Không suy ra
hạ tầng đang chạy chỉ vì tài liệu tồn tại.

| Muốn làm | Đọc |
| --- | --- |
| Tạo/khởi động EC2, kiểm tra trạng thái ban đầu | [ec2-launch.md](ec2-launch.md) |
| Cấu hình Ubuntu, Nginx, PostgreSQL, Node.js | [ec2-web-environment.md](ec2-web-environment.md) |
| Kiểm tra network/Security Group/NACL | [network-control-plane.md](network-control-plane.md) |
| Triển khai source, rollback và kiểm tra sau deploy | [ec2-deployment-review.md](ec2-deployment-review.md) |
| HTTPS bằng IP/EIP, certificate và renewal | [ec2-eip-https.md](ec2-eip-https.md) |
| Chạy website như Linux service | [linux-service-review.md](linux-service-review.md) |
| Thiết kế Application Load Balancer (đề xuất) | [alb-design.md](alb-design.md) |

## Nguyên tắc khi demo trên EC2

1. Chỉ thao tác trên tài nguyên do nhóm sở hữu hoặc được cấp phép rõ ràng.
2. Security Group chỉ mở SSH cho IP quản trị `/32`; không mở PostgreSQL, Redis
   hay backend thô ra Internet.
3. Trước khi kết luận "đã vá", đối chiếu cả source, cấu hình mạng, listener và
   kết quả quét lại; port `timeout/filtered` không chứng minh cổng đã đóng.
4. Ghi revision, thời điểm, lệnh đã chạy và giới hạn của lần kiểm chứng.
5. Gỡ listener/rule lab sau khi thử; không dùng dữ liệu thật hoặc credential
   production cho demo local.

Runbook demo local và các bài OWASP nằm ở
[`scripts/demo/README.md`](../../scripts/demo/README.md) và
[`scripts/demo/MANUAL.md`](../../scripts/demo/MANUAL.md).
