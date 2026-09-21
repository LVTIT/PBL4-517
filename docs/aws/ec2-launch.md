# EC2 Launch - Issue #6

Ngày kiểm chứng: **2026-09-21**. Phạm vi: EC2 Linux, SSH và trang mặc định Nginx; chưa triển khai website.

**Trạng thái: Completed / CLOSED (2026-09-21).** EC2 Ubuntu 24.04 đã được triển khai và kiểm chứng; toàn bộ Definition of Done PASS, đủ screenshot/output thực tế. Human review đã hoàn thành, [PR #25](https://github.com/LVTIT/PBL4-517/pull/25) đã merge cùng evidence và [Issue #6](https://github.com/LVTIT/PBL4-517/issues/6) đã CLOSED; không còn blocker thuộc Issue #6. [Evidence và nguồn kết quả](../../evidence/AWS-02/README.md) được giữ nguyên như hồ sơ tại thời điểm kiểm chứng; ghi chú chờ review trong hồ sơ cũ không còn là trạng thái hiện tại.

## Environment

| Thuộc tính | Giá trị đã xác minh |
| --- | --- |
| Name | `pbl4-517-web` |
| Region | Singapore — `ap-southeast-1`, người dùng đã chốt |
| OS | Ubuntu Server 24.04.4 LTS, `x86_64` |
| Instance type | `t3.micro` |
| Security Group | `launch-wizard-1` |
| Public IPv4 tại thời điểm kiểm tra | `47.129.214.70` |
| Private IPv4 | `172.31.11.224` |
| SSH user | `ubuntu` |
| Nginx | `1.24.0 (Ubuntu)` theo HTTP response |

Instance dùng VPC/subnet mặc định và Public IPv4 tự cấp, không có Elastic IP theo Console. Public IP dùng để truy cập từ Internet, có thể đổi khi stop/start; Private IP dùng trong VPC. Đã đối chiếu Private IP trong `hostname -I`, `ip addr` và Console. Định danh instance/VPC/subnet nằm trong screenshot Console, không lặp lại ở đây.

Private key được giữ trên máy cá nhân ngoài repository. Không chia sẻ private key; khi cần thêm thành viên, dùng public key riêng và rule SSH theo IP của từng người. IP nguồn thay đổi thì cập nhật rule `/32` tương ứng.

## Network

| Inbound | Source | Ghi chú |
| --- | --- | --- |
| TCP 22 — SSH | My IP, một Public IPv4 `/32` | Đã xác minh trong screenshot SG; không mở toàn Internet |
| TCP 80 — HTTP | `0.0.0.0/0` | Phục vụ trang mặc định Nginx |
| TCP 443 — HTTPS | `0.0.0.0/0` | Người dùng chủ động giữ rule; chưa cấu hình TLS, không có listener 443 trong output `ss` |
| TCP 3000, 5432, 8080 | Không có rule cho phép | Không có listener tương ứng trong output `ss` |

Console không có IPv6 public; không thêm rule inbound IPv6. `ss` hiển thị listener `[::]:22` và `[::]:80` không có nghĩa các cổng đó truy cập được qua IPv6 Internet. Tương tự, listener `0.0.0.0:22` vẫn chịu giới hạn nguồn của SG.

## Verification

| Kiểm tra | Kết quả | Bằng chứng |
| --- | --- | --- |
| EC2 Running | PASS | Console instance summary |
| Status checks | PASS | System, Instance, EBS đều `Check passed` (3 checks trên Console thực tế) |
| SSH từ Windows | PASS | Terminal đăng nhập và `whoami` trả `ubuntu` |
| Ubuntu 24.04 / x86_64 | PASS | `/etc/os-release`, `uname -a` |
| Public / Private IP | PASS | Console, kết nối SSH và output mạng Linux |
| Nginx active / enabled | PASS | `systemctl` trả `active`, `enabled` |
| Port 80 listening | PASS | `ss` hiển thị Nginx trên `0.0.0.0:80`, `[::]:80` |
| HTTP local | PASS | `curl -I http://127.0.0.1` trả `200 OK` |
| Browser Public IP | PASS | Trang `Welcome to nginx!` tại `http://47.129.214.70` |
| External scanner | PASS | `22,80 OPEN`; `3000,5432 FILTERED` |

Người dùng thực hiện AWS Console, SSH, cài Nginx và browser test; agent đối chiếu screenshot/output đã cung cấp. Agent chạy scanner thật từ workspace Windows bên ngoài EC2 bằng lệnh:

```sh
python scanner/scan.py 47.129.214.70 --ports 22,80,3000,5432
```

Scanner mặc định timeout 1 giây; `FILTERED` là phân loại của prototype, không tự chứng minh nguyên nhân chặn. Kết luận không mở public các port backend/database còn dựa trên SG và listener thực tế. Không quét host ngoài phạm vi nhóm sở hữu.

## Các bước đã thực hiện

1. Launch một EC2 Ubuntu 24.04 x86_64 tại Singapore, chọn key pair và bật Public IPv4.
2. Giới hạn SSH theo My IP; mở HTTP. Rule 443 được giữ theo yêu cầu riêng của người dùng.
3. Kiểm tra fingerprint ED25519 từ system log trước khi tiếp tục xác thực SSH. Lần đầu kết nối bị đóng; lần kết nối lại thành công. Chưa xác định nguyên nhân lần đóng đầu tiên.
4. Xác minh user, OS, mạng, ổ đĩa và RAM. Cài Nginx qua APT; output sau cài xác nhận dịch vụ hoạt động.
5. Kiểm tra listener, HTTP local, browser ngoài EC2 và scanner.

## Useful commands

Trên máy Windows, thay đường dẫn key bằng đường dẫn thật ngoài repo và lấy Public IP hiện tại từ Console:

```sh
ssh -i "C:\path\outside-repo\pbl4-517-key.pem" ubuntu@47.129.214.70
```

Trong phiên SSH:

```sh
whoami
hostname
uname -a
cat /etc/os-release
hostname -I
ip addr
ip route
df -h
free -h
sudo apt update
sudo apt install nginx -y
sudo systemctl status nginx --no-pager
sudo systemctl is-active nginx
sudo systemctl is-enabled nginx
sudo ss -tulpn
curl -I http://127.0.0.1
sudo journalctl -u nginx --no-pager -n 50
```

Chỉ chạy bước cài sau khi `apt update` thành công. Nếu Nginx chưa chạy hoặc chưa được enable, dùng `sudo systemctl enable --now nginx`, rồi kiểm tra lại. Lệnh journal ở trên phục vụ chẩn đoán, chưa được dùng làm evidence trong lần kiểm thử này.

## Remaining work

- Human review đã hoàn thành; PR #25 đã merge và Issue #6 đã CLOSED ngày 2026-09-21. Không còn blocker thuộc Issue #6.
- Mini lab tạm gỡ rule HTTP: **chưa thực hiện**, tùy chọn; cần người dùng đồng ý trước khi thay rule và phải khôi phục sau lab.

Node/PostgreSQL và thư mục deploy đã được chuẩn bị, kiểm chứng sau đó trong [Issue #12 — EC2 Web Environment](ec2-web-environment.md). Deploy React/Express, reverse proxy `/api`, backend systemd, HTTPS và ALB vẫn thuộc các issue sau. SG cho phép 443 không đồng nghĩa HTTPS đã được triển khai. Các giá trị OS/IP/SG ở hồ sơ #6 phía trên là tại thời điểm launch; xem tài liệu #12 cho trạng thái sau nâng cấp và đổi IP quản trị.
