# EC2 Web Environment — Issue #12

**Implemented / verified ngày 2026-09-21 UTC: EC2 ready to receive website source for Issue #14.** Kết quả runtime/filesystem do agent kiểm tra trực tiếp qua SSH; SG theo xác nhận người dùng, đối chiếu metadata/listeners/external checks. [Evidence và giới hạn kiểm chứng](../../evidence/AWS-03/README.md).

## Environment

| Thuộc tính | Giá trị |
| --- | --- |
| Name / hostname | `pbl4-517-web` / `ip-172-31-11-224` |
| Region / type | `ap-southeast-1` (Singapore) / `t3.micro` |
| OS / architecture | Ubuntu Server **24.04.5 LTS**, `x86_64` |
| Kernel sau reboot | `7.0.0-1012-aws` |
| SSH user | `ubuntu` |
| Public / private IPv4 | `47.129.214.70` / `172.31.11.224` tại thời điểm kiểm tra |
| RAM / swap / đĩa | Khoảng 909 MiB RAM, chưa có swap, `/` còn 3.8 GiB |

Issue #6 đã CLOSED, PR #25 đã merge cùng [hồ sơ launch](ec2-launch.md). OS lúc launch là 24.04.4; sau nâng cấp package trong #12 thành 24.04.5, vẫn giữ major/LTS Accepted. Người dùng reboot có kiểm soát, SSH lại và kiểm chứng Nginx. Lần kiểm tra cuối không còn package chờ upgrade, lỗi `dpkg --audit` hay marker yêu cầu reboot. Chưa chạy build website để đánh giá nhu cầu RAM/đĩa ở #14.

## Installed components

| Thành phần | Phiên bản đã xác minh | Nguồn |
| --- | --- | --- |
| Git | 2.43.0 | Ubuntu APT |
| curl | 8.5.0, package 8.5.0-2ubuntu10.13 | Ubuntu APT |
| ca-certificates | 20260601~24.04.1 | Ubuntu APT |
| Node.js | v24.21.0 (`/usr/bin/node`) | NodeSource `node_24.x`, package 24.21.0-1nodesource1 |
| npm | 11.19.0 (`/usr/bin/npm`) | Đi kèm NodeSource Node.js |
| PostgreSQL server / psql | 16.15, Ubuntu 16.15-0ubuntu0.24.04.1 | Ubuntu Noble APT |
| Nginx | 1.24.0 (Ubuntu) | Giữ cài đặt từ #6, cập nhật qua APT |

Express 5, TypeScript, React/Vite và Prisma 7 là dependency source website, sẽ cài theo lockfile khi deploy #14. Không cài global hoặc copy node_modules từ Windows. Stack không thay đổi.

## Services

- Nginx **active / enabled**, `nginx -t` PASS; vẫn phục vụ trang mặc định, local HTTP và Public IP HTTP đều **200 OK**.
- PostgreSQL cluster **16/main online**, `postgresql@16-main` **active (running)**, truy vấn local trả PostgreSQL 16.15. `postgresql` enabled, `start.conf=auto`; chưa reboot thêm sau cài PostgreSQL.
- PostgreSQL `listen_addresses=localhost`, listener thực tế chỉ **127.0.0.1:5432**. `pg_isready` qua TCP local trả accepting connections.
- Chưa tạo `pbl517_app`, database ứng dụng, DATABASE_URL, migration hay seed. Chuyển sang #14 cùng source và credential riêng; không dùng password demo production.

## Directory

**`/var/www/pbl4-517`**, owner/group **`ubuntu:ubuntu`**, mode **`0755`** (`drwxr-xr-x`). Owner được đọc/ghi/truy cập; group và người khác chỉ đọc/truy cập thư mục. Agent đã thử tạo/ghi/đọc/xóa file với user ubuntu; thư mục cuối cùng rỗng, sẵn sàng nhận source.

Không dùng `chmod 777` hay đổi quyền đệ quy trên `/var/www`. Quyền này dành cho thư mục clone/build; secret ứng dụng ở #14 phải có quyền riêng phù hợp, không suy ra từ mode của thư mục gốc.

## Network

SG gắn với instance: **launch-wizard-1** theo IMDSv2. Người dùng xác nhận toàn bộ inbound rules hiện tại:

| Port | SG Source | Listener / ý nghĩa |
| --- | --- | --- |
| 22/TCP | `171.225.185.22/32` | SSH trên IPv4/IPv6 wildcard; SG giới hạn một IP quản trị |
| 80/TCP | `0.0.0.0/0` | Nginx HTTP public, kiểm tra ngoài EC2 200 |
| 443/TCP | `0.0.0.0/0` | Rule được giữ; **TLS chưa cấu hình**, không có listener |
| 3000/TCP | Không có rule cho phép | Chưa chạy backend |
| 5432/TCP | Không có rule cho phép | PostgreSQL chỉ local loopback |
| 8080/TCP | Không có rule cho phép | Không listener |

SSH từng timeout vì SG còn cho IP cũ `117.3.54.230/32`; sau sửa về IP hiện tại đã truy cập được. Khi IP quản trị đổi, cập nhật đúng `/32` thay vì mở SSH toàn Internet.

