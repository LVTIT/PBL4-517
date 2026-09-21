# AWS-03 evidence — Issue #12

Ngày thực nghiệm: **2026-09-21 UTC**. [Tài liệu canonical](../../docs/aws/ec2-web-environment.md).

Người dùng chạy các stage A–F theo hướng dẫn, cung cấp ảnh/output thật, nâng cấp Linux, reboot và cài runtime. Sau yêu cầu "bạn tự làm hết được không", agent SSH trực tiếp từ workspace Windows bằng key ngoài repository, xác minh lại môi trường, tạo thư mục deploy và thu output thật tại đây. Timestamp và exit code nằm trong từng file text. Agent không chạy lại upgrade/reboot hoặc cài lại runtime đã đạt.

| File | Nguồn / nội dung |
| --- | --- |
| [00-environment.txt](00-environment.txt) | SSH: user, hostname, OS sau nâng cấp, kernel, RAM/đĩa, IP và route |
| [01-apt-update.txt](01-apt-update.txt) | SSH: APT update thành công, không có package chờ nâng cấp, dpkg audit không báo lỗi, không còn yêu cầu reboot |
| [02-node-tools.txt](02-node-tools.txt) | SSH: Git/curl/CA, Node/npm và đường dẫn, nguồn package NodeSource 24.x |
| [03-postgresql-version.txt](03-postgresql-version.txt) | SSH: psql, truy vấn `SELECT version()`, listen_addresses, port |
| [04-postgresql-service.txt](04-postgresql-service.txt) | SSH: cluster 16/main online, service thực tế, autostart, pg_isready TCP và listener local |
| [05-nginx-check.txt](05-nginx-check.txt) | SSH: version, syntax test, active/enabled, HTTP local 200 |
| [06-deploy-directory.txt](06-deploy-directory.txt) | SSH: tạo thư mục 0755, owner/group, quyền đường dẫn; user ubuntu ghi/đọc/xóa file thử thành công; thư mục cuối cùng rỗng |
| [07-listening-ports.txt](07-listening-ports.txt) | SSH: toàn bộ listeners và UFW inactive |
| [08-instance-network-metadata.txt](08-instance-network-metadata.txt) | Agent đọc các trường IMDSv2 được chọn: Region/type/IP/SG name/IPv6; không lưu metadata token |
| [08-security-group.md](08-security-group.md) | Người dùng xác nhận ba inbound rules hiện tại; ghi rõ giới hạn kiểm chứng |
| [09-external-scanner.txt](09-external-scanner.txt) | Agent dùng scanner hiện có từ Windows: 22/80 OPEN, 3000/5432/8080 FILTERED |
| [10-external-http.txt](10-external-http.txt) | Agent curl Public IP từ Windows: HTTP 200 |

Output text thay cho screenshot, không dựng ảnh hay giả output. Chuẩn hóa line ending và khoảng trắng cuối dòng để lưu Git; không thay giá trị kết quả. Ảnh người dùng gửi trước đó vẫn ở cuộc hội thoại, không được tuyên bố đã lưu thành file trong thư mục này. Evidence AWS-02 được giữ nguyên.

Lần đầu script thu thập gặp CRLF từ Windows trước khi thực thi các lệnh kiểm tra; agent sửa cách truyền stdin thành bytes LF và thu lại output thành công. Các file text ở đây là các lần kiểm chứng thành công sau sửa lỗi công cụ; lỗi đó không phải lỗi EC2.

## Giới hạn

- OS ban đầu 24.04.4 ở AWS-02; sau `apt upgrade` và reboot của người dùng, lần kiểm tra này là **24.04.5 LTS**, kernel **7.0.0-1012-aws**. Vẫn đúng Ubuntu 24.04 LTS Accepted.
- RAM khoảng 909 MiB, không swap; ổ `/` còn 3.8 GiB tại thời điểm thu. Chưa kiểm chứng khả năng build website trên máy này.
- PostgreSQL query qua Unix socket thành công; `pg_isready` TCP local thành công. Chưa tạo app user/database/password, chưa kiểm chứng xác thực TCP bằng credential ứng dụng.
- PostgreSQL đã cài sau lần reboot Linux. Đã kiểm tra cấu hình autostart (`postgresql` enabled, cluster `start.conf=auto`); chưa reboot thêm để kiểm chứng PostgreSQL sau reboot.
- SG rules dựa trên người dùng xác nhận, không có screenshot SG mới hay output DescribeSecurityGroups. Chi tiết ở [bản ghi SG](08-security-group.md).
- Scanner chỉ hỗ trợ verification #12; không thay source hoặc hoàn thành thay Ninh Issue #10. Kết quả FILTERED không tự chứng minh rule SG.
- Chưa deploy website, reverse proxy API, systemd app service, HTTPS, ALB hoặc OWASP scenario mới. Không tạo credential ứng dụng.

Không chứa private key, AWS credential, token, cookie hoặc password production. Private key dùng SSH nằm ngoài repository.
