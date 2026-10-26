# KEVILO: demo trên một EC2 — Refs #44

Đích demo: **web đã deploy qua HTTPS**, ví dụ `https://13.251.128.130`.
Windows chạy Python/trình duyệt bên ngoài AWS; Ubuntu EC2 chạy Nginx, FE/BE,
PostgreSQL và systemd. Không cần máy Ubuntu thứ hai.

## 1. Chuẩn bị release trên EC2

1. Chọn commit đã qua CI, human review và merge. Build từ checkout sạch đúng SHA
   trên Linux theo [website README](../../website/README.md#build). Sao lưu database,
   cấu hình riêng tư và release cũ; ghi đường dẫn rollback. Chuyển FE/dist, BE/dist
   và dependency cùng release, giữ `release.json` trong hai dist. Không copy
   node_modules Windows lên Linux. Không chạy development seed trên EC2.
2. Kiểm tra đường dẫn thực tế bằng `systemctl cat pbl4-backend` và cấu hình Nginx
   trong terminal riêng tư. Giữ HTTPS, API 3000/DB 5432 loopback và không mở SG hai cổng.
   Tạo DB `kevilo_lab` trên cùng EC2, thuộc application role không phải superuser.
   Giữ DB cũ để rollback; đổi DATABASE_URL lab sang DB mới, migrate.
3. Nạp catalog: `npm run catalog:import` để xem dry-run, sau khi kiểm tra dùng
   `npm run catalog:import -- --apply`. Canonical: website README.
4. Trong nguồn env **thực sự được service đọc**, giữ secret riêng và cấu hình:

   ```dotenv
   NODE_ENV=production
   TRUST_PROXY=loopback
   APP_PROFILE=lab
   LAB_DATA_ACK=synthetic-only
   VULN_IDOR_ENABLED=false
   VULN_SQLI_ENABLED=false
   VULN_XSS_ENABLED=false
   VULN_AUTH_ENABLED=false
   ```

   Profile production mặc định từ chối cờ true. Lab không tự giới hạn mạng: trong
   buổi khai thác, giới hạn HTTPS cho IP nhóm/máy quét bằng SG/Nginx; giữ đường quản
   trị và renewal TLS hợp lệ. Chỉ dùng dữ liệu/credential giả trong DB lab.
5. Trên EC2: `mkdir -p ~/.local/kevilo-demo`, `chmod 700 ~/.local/kevilo-demo`.
   Tại backend release, nạp **cùng env như service**, chạy:

   ```sh
   npm run lab:fixtures -- --output "$HOME/.local/kevilo-demo/run1.json"
   sudo systemctl restart pbl4-backend
   systemctl is-active pbl4-backend
   curl --fail --silent --show-error https://13.251.128.130/api/health
   ```

   Manifest chứa owner/attacker/admin với mật khẩu ngẫu nhiên, sản phẩm, đơn PENDING
   và review XSS vô hại. Không commit/chụp manifest vào evidence. Công cụ từ chối ghi
   đè; dùng tên run mới khi diễn tập mới. Tên DB cần segment `lab`; đây chỉ là guard
   vận hành, không chứng minh DB không có dữ liệu thật.

Đổi env cần restart, API gián đoạn ngắn, không hot reload. systemd Environment hoặc
EnvironmentFile ưu tiên hơn dotenv. Nếu startup fail, xem journal riêng tư, rollback
cấu hình/release tốt; không đổi NODE_ENV để lách guard. Không tự bật CD.

## 2. Chuẩn bị Windows và xác minh FE/BE

Tại gốc repo cần Python 3 và Node 24. Python dùng standard library; XSS dùng Playwright.
SSH/scp thêm `-i <key>` nếu cần. Không chia sẻ key hoặc manifest.

```powershell
npm.cmd --prefix website/frontend ci
npm.cmd --prefix website/frontend exec -- playwright install chromium
New-Item -ItemType Directory -Force .local/demo | Out-Null
scp ubuntu@13.251.128.130:.local/kevilo-demo/run1.json .local/demo/run1.json
$target = 'https://13.251.128.130'
$fixture = '.local/demo/run1.json'
$revision = 'THAY_BANG_SHA_40_KY_TU_DA_DUYET'
python scripts/attacker/demo.py --scenario release --url $target --revision $revision
```

Dùng IP hiện tại trong AWS; đổi IP cần kiểm tra lại TLS/cấu hình. Không bỏ xác minh
chứng chỉ. Release check yêu cầu FE/BE cùng SHA sạch, DB healthy và tải đối chiếu hash
từng file frontend. Metadata backend đọc khi khởi động; operator đối chiếu thêm
BE/dist với manifest trên EC2. Metadata không chống giả mạo máy chủ. Dirty build
hoặc thiếu metadata không PASS. Reload trình duyệt không cache, đối chiếu bundle.

Tại gốc repo trên EC2, kiểm tra đúng thư mục mà service/Nginx đang dùng (thay đường
dẫn nếu deploy sang release directory):

```sh
node scripts/release/verify-local.mjs website/backend/dist EXACT_TESTED_SHA
node scripts/release/verify-local.mjs website/frontend/dist EXACT_TESTED_SHA
```

## 3. Website bình thường — 3 phút

Giữ bốn cờ false. Owner tìm sản phẩm, thêm giỏ, đặt **đơn khác** và xem đơn.
Dùng phiên riêng cho attacker/admin để trình bày quản trị. Lấy tài khoản từ manifest
riêng tư; không sửa/hủy đơn fixture. Kiểm tra Secure/HttpOnly cookie và health.

## 4. Giám sát bên ngoài — 5 phút

Cấu hình token/webhook theo [scanner README](../../scanner/README.md).
Lệnh sau **gửi thông báo thật** về kênh nhóm khi người vận hành chạy:

```powershell
python scanner/scan.py 13.251.128.130 --ports 22,80,443,3000,5432,8080 --watch 15 --state-file .local/demo/demo.state.json --no-banner
```

- Dùng state mới lần đầu: lưu danh sách port và receipt Telegram/Discord.
- Chờ vòng không đổi: không sinh sự kiện mới. Retry thông báo chưa giao thành công
  có thể xuất hiện; phân biệt retry với sự kiện mới.
- SSH terminal riêng: `mkdir -p ~/.local/kevilo-empty`, rồi
  `python3 -m http.server 8080 --bind 0.0.0.0 --directory ~/.local/kevilo-empty`.
  SG chỉ cho 8080 từ IP máy quét `/32`. Quan sát cổng mới và hai receipt.
- Ctrl+C dừng listener, quét bằng kết nối mới, xóa SG 8080 rồi quét lần cuối.
  Timeout/filtered là **uncertain**, không đổi thành confirmed closed. Kèm `ss -lntp`
  và SG chứng minh đã gỡ listener/rule. Không mở API/DB để demo.
- Giữ state suốt vòng. Watch chạy khi terminal mở/Windows thức; sau reboot cần Task
  Scheduler riêng. Không coi là nghiệm thu Ubuntu VM của #35.

Scanner quan sát cổng; không phát hiện SQLi/IDOR/XSS hay tự báo từng HTTP attack.

## 5. Khai thác → phòng vệ → kiểm thử lại — 10–15 phút

Mỗi bài bật **một** cờ trên EC2, restart và xác nhận health. Chạy dòng vulnerable
từ Windows; sau đó tắt cờ, restart, chạy dòng secure. Cùng release, URL và fixture.
**Không chạy hai dòng liên tiếp khi chưa đổi cờ/restart ở giữa.**

```powershell
# VULN_IDOR_ENABLED: B đọc đơn A; A vẫn đọc được
python scripts/attacker/demo.py --scenario idor --url $target --fixture $fixture --revision $revision --expect vulnerable
python scripts/attacker/demo.py --scenario idor --url $target --fixture $fixture --revision $revision --expect secure

# VULN_SQLI_ENABLED: control dương/âm và cùng payload chỉ đọc
python scripts/attacker/demo.py --scenario sqli --url $target --fixture $fixture --revision $revision --expect vulnerable
python scripts/attacker/demo.py --scenario sqli --url $target --fixture $fixture --revision $revision --expect secure

# VULN_XSS_ENABLED: cùng review lưu sẵn, kiểm chứng Chromium
node scripts/attacker/xss.mjs --url $target --fixture $fixture --revision $revision --expect vulnerable
node scripts/attacker/xss.mjs --url $target --fixture $fixture --revision $revision --expect secure

# VULN_AUTH_ENABLED: đúng mật khẩu trước, 12 lần sai có giới hạn
python scripts/attacker/demo.py --scenario auth --url $target --fixture $fixture --revision $revision --expect vulnerable
python scripts/attacker/demo.py --scenario auth --url $target --fixture $fixture --revision $revision --expect secure
```

Auth để cuối: bộ đếm theo IP, không theo tab/incognito. Chờ 15 phút hoặc restart lab
trước mỗi pha để bắt đầu mới. Sau pha secure, đúng mật khẩu cũng có thể nhận 429.

XSS: mở `$target/products/<productId>` để trình bày. Marker chỉ đặt
`window.__pbl517_xss_probe=1`, không lấy cookie/gửi dữ liệu. Tắt cờ thì cùng chuỗi đã
lưu hiện như văn bản. Không xóa review để giả lập vá; CLI kiểm chứng DOM/marker.

Nâng cao: thay `idor` bằng `idor-update` hoặc `idor-cancel`. Sau vulnerable, tắt cờ,
tạm dừng thao tác fixture, tại backend EC2:

```sh
npm run lab:fixtures -- --reset-order "$HOME/.local/kevilo-demo/run1.json"
sudo systemctl restart pbl4-backend
```

Reset xác minh owner/sản phẩm/run/item/trạng thái, phục hồi chỉ đơn lab và stock trong
transaction; giữ ID và review XSS. Chạy cùng payload ở secure. CANNOT_CANCEL/400 do
đơn đã hủy không chứng minh chặn IDOR. Không reset đồng thời với thao tác nhóm.

`exploit_idor*.py` và `exploit_sqli.py` gọi cùng bộ kiểm chứng, giờ cần
`--url --fixture --expect`; bỏ account/order/local URL mặc định và payload tùy ý cũ.

## 6. Kết quả và kết thúc

| Kết quả | Ý nghĩa | Exit code |
| --- | --- | --- |
| EXPLOIT_CONFIRMED | Quan sát hành vi lỗi trên fixture | 0 nếu đúng expect, ngược lại 1 |
| DEFENSE_VERIFIED | Control hợp lệ và phòng vệ đúng bài | 0 nếu đúng expect, ngược lại 1 |
| INCONCLUSIVE | TLS/login/CSRF/429 bất ngờ, outage hoặc fixture sai | 2 |
| RELEASE_VERIFIED | FE/BE đúng revision sạch, FE hash và health phù hợp | 0 |

Output JSON không chứa password/cookie/response cá nhân. Ghi stdout vào
`.local/demo/<scenario>-<phase>.json`, kiểm tra `$LASTEXITCODE`. Chỉ đưa báo cáo đã
rà soát vào evidence, không đưa manifest credential. Ghi SHA/URL/thời điểm/run ID,
cờ, trước/sau, control, receipt và hạn chế. 502/503 hoặc sai CSRF **không** là đã vá.
Tắt cờ chọn nhánh phòng vệ: khi trình bày giải thích query scoping, Prisma
parameterization, React escaping và rate limit.

Kết thúc: bốn cờ false, có thể trở lại APP_PROFILE=production, restart, kiểm tra
HTTPS/login/catalog/checkout; gỡ listener/SG 8080, giữ 3000/5432 không public.
Dùng OWASP Top10:2021 nhất quán (SQLi/XSS cùng A03). ALB/VPC/NACL/Linux logs và human
handoff cần evidence riêng; không tự tick từ một buổi demo web.

## Regression dành cho người phát triển

`python -m unittest discover -s scripts/attacker/tests -v` kiểm tra offline.
Backend `npm run test:config` kiểm tra profile; `npm run test:security` với DB lab
loopback dùng fixture thật, hai mode API, browser và các CLI này. Canonical ở
[website README](../../website/README.md). Regression local chưa là deploy/receipt AWS.