Không có IPv6 global trong interface, metadata Public IPv6 không tồn tại. UFW inactive. Các listener local 53/323 phục vụ DNS/thời gian, UDP 68 trên private interface phục vụ DHCP; không phải port ứng dụng public.

Phân biệt listener Linux với SG: `ss` không cho biết Internet có được phép truy cập. Agent không có AWS API/Console; SG PASS dựa trên [xác nhận người dùng](../../evidence/AWS-03/08-security-group.md), kết hợp metadata, listener và scanner. Scanner từ Windows trả 22/80 OPEN, 3000/5432/8080 FILTERED; không coi timeout là bằng chứng độc lập về nguyên nhân chặn.

## Verification

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Ubuntu 24.04, SSH, network identity | PASS | [00](../../evidence/AWS-03/00-environment.txt), [08 metadata](../../evidence/AWS-03/08-instance-network-metadata.txt) |
| Package update, reboot hoàn tất | PASS | [01](../../evidence/AWS-03/01-apt-update.txt) |
| Git, Node.js 24, npm, curl, CA | PASS | [02](../../evidence/AWS-03/02-node-tools.txt) |
| PostgreSQL 16, local query | PASS | [03](../../evidence/AWS-03/03-postgresql-version.txt) |
| PostgreSQL service, local-only listener | PASS | [04](../../evidence/AWS-03/04-postgresql-service.txt) |
| Nginx syntax, active/enabled, HTTP local | PASS | [05](../../evidence/AWS-03/05-nginx-check.txt) |
| Deploy directory, permissions, write test | PASS | [06](../../evidence/AWS-03/06-deploy-directory.txt) |
| Listener 22/80 và database loopback | PASS | [07](../../evidence/AWS-03/07-listening-ports.txt) |
| SG: SSH restricted, HTTP public, 3000/5432/8080 không public | PASS — nguồn người dùng xác nhận | [08 SG](../../evidence/AWS-03/08-security-group.md) |
| Kiểm tra ngoài EC2 | PASS trong phạm vi test | [09 scanner](../../evidence/AWS-03/09-external-scanner.txt), [10 HTTP](../../evidence/AWS-03/10-external-http.txt) |
| Evidence thật đã lưu | PASS | [Index, nguồn và giới hạn](../../evidence/AWS-03/README.md) |

## Các lệnh đã dùng

Chạy từng stage trên EC2 Bash, kiểm tra output trước khi tiếp tục. Đây là ghi chép quá trình; không chạy lại cài đặt nếu version/service đã đúng.

```bash
sudo apt update
sudo apt upgrade -y
sudo apt update
cat /var/run/reboot-required
cat /var/run/reboot-required.pkgs
# Chỉ reboot sau khi đã báo người dùng; sau đó SSH lại và kiểm tra Nginx.
sudo reboot
```

Git/curl/CA có sẵn, không cài lại. Node lúc đầu chưa có; dùng [NodeSource distributions](https://github.com/nodesource/distributions/blob/master/DEV_README.md), kiểm tra Candidate 24.x trước cài:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x -o nodesource_setup_24.sh &&
sudo bash nodesource_setup_24.sh
apt-cache policy nodejs
sudo apt install -y nodejs
node --version
npm --version
```

PostgreSQL lúc đầu chưa có. Gói `postgresql-client-common` riêng lẻ không đủ; đã cài server và client đúng major từ kho Ubuntu:

```bash
sudo apt install -y postgresql-16 postgresql-client-16
psql --version
pg_lsclusters
sudo systemctl status postgresql@16-main --no-pager
sudo -u postgres psql -X -c "SELECT version();"
sudo -u postgres psql -X -c "SHOW listen_addresses;"
sudo ss -ltnp '( sport = :5432 )'
```

Thư mục và Nginx:

```bash
sudo install -d -o ubuntu -g ubuntu -m 0755 /var/www/pbl4-517
ls -ld /var/www/pbl4-517
nginx -v
sudo nginx -t
systemctl is-active nginx
systemctl is-enabled nginx
curl -I http://127.0.0.1
sudo ss -tulpn
```

Các lệnh kiểm tra bổ sung và output chính xác nằm trong evidence text. Không đưa lệnh tạo app database hoặc deploy source vào #12; setup website canonical ở [website/README.md](../../website/README.md).

## Remaining work

- **#14:** nhận source, dependency/build trên Linux, database/user/secret ứng dụng, migrations và Nginx frontend/API. Giữ `VULN_IDOR_ENABLED=false`. Đánh giá tài nguyên khi build.
- **#15:** systemd backend production.
- **#16:** verify website deployment từ bên ngoài sau deploy; các kiểm tra hạ tầng #12 không thay thế #16.
- **#10:** Ninh tiếp tục scanner; không đóng hoặc triển khai thay trong task này.
- OWASP scenario mới để giai đoạn sau. HTTPS/domain/ALB/alerts ngoài phạm vi #12.

Trạng thái GitHub/PR hiện tại được duy trì ở [CURRENT_STATUS.md](../../wiki/CURRENT_STATUS.md).
