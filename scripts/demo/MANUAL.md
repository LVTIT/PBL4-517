# Học và demo local bằng tay — Refs #68, Related to #44

Hướng dẫn này dành cho người tự chạy từng terminal, sửa env, chạy script tấn công
và quan sát browser. “Chạy tay” không có nghĩa là bỏ script.
Không dùng `dev up/down` quản lý các server đang chạy tay. `dev setup` dùng trước
buổi; `dev reset-order` chỉ dùng khi đã dừng backend; `dev bot` quản lý riêng bot.
Không tự chạy server/probe khi chỉ đọc hướng dẫn. Các lệnh dưới đây để người học tự nhập.

**Đối chiếu source ngày 2026-11-10:** nhánh `feature/68-simple-local-demo`,
base `6c1167b`, có thay đổi chưa commit. Mô tả dưới đây bám **working tree hiện
tại**, gồm cả launcher chưa commit; không lấy evidence cũ làm kết quả chạy hôm
nay. Các đoạn code được ghi rõ là trích rút gọn; mở file được liên kết để xem
đủ validation, include và xử lý lỗi. Bản hướng dẫn này không xác nhận một lượt
demo runtime mới, CI của revision mới hay human review.

Đọc lần lượt: **0–1** chuẩn bị/đăng nhập → **2** đọc đơn → **3** sửa/hủy đơn →
**4** SQLi → **5** XSS → **6** auth → **7** scanner → **8–9** đối chiếu/kết thúc.
Mỗi bài cần đủ hai lượt: bật đúng một cờ → restart → đo lỗi → đọc code vá →
tắt cờ → restart → đo lại cùng request/dữ liệu. Luồng thường chỉ chạy lại cùng
lệnh, không cần chọn lượt trong terminal. `--expect secure|vulnerable` chỉ là
kỳ vọng tùy chọn cho automation/CI, giải thích ở mục bên dưới; nó không bật/tắt cờ.

### Bản đồ code dùng trong buổi demo

| Theo dõi điều gì | File và điểm cần tìm |
| --- | --- |
| Lệnh ngắn và câu hỏi terminal | [demo.cmd](../../demo.cmd) → [cli.py](cli.py): `prompt`, `command`, `main`; [report.py](report.py): `print_sections`, `render_markdown` |
| Fixture/tài khoản/reset đơn | [lab-fixtures.ts](../../website/backend/src/scripts/lab-fixtures.ts): `--local-accounts`, `--reset-order`; [reset wrapper](run.ps1) |
| Đọc flag và chặn cấu hình lab sai | [config.ts](../../website/backend/src/lib/config.ts): `environmentSchema`, `safeParse(process.env)` |
| Gắn `/api/`, routes, quyền và CSRF | [app.ts](../../website/backend/src/app.ts), [api-routes.ts](../../website/backend/src/routes/api-routes.ts), [auth-guard.ts](../../website/backend/src/middleware/auth-guard.ts), [csrf.ts](../../website/backend/src/middleware/csrf.ts) |
| IDOR đọc/sửa/hủy | [order-controller.ts](../../website/backend/src/controllers/order-controller.ts): `handleGetOrderById`, `handleUpdateOrderDetails`, `handleCancelOrder` → [order-service.ts](../../website/backend/src/services/order-service.ts) |
| SQLi và dữ liệu XSS | [product-service.ts](../../website/backend/src/services/product-service.ts): `listProductsWithRawSql`, `listProducts`, `getProductById`, `addReview` |
| Render XSS và tìm kiếm | [ProductDetailPage.tsx](../../website/frontend/src/pages/ProductDetailPage.tsx): `labUnsafeReviewHtml`; [ProductsPage.tsx](../../website/frontend/src/pages/ProductsPage.tsx): `handleSearchChange`, query URL |
| Browser gửi đơn/login và giữ session | [OrderDetailPage.tsx](../../website/frontend/src/pages/OrderDetailPage.tsx), [LoginPage.tsx](../../website/frontend/src/pages/LoginPage.tsx), [api.ts](../../website/frontend/src/services/api.ts), [session.ts](../../website/backend/src/middleware/session.ts) |
| Giới hạn đăng nhập | [auth-routes.ts](../../website/backend/src/routes/auth-routes.ts): `loginLimiter` |
| Engine dùng chung: HTTP, CSRF, trace, fixture, che dữ liệu | [core.py](../attacker/core.py): `Client`, `login`, `request`, `redact_evidence`, `summarize_order` |
| Tiêu chí PASS và evidence từng bài | [demo.py](../attacker/demo.py) chỉ dispatch; [probes/idor.py](../attacker/probes/idor.py), [probes/sqli.py](../attacker/probes/sqli.py), [probes/auth.py](../attacker/probes/auth.py), [probes/release.py](../attacker/probes/release.py); [xss.mjs](../attacker/xss.mjs) cho Chromium/DOM/marker |

Tìm symbol nhanh trong IDE bằng Ctrl+Shift+F; ví dụ tìm `updateOrderDetails`,
`$queryRawUnsafe`, `dangerouslySetInnerHTML`, `loginLimiter`. Không cần sửa source
trong lúc chuyển lượt: bản vá đã có ở nhánh secure của cùng source.

### Mở code theo thứ tự khi bảo vệ

1. [demo.py](../attacker/demo.py): lệnh `--scenario` chọn probe nào, in một JSON.
2. [core.py](../attacker/core.py): login/CSRF/cookie jar, trace, đọc fixture và
   `redact_evidence` cho target ngoài loopback.
3. Mở đúng file bài đang nói:
   [probes/idor.py](../attacker/probes/idor.py),
   [probes/sqli.py](../attacker/probes/sqli.py),
   [probes/auth.py](../attacker/probes/auth.py),
   [xss.mjs](../attacker/xss.mjs).
4. [cli.py](cli.py) và [report.py](report.py): câu hỏi terminal, cách in
   `observed/controls/limits`, file JSON và Markdown.


## 0. Chuẩn bị một lần cho buổi học

Nếu chưa có môi trường/fixture, thực hiện
[Local nhanh trên Windows](../../website/README.md#local-nhanh-tren-windows)
trước buổi: `.\dev setup` khi các server đã dừng. Setup khác với demo: nó cài,
build và chuẩn bị DB; `.\demo` chỉ gửi probe. Máy đã setup thì không cần chạy
lại setup sau mỗi bài hoặc mỗi lần đổi flag.

Trên máy đã chạy setup, mở Docker Desktop. Terminal A dùng cho Docker và probe:

```powershell
cd D:\PBL4-517
docker compose --env-file .local/private/database.env up -d --wait db
```

Ba tài khoản local đã có sẵn; không cần mở file JSON:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Chủ đơn | `owner@local.test` | `Owner517!demo` |
| Khách khác | `attacker@local.test` | `Attacker517!demo` |
| Quản trị | `admin@local.test` | `Admin517!demo` |

Khi cần URL đơn hoặc sản phẩm, chạy `.\demo idor` hoặc `.\demo xss`; script tự
đọc fixture nội bộ và in URL browser. Không copy ID/password từ JSON. Nếu script
báo chưa có fixture hoặc fixture chưa chuẩn hóa tài khoản, chạy `.\dev setup` rồi
thử lại. Setup cho clone mới nằm ở website README; hướng dẫn này tiếp tục từ máy
đã được chuẩn bị, không tự khẳng định fresh-clone acceptance.

Mỗi lệnh hỏi trong terminal theo thứ tự dưới đây. Enter luôn nhận giá trị trong
ngoặc vuông; gõ `n`/Enter ở câu xác nhận thì request chưa được gửi.

| Lệnh | Câu hỏi | Giá trị thường dùng |
| --- | --- | --- |
| `.\demo idor` | API URL → order | Enter; Enter |
| `.\demo idor-update` | API URL → order → địa chỉ mới → xác nhận | Enter; Enter; địa chỉ giả; `y` |
| `.\demo idor-cancel` | API URL → order → xác nhận | Enter; Enter; `y` |
| `.\demo sqli` | API URL → payload 1/2 | Enter; `1` |
| `.\demo xss` | frontend URL | Enter |
| `.\demo auth` | API URL → mật khẩu sai | Enter; Enter |

Lệnh thường **không hỏi lượt, không đọc flag để đoán kết quả**. Nó hỏi tham số,
gửi request, hiện trace trực tiếp và kết luận từ hành vi backend trả về.
`--non-interactive` bỏ các câu hỏi, dùng fixture/tham số mặc định cho automation;
input bị pipe/redirect cũng không có hỏi đáp (`sys.stdin.isatty()` là false).
Để học hãy gõ lệnh trực tiếp trong PowerShell.

### Lệnh terminal có nghĩa gì? Có cần `secure` không?

**Không cần `secure` trong buổi demo thông thường.** Chạy `.\demo idor` khi đã
bật IDOR, quan sát; tự tắt flag/restart B rồi chạy lại **chính `.\demo idor`**.
Script gửi cùng loại request. Nó không tự bật/tắt lỗi và không yêu cầu bạn biết
trước kết quả mới gửi được request.

| Lệnh | Tác dụng thực tế |
| --- | --- |
| `.\demo idor` | Hỏi API URL và order → login hai account fixture → gửi request → báo hành vi thực tế; không đặt kỳ vọng trước |
| `.\demo idor --expect secure` | Cùng probe, thêm kỳ vọng backend phải chặn B đúng cách; dùng cho CI/automation |
| `.\demo idor --expect vulnerable` | Cùng probe, thêm kỳ vọng phải tái hiện được B đọc đơn A; dùng cho CI/automation |
| `.\demo idor --expect secure --non-interactive` | Bỏ hỏi đáp, dùng tham số mặc định/đã truyền; phù hợp kiểm thử hồi quy có PASS/FAIL |
| `.\demo idor --show-evidence` | Cho phép in chi tiết evidence khi target ngoài loopback; local vốn in sẵn |
| `.\demo --help` | Chỉ hiển thị cú pháp; không gửi request |

`--expect secure|vulnerable` là **kỳ vọng kiểm thử**, không phải lệnh đổi mode.
Ví dụ backend vẫn có IDOR mà chạy `.\demo idor --expect secure`: script vẫn quan
sát `EXPLOIT_CONFIRMED`, báo `passed: False`, exit 1; nó không giấu lỗi hoặc vá
backend để làm kết quả khớp kỳ vọng. Backend đã chặn đúng mà chạy
`.\demo idor --expect vulnerable` cũng là mismatch. Bỏ `--expect` thì cả hai
hành vi quan sát rõ ràng đều trả exit 0; đọc `result` để biết lỗi có tái hiện
hay không. Không còn cú pháp `.\demo idor secure`: tham số vị trí chọn lượt đã
bị bỏ, chỉ còn `--expect` tùy chọn. Target ngoài loopback mặc định che `observed`;
thêm `--show-evidence` chỉ khi đã được phép.

Terminal chỉ hiển thị tham số cần dùng, tiến trình request/status, body sửa địa
chỉ giả, tóm tắt fixture, `observed`/`controls`/`limits`, kết quả/lý do, URL và
đường dẫn JSON + Markdown. Giải thích nguyên nhân, browser và code vá nằm trong
manual này. Nó không in mật khẩu, cookie hay CSRF token. Account/fixture local
vẫn được tự đọc nội bộ; không cần nhập lại credential sau mỗi lần chạy.

Các lệnh vận hành khác trong tài liệu có ý nghĩa sau; luôn chú ý terminal đang
ở thư mục nào (`cd`/`Set-Location` đổi thư mục hiện tại):

| Lệnh/thao tác | Để làm gì |
| --- | --- |
| `.\demo ...` | PowerShell chạy `demo.cmd` trong thư mục hiện tại; wrapper gọi Python `scripts/demo/cli.py`. Chạy từ gốc repo |
| `.\dev setup` | Chuẩn bị dependency/build/DB/fixture/Chromium trước buổi, không dùng để chuyển cờ giữa hai lượt |
| `docker compose --env-file .local/private/database.env up -d --wait db` | Dùng cấu hình DB riêng tư; `up` khởi động service `db`, `-d` chạy nền, `--wait` chờ health. Không chạy backend/frontend |
| `npm.cmd run dev` trong `website/backend` | Chạy script `dev` từ package.json backend (`tsx watch src/server.ts`); terminal này giữ process API |
| `npm.cmd run dev` trong `website/frontend` | Chạy Vite frontend; cùng tên lệnh nhưng package.json/thư mục khác nên process khác |
| Ctrl+S rồi Ctrl+C ở backend và chạy lại `npm.cmd run dev` | Lưu file env, dừng process cũ, tạo process mới đọc cấu hình. Không chỉ reload browser để áp dụng env |
| `.\dev reset-order` | Khi B đã dừng: reset đúng đơn fixture và điều chỉnh kho tương ứng; không reset toàn database |
| `.\demo idor --url http://127.0.0.1:3000 --order <UUID>` | Cung cấp sẵn URL/đơn thay vì hỏi hai giá trị đó; `<UUID>` phải thay bằng UUID thật của owner fixture |
| `python scanner/scan.py ... --no-banner --no-alert` | Chạy scanner TCP; bỏ lấy banner và không gửi alert thật. Không phải probe IDOR/SQLi |
| `$LASTEXITCODE` | Đọc mã thoát của lệnh native vừa chạy; không thực hiện tấn công mới |
| `docker compose --env-file .local/private/database.env stop db` | Dừng service DB, giữ dữ liệu volume; dùng sau khi đã dừng web |

Không gõ ký tự `<...>` minh họa như tham số thật. Enter nhận default chỉ ở các
câu hỏi đang có default; `y/N` mặc định từ chối request sửa/hủy.

Mở `website/backend/.env` (không phải root `.env`), giữ nguyên DATABASE_URL và
SESSION_SECRET; dùng cấu hình thực hành:

```dotenv
NODE_ENV=development
PORT=3000
TRUST_PROXY=0
APP_PROFILE=lab
LAB_DATA_ACK=synthetic-only
VULN_IDOR_ENABLED=false
VULN_SQLI_ENABLED=false
VULN_XSS_ENABLED=false
VULN_AUTH_ENABLED=false
```

Terminal B chạy API:

```powershell
cd D:\PBL4-517\website\backend
npm.cmd run dev
```

Terminal C chạy frontend:

```powershell
cd D:\PBL4-517\website\frontend
npm.cmd run dev
```

Giữ B/C mở. Website ở `http://127.0.0.1:5173`; `http://127.0.0.1:3000/` chỉ là
gốc API và trả NOT_FOUND là bình thường. Kiểm tra database qua
`http://127.0.0.1:3000/api/health`, mong đợi `data.database = connected`.

Sau **mọi lần đổi env**: Ctrl+S trong IDE → terminal B Ctrl+C → nếu hiện câu hỏi
Terminate batch job thì xác nhận Y → chạy lại `npm.cmd run dev` → đợi API ready →
refresh trang. Không giả định tsx watch tự nhận thay đổi `.env`. Không tắt/restart
frontend hoặc database cho mỗi lượt. Nếu giá trị không áp dụng, kiểm tra biến môi
trường trong terminal: process environment có thể ưu tiên hơn dotenv.

Ví dụ chỉ kiểm tra override **không nhạy cảm** trong terminal B:

```powershell
Get-Item Env:APP_PROFILE,Env:LAB_DATA_ACK,Env:VULN_IDOR_ENABLED,Env:VULN_SQLI_ENABLED,Env:VULN_XSS_ENABLED,Env:VULN_AUTH_ENABLED -ErrorAction SilentlyContinue
```

Nếu một flag cũ đang override, dừng B rồi xóa đúng override đó, ví dụ
`Remove-Item Env:VULN_IDOR_ENABLED -ErrorAction SilentlyContinue`, sau đó chạy
lại B để đọc `.env`. Không dump toàn bộ `Env:` vì có thể chứa secret.
CLI chỉ dùng PORT trong file backend `.env` để gợi ý API URL; không suy
lượt từ flag. Cấu hình hiệu lực vẫn do backend đọc lúc startup. Sửa file mà chưa
restart sẽ không đổi hành vi process đang chạy.

### Theo dõi request mà không nhầm phiên

Browser gửi `/api/...` tới Vite `5173`, được proxy sang backend `3000`.
CLI Python thường gửi thẳng `3000`; XSS phải vào frontend `5173` để chạy React.
Giữ port mặc định trong hướng dẫn này. Nếu tự đổi PORT, cần đổi cả proxy Vite
(`API_PROXY_TARGET`) theo website README; không chỉ đổi URL câu hỏi của CLI.

Đăng nhập qua browser đi theo luồng `GET /api/auth/csrf` → `POST /api/auth/login`
với JSON email/password và header `X-CSRF-Token` → cookie `pbl517.sid` →
`GET /api/auth/me`. Cookie HttpOnly lưu phiên trên PostgreSQL; ở HTTP local
`NODE_ENV=development` nên cookie không có Secure. Đừng đổi NODE_ENV thành
production cho URL HTTP này. Token/giá trị cookie không đưa lên màn hình báo cáo.

Sau khi login, mở F12 → Network → Fetch/XHR; có thể bật Preserve log khi cần theo
dõi chuyển trang. Chọn request → **Headers** xem method/URL/status, **Payload**
xem body, **Response** xem JSON. Lỗi nằm trong `error.code`, không chỉ status.
`GET /api/health` thành công chỉ chứng minh API/DB hoạt động, chưa chứng minh
đăng nhập, ownership hay bất kỳ bản vá nào.

**Request CLI không xuất hiện trong Network của browser bạn đang mở.** CLI dùng
cookie jar riêng; XSS mở Chromium headless riêng rồi đóng khi xong. Muốn nhìn
request trong DevTools, tự reload/thao tác ở cửa sổ browser; muốn xem request CLI,
đọc trace terminal/báo cáo JSON. Trace là danh sách request ứng dụng do probe
ghi nhận, không phải packet capture hay toàn bộ request tài nguyên của Chromium.

## 1. Đăng nhập bằng tài khoản local dễ nhớ

Ba account giả đã được setup tạo sẵn; dùng đúng bảng ở mục 0. Không lấy account
admin làm attacker: admin được cho phép quản lý đơn theo nghiệp vụ. Không đưa
password lên GitHub hoặc screenshot.

1. Cửa sổ A: browser bình thường. Mở `http://127.0.0.1:5173/login`.
2. Nếu thấy "PHIÊN ĐĂNG NHẬP HIỆN TẠI"/"Chào ...", bạn đã login. Bấm Đăng xuất
   ở thanh điều hướng (mobile: Đăng xuất tài khoản), rồi mở lại `/login`.
3. Ô **Email đăng nhập**: nhập `owner@local.test`. Ô **Mật khẩu**:
   `Owner517!demo`.
4. Bấm **Đăng nhập**. Bình thường chuyển sang `/products`. Mở lại `/login` để
   kiểm tra email đang login đúng owner; đây là cách kiểm tra không cần đoán avatar.
5. Cửa sổ B: mở một cửa sổ ẩn danh bằng menu browser hoặc Ctrl+Shift+N trong
   Chrome/Brave/Edge. Mở cùng `/login`, nhập `attacker@local.test` và
   `Attacker517!demo`.
6. Bấm Đăng nhập, rồi mở lại `/login` để kiểm tra email khác owner.

Hai tab bình thường chia sẻ session. Nhiều cửa sổ ẩn danh cùng browser cũng có
thể chia sẻ một phiên ẩn danh. Dùng **một cửa sổ thường và một cửa sổ ẩn danh**,
hoặc hai browser/profile riêng. Luôn dùng `127.0.0.1` nhất quán, không đổi qua
`localhost` giữa bài. Password sai 401, chưa login 401 và thiếu quyền 403 là ba
tình huống khác nhau. Restart backend không tự xóa session đang lưu PostgreSQL.

## 2. IDOR đọc đơn — thử trước, hiểu code, vá và thử lại

Mục tiêu: owner A đọc đơn A là hợp lệ; khách B đọc cùng đơn A là trái phép.
Tên lỗi: Insecure Direct Object Reference, thuộc Broken Access Control.

### Lượt có lỗi

1. Trong backend `.env`, chỉ đổi `VULN_IDOR_ENABLED=true`, ba flag khác false.
2. Lưu và restart B theo mục 0. Không sửa source.
3. Tại terminal A chạy ` .\demo idor ` theo mẫu hỏi đáp bên dưới. Script in URL
   đơn của owner; mở URL đó trong cửa sổ owner.
4. Owner thấy mã đơn, sản phẩm, tổng tiền, thông tin nhận hàng. Ghi địa chỉ/trạng thái.
5. Copy **cùng URL** vào cửa sổ attacker. Nếu chưa login, làm lại mục 1.
6. Attacker cũng thấy đơn của owner: đây là hành vi lỗi, không phải quyền đúng.
7. Trong cửa sổ attacker, F12 → Network → Fetch/XHR → reload trang → chọn request
   `/api/orders/<ID>` (không phải request HTML `/orders/<ID>`). Status 200 và
   Response chứa dữ liệu đơn. HTTP 200 của trang HTML một mình không đủ kết luận.

Lệnh ngắn và cách trả lời tại terminal A:

```powershell
.\demo idor
```

| Terminal hỏi | Bạn nhập |
| --- | --- |
| API URL | Enter để dùng `http://127.0.0.1:3000` |
| Order ID hoặc URL đơn của owner | Enter để dùng đơn mẫu; hoặc dán URL đơn lab muốn thử |

Mong đợi EXPLOIT_CONFIRMED. Probe tự login các phiên riêng; không
thay account trong hai browser của bạn. Script không cần bạn copy cookie/CSRF.
Nó in email đóng vai, các request/status theo thời gian thực, dữ liệu quan sát
được, đối chứng, giới hạn, URL browser và đường dẫn JSON/Markdown; không in mật
khẩu, cookie hay CSRF token. Không cần khai báo biến đường dẫn, không cần đọc
hoặc copy file JSON.

Output cần đọc (ví dụ rút gọn với dữ liệu synthetic; không phải log live):

```text
Fixture: run=... | order=... | product=...

Kết quả: EXPLOIT_CONFIRMED — đã tái hiện hành vi lỗi

Dữ liệu attacker đọc được (HTTP 200):
  HTTP       : 200 OK
  Đơn hàng   : ...
  Chủ đơn    : owner@local.test
  Người nhận : Lab owner | owner@local.test
  Điện thoại : (trống)
  Địa chỉ    : Synthetic owner address
  Trạng thái : PENDING
  Tổng tiền  : 2000.00
  Sản phẩm   : KEVILO lab ... × 2 — 1000.00/sp

Đối chứng:
  Owner GET : 200 OK
  Attacker  : 200
  Đơn/stock : không đổi

Giới hạn:
  Chỉ chứng minh đơn fixture bị lộ; không suy ra mọi endpoint.
```

Ở lượt secure, phần `observed` chỉ còn `HTTP: 403 FORBIDDEN` và
`Dữ liệu: không có — attacker không đọc được đơn`; `Đối chứng` phải cho thấy
owner vẫn 200 và đơn/stock không đổi. Bài **đọc** không đưa tồn kho vào
`observed`; stock chỉ là đối chứng hoặc bị bỏ. Sang bài sửa/hủy, stock nằm trong
`observed` vì thay đổi kho chính là tác động cần chứng minh.

### Vì sao lỗi và có thể gây gì

Backend biết B đã đăng nhập nhưng nhánh lab chỉ tìm đơn theo ID. Biết "bạn là B"
không đồng nghĩa "bạn được đọc đơn A". Lộ URL/ID có thể dẫn tới lộ thông tin mua
hàng/địa chỉ; endpoint sửa/hủy thiếu guard còn có thể cho phép thay địa chỉ/hủy
đơn trái phép. UUID khó đoán chỉ là lớp bổ sung, không thay ownership check.

### Biện pháp vá thực sự

Đọc `website/backend/src/controllers/order-controller.ts::handleGetOrderById`:
requestingUserId lấy từ `req.session.userId`, không lấy từ body client.
Đọc `services/order-service.ts::getOrderById`. So sánh rút gọn:

```typescript
// Nhánh lab: ID đúng là lấy được, thiếu ràng buộc người sở hữu.
prisma.order.findUnique({ where: { id: orderId } });

// Nhánh secure: ID và người sở hữu phải đồng thời khớp.
prisma.order.findFirst({
  where: { id: orderId, userId: requestingUserId }
});
```

Đây là minh họa rút gọn; source thật có include, xử lý lỗi và ngoại lệ admin.
Sau `findFirst` theo `id + userId`, source còn `findUnique({ id })` để phân biệt
403 (đơn tồn tại nhưng không thuộc người gọi) với 404 (không có đơn). Đừng nói
secure chỉ chạy một query. Không ẩn nút frontend để thay kiểm tra backend.
Kiểm tra mọi thao tác read/update/cancel theo cùng chính sách.

### Lượt đã phòng vệ

1. Đặt `VULN_IDOR_ENABLED=false`, lưu, restart backend.
2. Owner reload cùng URL: vẫn đọc được đơn.
3. Attacker reload cùng URL: thấy **403 FORBIDDEN — TRUY CẬP BỊ TỪ CHỐI**.
4. Network request API của attacker: 403; của owner: 200.
5. Chạy lại cùng probe ở lượt secure:

```powershell
.\demo idor
```

Mong đợi DEFENSE_VERIFIED. Cờ false chọn **nhánh đã có biện pháp vá trong source**;
không phải hệ thống tự phát hiện và viết bản vá mới. `probes/idor.py::run` đo hành vi,
không quyết định quyền của ứng dụng. 401/404/503 hoặc server chết không là kết quả
phòng vệ đúng bài này. Owner phải còn hoạt động để tránh kết luận giả.

### Đọc trace và tự trình bày bài đọc đơn

Thứ tự chính trong `probes/idor.py::run`: đọc `/api/version` → login owner và attacker
(mỗi bên có cookie jar riêng, kiểm tra `/me` và role CUSTOMER) → owner GET đơn →
GET sản phẩm từng item để lấy stock → attacker GET cùng đơn → owner GET lại đơn
và stock. Chỉ nhập order của **owner fixture**. CLI nhận UUID/URL khác nhưng
probe vẫn xác minh owner; dán đơn bất kỳ không vượt qua được tiền điều kiện này.

Ví dụ **rút gọn**, `<ID>` thay bằng ID thực; không phải log của một lượt chạy mới:

```text
[owner@local.test] GET /api/orders/<ID> -> 200
[attacker@local.test] GET /api/orders/<ID> -> 403 FORBIDDEN
[owner@local.test] GET /api/orders/<ID> -> 200
Kết quả: DEFENSE_VERIFIED — đã chặn đúng bài
```

Response thành công nằm trong `data`, gồm `id`, `userId`, `shippingAddress`,
`status`, `items`; lỗi secure có `error.code = FORBIDDEN`. Probe so sánh đầy đủ
snapshot đơn và stock trước/sau ở nhánh 403. Bản báo cáo chỉ tóm tắt các trường
chứng minh lộ đơn (tối đa vài dòng, danh sách dài ghi `+N`), không dump toàn bộ
JSON response, cookie hay token.

Câu giải thích sau bài: “B đã được xác thực nhưng không sở hữu đơn A. Ở lab,
backend tìm theo ID nên B đọc được. Ở secure, session cung cấp userId và truy
vấn buộc ID lẫn userId khớp; B nhận 403, A vẫn nhận 200.”

## 3. IDOR sửa/hủy đơn — làm sau khi hiểu bài đọc

Chỉ thực hành trên fixture, trạng thái PENDING. Không sửa/hủy trước khi muốn
chứng minh bài đọc hoặc so sánh cùng trạng thái.

### Sửa địa chỉ bằng giao diện

1. Bật riêng IDOR, restart, attacker mở URL đơn mà ` .\demo idor ` đã in.
2. Bấm **Sửa địa chỉ giao hàng** → ô **Địa chỉ mới** nhập
   `Dia chi demo do tai khoan B thay doi` → **Lưu địa chỉ**.
3. Owner reload cùng đơn và thấy địa chỉ mới. Đây là tác động đã lưu server,
   không chỉ thay chữ trên browser B.
4. Tắt IDOR và restart: attacker không còn tải được đơn. Muốn kiểm tra PATCH
   trực tiếp dù giao diện bị chặn, dùng probe bên dưới sau khi reset fixture.

### Hủy đơn bằng giao diện

1. Trên fixture PENDING, bật IDOR, restart; attacker mở cùng đơn.
2. Bấm **Hủy đơn hàng này** → hộp thoại **Xác nhận hủy đơn hàng** → **Hủy đơn hàng**.
3. Owner reload: trạng thái CANCELLED; hệ thống hoàn lại tồn kho của item.
4. Tắt cờ, reset đúng fixture về PENDING trước secure retest. Bị từ chối vì đơn
   đã CANCELLED không chứng minh ownership guard đã hoạt động.

### Reset có kiểm soát và probe sửa/hủy

Dừng backend ở terminal B trước khi reset, để không có người thao tác fixture
cùng lúc. Giữ APP_PROFILE=lab, LAB_DATA_ACK=synthetic-only và các flag false.
Tại terminal A:

```powershell
.\dev reset-order
```

Tool xác minh ownership/item/run trước khi phục hồi địa chỉ/trạng thái của đúng
đơn; nếu CANCELLED thì trừ lại số lượng đã hoàn kho, giữ nguyên ID/review XSS.
Nếu dist thiếu hoặc cũ, cần build backend trước theo website README. Không reset
toàn DB bằng seed. Chạy lại backend sau reset.

Probe chọn **một** scenario mỗi vòng:

```powershell
# Khi IDOR true và đơn mẫu PENDING:
.\demo idor-update
# Hoặc hủy đơn trong một vòng riêng:
.\demo idor-cancel
```

`idor-update` hỏi API URL → ID/URL đơn → địa chỉ mới. Nhập địa chỉ giả bạn
muốn thử, ví dụ `Dia chi moi cua attacker`; không bị khóa ở một payload cố định.
Script in PATCH, đường dẫn và body rồi hỏi `Gửi request này? [y/N]`. Nhập `y` mới
gửi. `idor-cancel` hỏi tương tự nhưng không có địa chỉ, và xác nhận trước POST hủy.
Enter ở các câu có giá trị gợi ý sẽ giữ giá trị đó; Enter ở xác nhận thì **không gửi**.

Sau probe vulnerable: dừng B → tắt IDOR → reset fixture → chạy lại B → cùng probe
với ` .\demo idor-update ` hoặc ` .\demo idor-cancel `.
Probe PATCH/POST phải trả 403 và dữ liệu/stock không đổi.
Nếu vừa sửa bằng tay thì reset trước probe vulnerable để có mốc ban đầu rõ ràng.

Vá ở `updateOrderDetails`/`cancelOrder` trong order-service. Điểm cần nói chính
xác: cả hai đều đọc trước bằng `findFirst({ id, userId })` khi secure, nên người
lạ nhận 403 và owner sai trạng thái nhận 400. Riêng `cancelOrder` còn claim
`updateMany({ id, status: 'PENDING', userId })` **bên trong transaction** rồi mới
hoàn kho. `updateOrderDetails` hiện kiểm tra ownership ở bước đọc rồi update theo
`id`; đây chưa phải conditional update nguyên tử, nên khi bảo vệ không nên nói
“ownership được kiểm tra trong cùng câu UPDATE”. Muốn siết hơn có thể dùng
`updateMany({ where: { id, userId, status: 'PENDING' } })` và kiểm tra `count`.
Đọc/sửa/hủy là ba thao tác cần kiểm tra, không suy từ GET sang mọi thao tác khác.

### Đối chiếu request và code vá cho từng thao tác

**Sửa địa chỉ:** chọn một địa chỉ giả, dùng đúng chuỗi đó ở cả hai lượt. Ví dụ
khi terminal hỏi, nhập `Dia chi demo B 517`; Enter các câu URL/order, `y` ở xác
nhận cuối. Request tương ứng (bỏ giá trị cookie/token):

```http
PATCH /api/orders/<ID>
Content-Type: application/json
X-CSRF-Token: <token-cua-phien-attacker>

{"shippingAddress":"Dia chi demo B 517"}
```

Trích rút gọn đúng thứ tự trong `updateOrderDetails` cho khách ở secure:

```typescript
const scopedOrder = await prisma.order.findFirst({
  where: { id: orderId, userId: requestingUserId },
  select: { id: true, status: true },
});
// Source kiểm tra không tìm thấy -> 403/404; không PENDING -> 400.
// Chỉ sau khi vượt các kiểm tra mới đi đến lệnh ghi:
const updated = await prisma.order.update({
  where: { id: orderId },
  data: {
    ...(data.shippingAddress ? { shippingAddress: data.shippingAddress } : {}),
    ...(data.customerPhone !== undefined ? { customerPhone: data.customerPhone } : {}),
  },
  // include được lược bỏ ở đây.
});
```

Vulnerable: attacker PATCH 200, owner GET lại thấy địa chỉ mới, stock giữ nguyên.
Secure sau reset: attacker PATCH 403 `FORBIDDEN`, owner GET lại vẫn thấy
`Synthetic owner address`, stock không đổi. Browser secure không tải được đơn
nên không còn form sửa; probe vẫn gửi PATCH trực tiếp để kiểm tra endpoint.
Đây là chặn quyền ở backend; `updateMany` nguyên tử cho sửa địa chỉ chỉ là đề
xuất siết thêm, chưa phải implementation hiện tại.

Output `idor-update` cần đọc (ví dụ rút gọn, synthetic):

```text
Tác động lên đơn của owner (HTTP 200):
  HTTP           : 200 OK
  Địa chỉ trước  : Synthetic owner address
  Địa chỉ sau    : Dia chi demo B 517
  Body PATCH     : {"shippingAddress": "Dia chi demo B 517"}
  Trạng thái     : PENDING

Đối chứng:
  Owner GET  : 200 OK
  KEVILO lab ... : 48 → 48 (+0)

Giới hạn:
  Chỉ chứng minh một đơn fixture bị sửa; không kiểm tra concurrency.
```

Ở lượt secure, `observed` là `HTTP: 403 FORBIDDEN` + `Dữ liệu: không thay đổi`;
`Đối chứng` phải cho thấy owner vẫn 200, attacker bị 403 và đơn/stock không đổi.
Địa chỉ và body PATCH chỉ xuất hiện trong evidence vì đây là mutation trên dữ
liệu synthetic, không phải credential.

**Hủy đơn:** request probe là POST dưới đây; giao diện gọi `post()` không truyền
body nên có thể không hiện `{}` trong Payload. Hai cách gọi cùng endpoint:

```http
POST /api/orders/<ID>/cancel
Content-Type: application/json
X-CSRF-Token: <token-cua-phien-attacker>

{}
```

`cancelOrder` đọc theo ownership trước, rồi claim trạng thái và hoàn kho trong
transaction. Trích rút gọn phần ghi hiện có:

```typescript
const cancelled = await prisma.$transaction(async (tx) => {
  const claim = await tx.order.updateMany({
    where: {
      id: orderId,
      status: 'PENDING',
      ...(!isIdorVulnerable() && !isAdmin ? { userId: requestingUserId } : {}),
    },
    data: { status: 'CANCELLED' },
  });
  if (claim.count === 0) {
    throw new AppError(400, 'CANNOT_CANCEL', /* thông báo */ '...');
  }
  for (const item of orderToCancel!.items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    // include được lược bỏ ở đây.
  });
});
```

Fixture mới tạo có quantity **2**, product stock **48** (đã dành hàng cho đơn).
Nếu chưa có thao tác khác, vulnerable hủy làm stock `48 → 50`; reset đúng fixture
đưa về `50 → 48` và PENDING; secure retest giữ stock 48. Nếu stock hiện tại khác,
dùng số đo trước/sau thực tế, không tự sửa DB để ép số 48. Probe cộng quantity
theo từng product của đơn và so stock tương ứng, không chỉ nhìn chữ CANCELLED.

Output `idor-cancel` cần đọc (ví dụ rút gọn, synthetic):

```text
Tác động lên đơn của owner (HTTP 200):
  HTTP          : 200 OK
  Trạng thái    : PENDING → CANCELLED
  KEVILO lab ... : 48 → 50 (+2)

Đối chứng:
  Owner GET : 200 OK
  Hoàn kho  : khớp số lượng từng sản phẩm

Giới hạn:
  Chỉ chứng minh một đơn fixture bị hủy; không kiểm tra concurrency.
```

Đây là chỗ stock **thuộc `observed`**, vì thay đổi tồn kho là tác động thật của
hành vi hủy trái phép. Ở lượt secure, `observed` là 403 + trạng thái không đổi,
và `Đối chứng` phải xác nhận stock vẫn nguyên.

Sau mỗi bài sửa/hủy, câu giải thích cần đủ: **ai gửi**, **method/body**, **dữ
liệu owner thay đổi hay không**, **status/error code**, **guard nằm ở đâu**.
Không chạy probe hủy lần hai ngay sau lần đầu: đơn CANCELLED làm tiền điều kiện
PENDING thất bại, chưa có phép thử quyền mới. `.\dev reset-order` chỉ phục hồi
đơn trong manifest mặc định; nếu tự chọn đơn khác, wrapper này không reset đơn
đó. Luồng hướng dẫn dùng Enter để giữ đúng fixture mặc định.

## 4. SQL Injection — thao tác tìm kiếm

1. Các flag false, bật riêng `VULN_SQLI_ENABLED=true`, lưu và restart B.
2. Mở `http://127.0.0.1:5173/products`, chọn danh mục **Tất cả**.
3. Ô **Tìm kiếm theo tên hoặc mô tả…**: nhập tên sản phẩm đang thấy. Danh sách
   phải lọc được; xóa rồi nhập `khong-co-san-pham-517-xyz`, phải không có kết quả.
4. Thay bằng payload chính xác `' OR '1'='1` và chờ tìm kiếm cập nhật.
5. Ở nhánh lab, sản phẩm xuất hiện dù không chứa chuỗi đó. F12 → Network →
   request `/api/products?search=...` → Response cho thấy danh sách API trả về.
6. Tắt SQLi, lưu, restart B. Giữ nguyên payload trên ô tìm kiếm, reload trang.
   Secure coi chuỗi đó là dữ liệu tìm kiếm, kết quả trống. Tìm tên hợp lệ vẫn được.

`product-service.ts::listProductsWithRawSql` nối search vào SQL rồi dùng
`$queryRawUnsafe`. Dấu nháy có thể kết thúc phần dữ liệu, OR đưa biểu thức logic
vào điều kiện. Đoạn query thật và chuỗi sinh ra nằm ngay dưới đây.

Source thật dùng ILIKE cho name/description và còn nối `category` vào SQL khi có
filter; lỗi gốc vẫn là input trở thành cú pháp SQL. Probe chỉ đo `search`, không
kiểm tra `category`, nên không kết luận thay cho nhánh còn lại. Tác hại tùy
query/quyền DB: đọc ngoài phạm vi, vượt bộ lọc và trong điều kiện khác có thể
sửa/xóa dữ liệu. Probe hiện tại chỉ đọc, chưa chứng minh chiếm database hoặc chạy
lệnh hệ điều hành.

Vá: `listProducts` dùng `prisma.product.findMany` với `contains`/OR có cấu trúc;
giá trị được parameterize. Nếu dùng SQL raw phải bind tham số, không nối input
vào SQL. Validation/role ít quyền bổ sung cho parameterization, không thay nó.
ORM vẫn có thể bị SQLi nếu gọi raw unsafe như nhánh lab đang minh họa.

### Đối chiếu query thật và bản vá

Trích từ `listProductsWithRawSql`, giữ nguyên phần tạo điều kiện search:

```text
WHERE (name ILIKE '%${trimmedSearch}%' OR description ILIKE '%${trimmedSearch}%')
```

Với payload 1, đoạn SQL sinh ra là:

```sql
WHERE (name ILIKE '%' OR '1'='1%' OR description ILIKE '%' OR '1'='1%')
```

Điểm cần nói chính xác: hai phép `'1'='1%'` **không** tự đúng. Chính `ILIKE '%'`
khớp mọi chuỗi không null làm điều kiện rộng ra; vì vậy đừng giải thích query
thật chỉ bằng một ví dụ tautology với phép `=`. Source/schema hiện tại
dùng name/description không null. Payload 2 còn đưa `OR TRUE` vào điều kiện.

Nhánh secure `listProducts` tạo đối tượng Prisma, trích rút gọn:

```typescript
where.OR = [
  { name: { contains: search.trim(), mode: 'insensitive' } },
  { description: { contains: search.trim(), mode: 'insensitive' } },
];
const products = await prisma.product.findMany({
  where,
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
});
```

Prisma truyền giá trị dưới dạng tham số, nên dấu nháy/OR không trở thành cú pháp
SQL. Source secure còn lọc category và ẩn deployment-verification products;
nhánh raw lab không giữ đầy đủ các lọc đó. So sánh bằng fixture/tìm kiếm control,
không kết luận từ tổng số card hoặc ảnh: raw query cũng không select `imageKey`.

```powershell
# Bật SQLi, restart backend rồi chạy:
.\demo sqli
# Tắt SQLi, restart backend rồi chạy:
.\demo sqli
```

Terminal hỏi API URL → chọn payload `1` hoặc `2`.
Enter chọn payload 1. Script in payload, số dòng và sản phẩm payload trả về, cùng
các control. Dùng cùng payload khi retest; không chạy hai dòng liên tiếp mà chưa
đổi cờ/restart.

Output `sqli` cần đọc (ví dụ rút gọn, synthetic):

```text
Dữ liệu payload trả về:
  Payload     : ' OR '1'='1
  Số dòng     : 12
  Sản phẩm lộ : KEVILO lab ... (...); +7 sản phẩm

Đối chứng:
  Tìm đúng tên      : 1 kết quả, có fixture
  Chuỗi không tồn tại : 0 kết quả

Giới hạn:
  Chỉ đo search đọc; không chứng minh xóa bảng/chiếm DB/chạy lệnh OS.
```

Ở lượt secure, `Số dòng` là `0`, `observed` ghi payload được xử lý như dữ liệu
tìm kiếm; `Sản phẩm lộ` không xuất hiện. HTTP 200 ở cả hai lượt không phải tiêu
chí; phải đọc `data` và các control.

`probes/sqli.py::run` có control tìm đúng tên, tìm không tồn tại và cùng payload ở hai
lượt. Chỉ kết luận bản vá theo kịch bản, không nói mọi injection đã được loại bỏ.

Trong trace có ba GET tìm kiếm: tên fixture → `absent-<run>` → payload đã chọn.
URL encode dấu nháy/khoảng trắng là bình thường; xem Query String Parameters để
đọc giá trị đã decode. Lab và secure đều thường trả **HTTP 200** cho GET này;
điểm khác là `data` chứa fixture hay `[]`. Khi thêm `--expect`, `passed: True` chỉ có khi hành vi
khớp kỳ vọng. Lệnh thường chỉ báo `result` và `completed`. Browser có debounce 300 ms, giữ search trong URL; chờ request
hoàn tất trước khi ghi kết quả hoặc reload.

Câu giải thích sau bài: “Cùng chuỗi search ở lab được ghép vào câu SQL; ở secure
nó được truyền như dữ liệu qua Prisma. Tìm tên thật vẫn hoạt động, chuỗi không
tồn tại và payload ở secure trả rỗng. Đây là phép thử search, không phải bằng
chứng đã kiểm tra mọi raw query trong ứng dụng.”

## 5. Stored XSS — review lưu sẵn và marker vô hại

1. Các flag false, bật riêng `VULN_XSS_ENABLED=true`, lưu và restart B.
2. Chạy ` .\demo xss ` tại terminal A, mở URL sản phẩm script in ra; kéo đến phần đánh giá.
   Bài này chỉ cần xem review, không bắt buộc login. Fixture đã có payload lưu DB.
3. Khi lab, trang có cảnh báo LAB XSS. Có thể chỉ thấy ảnh lỗi, không có popup.
4. F12 → Console, tự gõ `window.__pbl517_xss_probe` → Enter. Mong đợi số `1`.
5. Reload trang, marker lại thành 1: payload tồn tại trong review, không do bạn
   tự gõ lệnh gán marker. **Không gõ `window.__pbl517_xss_probe=1` để chứng minh lỗi.**
6. Đặt XSS false, lưu/restart B và reload browser để tạo document mới.
7. Review hiện nguyên văn thẻ HTML; Console đọc cùng biến trả undefined.
8. Không xóa/sửa review giữa hai lượt; chính cách render đã thay đổi.

Payload trong fixture:

```html
<img src="/missing-pbl517-probe" onerror="window.__pbl517_xss_probe=1">
```

Giải thích: browser tạo thẻ img, src không tải được nên chạy handler onerror;
handler chỉ đặt biến trong trang. Đây là Stored XSS vì nội dung đã lưu server
và chạy khi người khác xem. Không lấy cookie hoặc gửi dữ liệu ra ngoài.

### Tự thử XSS tác động trực quan (tùy chọn)

Bài probe `xss` chỉ kiểm tra marker vô hại. Muốn thấy tác động dễ nhìn hơn, tự
tạo một review khác trên **một sản phẩm khác trong môi trường lab** (không dùng
sản phẩm fixture của `.\demo xss`) khi `VULN_XSS_ENABLED=true`.

Banner DEMO để dán vào ô nhận xét:

```html
<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#b00020;color:white;padding:16px;text-align:center;font-size:18px">
  DEMO XSS — Trang này đã bị chèn nội dung.<br>
  Đây là dữ liệu giả trong lab, không có giao dịch thật.
</div>
```

Thực hiện:

1. Đăng nhập bằng account attacker theo mục 1, mở một sản phẩm khác trong môi
   trường lab.
2. Chọn số sao, dán banner vào ô nhận xét, bấm **Gửi đánh giá**.
3. Mở cùng sản phẩm ở cửa sổ owner (hoặc F5): banner đỏ xuất hiện. Trang vẫn
   dùng dữ liệu giả; không có giao dịch hay thanh toán thật.
4. Tắt `VULN_XSS_ENABLED`, restart backend, F5 lại: banner biến thành text bình
   thường, không còn tác động.

Banner này là HTML/CSS nên chứng minh **HTML injection/defacement**. Muốn thấy
JavaScript chạy, dùng payload sau trên **một sản phẩm khác nữa** (payload có
thêm thẻ `<img>`, tránh dùng sản phẩm fixture):

```html
<img src="/missing-pbl517-probe" onerror="alert('DEMO XSS: JavaScript da chay')">
```

`alert` chỉ là bằng chứng code đã chạy; payload thật thường chạy ngầm. Không dùng
số tài khoản ngân hàng thật, không tạo banner đòi chuyển tiền, form thanh toán
hoặc link lừa đảo trong lab. Review tự thêm vẫn nằm trong database lab; dùng một
sản phẩm khác trong môi trường lab và không coi review đó là fixture của CLI.

Tác hại thực tế có thể là giả giao diện, đọc dữ liệu JS được phép truy cập hoặc
thực hiện thao tác dưới phiên nạn nhân tùy kiểm soát khác. HttpOnly ngăn đọc cookie
qua JS nhưng không loại bỏ tất cả tác hại XSS. Bài này chỉ chứng minh thực thi marker.

Vá ở `ProductDetailPage.tsx`, rút gọn:

```tsx
// Lab: interpret comment as HTML, including event handlers.
<p dangerouslySetInnerHTML={{ __html: r.comment }} />
// Secure: show comment as text; React escapes it.
<p>{r.comment}</p>
```

Backend chỉ trả `labUnsafeReviewHtml` khi flag XSS true. Trong sản phẩm hiện tại
review là text nên không cần chèn HTML. Nếu muốn rich text phải thiết kế sanitizer
allowlist phù hợp; CSP là lớp bổ sung, không thay output handling đúng.

Đối chiếu luồng đầy đủ: `addReview` lưu `comment` như chuỗi vào PostgreSQL;
`getProductById` trả review và thêm `{ labUnsafeReviewHtml: true }` **chỉ ở lab**;
`ProductDetailPage.tsx` chọn nhánh render. Cùng nội dung có thể vẫn chứa `<img>`
trong JSON secure; JSON chưa phải HTML đang thực thi. Trích đúng điều kiện ở UI:

```tsx
{product.labUnsafeReviewHtml
  ? <p className="review-comment" dangerouslySetInnerHTML={{ __html: r.comment }} />
  : <p className="review-comment">{r.comment}</p>}
```

Khi tự gửi review, request là `POST /api/products/<productId>/reviews` với
`{"rating":5,"comment":"<chuỗi marker ở trên>"}`, cookie và CSRF. Fixture CLI
được tạo sẵn bởi `lab-fixtures.ts`; probe XSS **không gửi POST review** và không
thay comment. Để quan sát DOM: F12 → Elements → tìm `review-comment`. Lab có
node `img`/handler; secure chứa text trong đúng review. Ảnh sản phẩm ở nơi khác
trong trang không liên quan đến điều kiện “review không có img”.

Phải reload toàn trang sau chuyển lượt: biến `window.__pbl517_xss_probe` thuộc
document cũ có thể còn bằng 1 nếu chỉ điều hướng SPA hoặc cập nhật component.
Probe tránh nhầm này bằng một browser/page mới mỗi lần. Nếu HTML có img nhưng
marker không chạy, có thể còn CSP/extension khác chặn; chưa được coi là đã tái
hiện lỗi đúng bài, kiểm tra điều kiện thay vì tự gán biến marker.

```powershell
# Đổi flag/restart ở giữa, không chạy liên tiếp khi chưa chuyển mode.
.\demo xss
.\demo xss
```

Terminal hỏi **Frontend URL**, Enter dùng `http://127.0.0.1:5173` (không
nhập API cổng 3000). Nó in product ID và payload review đang kiểm tra. Script
không thay payload hoặc tạo review mới; muốn tự viết review thì dùng sản phẩm lab
khác theo bước ở trên. Đây là phép so sánh cùng dữ liệu giữa hai cách render.

Probe dùng Chromium kiểm tra payload vẫn tồn tại trong API/review, DOM và marker.
Không chỉ kiểm tra text JSON có chứa dấu < hay không.

Output `xss` cần đọc (ví dụ rút gọn, synthetic):

```text
Dấu hiệu thực thi trong trình duyệt:
  Payload                  : <img src="/missing-pbl517-probe" onerror="window.__pbl517_xss_probe=1">
  Review ID                : ...
  Sản phẩm                 : KEVILO lab ...
  labUnsafeReviewHtml      : true
  <img> trong review       : 1
  window.__pbl517_xss_probe: 1

Đối chứng:
  Review qua API : tồn tại, đúng payload
  Trang sản phẩm : 200 OK

Giới hạn:
  Chỉ chứng minh marker trên trang fixture; không lấy cookie, không gửi dữ liệu ra ngoài.
```

Ở lượt secure, `labUnsafeReviewHtml` là `false`, `<img> trong review` là `0`,
marker là `undefined`; review qua API vẫn tồn tại và trang vẫn 200. HTTP 200 của
sản phẩm xuất hiện ở cả hai lượt, không chứng minh XSS. Câu giải thích sau bài:
“Dữ liệu độc được lưu một lần rồi thực thi khi người xem tải trang ở nhánh HTML.
Sau phòng vệ, cùng review vẫn còn nhưng React render thành text; document mới
không có marker.”

## 6. Authentication — tự thử đăng nhập sai có giới hạn

Làm cuối buổi. Các flag false, bật riêng `VULN_AUTH_ENABLED=true`, lưu/restart B.

1. Dùng cửa sổ attacker để không mất trang owner; bấm Đăng xuất nếu đang login.
2. Mở `/login`. Lần đầu dùng tài khoản owner trong bảng mục 0 để chắc auth đang
   chạy. Sau đăng nhập thành công, bấm Đăng xuất rồi mở lại `/login`.
3. F12 → Network → Fetch/XHR. Điền `owner@local.test` và mật khẩu sai `WrongSynthetic517!`.
4. Bấm Đăng nhập; request POST `/api/auth/login` nhận 401 INVALID_CREDENTIALS.
   Không nhầm GET `/api/auth/csrf` 200 với kết quả POST login.
5. Ô mật khẩu được xóa sau mỗi lần gửi: nhập lại mật khẩu sai rồi bấm lần tiếp.
   Đếm tối đa 12 request POST đã hoàn tất, không click dồn lúc đang gửi.
6. Lab: cả 12 lần sai đều 401, không có 429. Không có nghĩa đã đoán đúng password.
7. Tắt auth flag, lưu và restart B để counter bắt đầu mới. Mở lại login.
8. Làm lại 12 lần sai: 10 lần đầu 401, từ lần 11 nhận 429 TOO_MANY_ATTEMPTS.
9. Sau 429, password đúng cũng có thể bị chặn trong cửa sổ đó; đây không phải
   lỗi session. Chờ hết window hoặc restart backend **local** để tiếp tục học.
   Incognito không đổi IP, không reset counter.

Script hỗ trợ để không đếm tay (mỗi lần chạy bắt đầu bằng backend mới; không chạy
sau khi bạn đã gửi các lần sai mà không restart):

```powershell
# Với flag true:
.\demo auth
# Tắt flag, lưu, restart B rồi mới chạy:
.\demo auth
```

Terminal hỏi API URL → mật khẩu **sai** dùng cho 12 lần thử. Có thể tự nhập
một mật khẩu sai hoặc Enter dùng gợi ý. Không dùng mật khẩu đúng ở câu hỏi này.
Restart backend trước mỗi lượt đo, không trộn 12 lần bấm tay và probe trong cùng
bộ đếm. Sau bài, tắt cờ và restart backend local để dùng web bình thường.

Lỗi lab bỏ rate limiter; bcrypt/session/CSRF vẫn có. Thiếu giới hạn tạo điều kiện
cho thử nhiều mật khẩu/credential stuffing và tiêu tốn tài nguyên. 12 lần kiểm
tra không chứng minh đã chiếm account.

Vá ở `routes/auth-routes.ts`: `loginLimiter` limit 10, window 15 phút,
`skipSuccessfulRequests: true`; chỉ gắn vào POST `/login` khi
`VULN_AUTH_ENABLED !== 'true'`, trước `sessionMiddleware`/bcrypt. Vì login đúng
không bị đếm, probe login owner thành công trước rồi mới gửi 12 lần sai. Nếu bộ
đếm đã có lần sai trước đó, 10 lần đầu của probe có thể không còn 401; restart
backend local để reset. `probes/auth.py::run` chỉ đo status/code, không triển khai
limiter. Limiter hiện theo IP và bộ nhớ một process: chưa là bảo vệ đầy đủ cho
distributed attacks, nhiều instance hay khóa nhầm người cùng IP. Bổ sung kiểm
soát theo account/rủi ro/MFA cần thiết kế riêng.

Output `auth` cần đọc (ví dụ rút gọn, synthetic):

```text
Kết quả 12 lần đăng nhập sai:
  Control login : 200 OK
  12 lần sai    : 401 INVALID_CREDENTIALS × 12
  429 đầu tiên  : không có

Đối chứng:
  Login đúng            : 200 OK (trước khi thử)
  Login đúng sau 12 lần : 200 OK

Giới hạn:
  Không tìm ra mật khẩu; không chiếm tài khoản.
```

Ở lượt secure, `12 lần sai` là `401 INVALID_CREDENTIALS × 10;
429 TOO_MANY_ATTEMPTS × 2` và `429 đầu tiên` là `lần 11`. Probe không in mật
khẩu sai; chỉ in chuỗi status/error code và vị trí 429.

### Request và code phòng vệ cụ thể

Mỗi lần thử sai gửi JSON dưới đây; CLI lấy token hiện hành trước mỗi POST:

```http
POST /api/auth/login
Content-Type: application/json
X-CSRF-Token: <token-hien-hanh>

{"email":"owner@local.test","password":"WrongSynthetic517!"}
```

Token được lấy lại vì login thành công rotate session. Trace đầu bài có một
login đúng và `/me`; sau đó mới là **12 POST sai**. Ở vulnerable, probe `auth`
còn login đúng một lần nữa sau 12 lần sai để kiểm tra auth vẫn hoạt động.
Vì vậy không đếm tất cả dòng `POST /login` trong trace thành số lần tấn công:
vulnerable thường có 14 POST login, secure 13, gồm các control đúng mật khẩu.
Body login không ghi vào trace/JSON. Câu hỏi mật khẩu sai yêu cầu 8–72 ký tự,
khác password owner; không đổi email đích qua câu hỏi này.

Trích rút gọn cấu hình đang có trong `auth-routes.ts`:

```typescript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: '...' } },
});
if (config.VULN_AUTH_ENABLED !== 'true') {
  authRoutes.post('/login', loginLimiter);
}
// Source gắn registerLimiter riêng; sau đó:
authRoutes.use(sessionMiddleware, csrfProtection);
// Các route GET/POST khác được lược bỏ.
authRoutes.post('/login', login);
```

`true` bỏ riêng limiter login. `false` đưa limiter vào trước session/CSRF/hash.
Ở browser xem status và `error.code`; response 429 có thể có RateLimit/Retry-After
headers. Mật khẩu đúng bị 429 sau giới hạn vì limiter chạy trước khi biết đúng
hay sai. Những request sai validation/CSRF cũng có thể ảnh hưởng bộ đếm, nên bắt
đầu backend mới và không trộn thao tác giữa các lượt so sánh.

Câu giải thích sau bài: “Bài này chứng minh thiếu giới hạn thử mật khẩu, chưa
đoán được mật khẩu. Bcrypt/session/CSRF vẫn còn. Khi bật phòng vệ, với bộ đếm mới,
request sai thứ 11–12 bị 429; kết quả không xuất phát từ việc API/DB bị lỗi.”

## 7. Port exposure — thực hành scanner bằng tay

Tại terminal A, dùng **một state riêng cho buổi này** và giữ nguyên đường dẫn
trong cả vòng:

```powershell
cd D:\PBL4-517
python scanner/scan.py 127.0.0.1 --ports 5173,8080 --state-file .local/runtime/manual.state.json --no-banner --no-alert
```

Nếu frontend chạy và không ai dùng 8080: thấy 5173 OPEN, 8080 CLOSED và INITIAL_SCAN.
Mở terminal D, tạo thư mục trống chỉ cho listener, không phục vụ thư mục repository:

```powershell
cd D:\PBL4-517
New-Item -ItemType Directory -Force .local/runtime/manual-port-empty | Out-Null
python -m http.server 8080 --bind 127.0.0.1 --directory .local/runtime/manual-port-empty
```

Giữ D mở. Ở A chạy lại **đúng lệnh scan trên**. Mong đợi 8080 OPEN
và NEW_PORT_DETECTED. Scan tiếp không thay đổi mong đợi NO_CHANGE. Ở D Ctrl+C,
quay A scan lại; nếu nhận refusal thì 8080 CLOSED/PORT_CLOSED. Timeout là uncertain,
không tự coi là đã đóng. Nếu port đã bị process khác dùng, kiểm tra nguồn trước,
không kill process không thuộc buổi demo.

Lệnh có --no-alert nên không gửi tin Telegram/Discord. Reports xem ở đường dẫn
scanner in ra; state riêng cho vòng này, cấu hình reports vẫn theo root env.
Nếu lần quét thất bại (DNS/state/lock) và không bật `--no-alert`, `latest.html`
được thay bằng trang lỗi nêu lý do và những gì **không** kết luận; đừng đọc nhầm
đó là báo cáo quét thành công. ChatOps có `/report` để gửi `latest.html` và
`latest.md` vào chat, nhưng chỉ khi bot đã được cấu hình.
Muốn receipt thật, cấu hình token/webhook riêng rồi **tự chọn bỏ --no-alert ngay
từ scan đầu tiên với state mới** theo scanner README. Không cần bật ChatOps để
scanner gửi alert. Script không tự đổi SG/NACL hoặc vá website.

Security Misconfiguration thực tế là expose service không cần thiết tới nguồn
không tin cậy. Vá bằng dừng service thừa, bind interface đúng và firewall/SG least
privilege. Listener loopback này chỉ mô phỏng phát hiện thay đổi port; chưa là
external AWS acceptance. EC2 phải có evidence rule/listener và giới hạn source.

**Request và source:** đây là phép kết nối TCP tới từng cổng, không phải HTTP
attack `/api/...`; `--no-banner` bỏ bước lấy banner. Đọc
[scan.py](../../scanner/scan.py): `scan_port` phân loại connect success/refused/
timeout, `evaluate_diff_and_notify` so baseline; [state_store.py](../../scanner/state_store.py)
lưu state dưới lock; [reporter.py](../../scanner/reporter.py) tạo trang báo cáo.
Report HTML mở bằng browser từ đường dẫn scanner in ra; F12 Network của website
không hiển thị TCP probe của Python. `--no-alert` không ghi report lỗi thay thế
khi scan thất bại, nên kiểm tra exit/error và thời điểm report, tránh xem nhầm
bản thành công cũ. Lệnh có state riêng không có nghĩa reports cũng có thư mục riêng.

Phòng vệ local chính là Ctrl+C dừng listener, rồi đo lại kết nối. Câu giải thích
sau bài: “Cùng state ghi nhận cổng mới mở rồi cổng đóng sau refusal; timeout vẫn
là chưa chắc. Báo cáo mô tả reachability và heuristic, không tự phát hiện SQLi,
không tự chỉnh Security Group và không chứng minh đã hoàn tất hardening AWS.”

## 8. Bảng request thật của từng probe

Bảng này đối chiếu `scripts/attacker/probes/` và `xss.mjs`; dùng khi bảo vệ cần
nói chính xác script gửi gì và in ra gì, không chỉ đọc kết quả cuối.

| Bài | Request chính | Điều kiện/control | Vulnerable | Secure |
| --- | --- | --- | --- | --- |
| IDOR đọc | `GET /api/orders/<orderId>` bằng session attacker | Owner đọc đơn trước và `userId` phải là owner | 200 kèm dữ liệu đơn owner | 403 `FORBIDDEN` |
| IDOR sửa | `PATCH /api/orders/<orderId>` body `{"shippingAddress":"..."}` | Đơn PENDING; địa chỉ mới khác địa chỉ cũ; so stock trước/sau | 200; owner đọc lại thấy địa chỉ mới; stock không đổi | 403; đơn và stock không đổi |
| IDOR hủy | `POST /api/orders/<orderId>/cancel` body `{}` | Đơn PENDING; so stock và trạng thái | 200; `CANCELLED`; stock mỗi item tăng đúng quantity | 403; vẫn `PENDING`; stock không đổi |
| SQLi | `GET /api/products?search=<payload>` | Tìm đúng tên sản phẩm phải có kết quả; tìm chuỗi không tồn tại phải rỗng | Payload `' OR '1'='1` trả cả sản phẩm fixture | Cùng payload trả `[]`; tìm tên hợp lệ vẫn được |
| XSS | `GET /api/products/<productId>` rồi Chromium mở `/products/<productId>` | Review fixture phải còn đúng payload; kiểm tra `.review-comment` | API có `labUnsafeReviewHtml: true`; DOM chạy marker `1` | Review là text; không có `img`; marker `undefined` |
| Auth | 12 lần `POST /api/auth/login` với mật khẩu sai | Login owner đúng trước; counter phải mới | 12 lần `401 INVALID_CREDENTIALS` | 10 lần `401`, 2 lần `429 TOO_MANY_ATTEMPTS` |

### Dữ liệu script in ra

| Bài | `observed` — chỉ thứ lỗi làm lộ/thay đổi | `controls` | `limits` |
| --- | --- | --- | --- |
| IDOR đọc | Đơn: mã, chủ đơn, người nhận/email/điện thoại/địa chỉ, trạng thái, tổng tiền, sản phẩm × số lượng × đơn giá. Secure: 403 + không có dữ liệu. **Không có stock.** | Owner GET 200; đơn/stock không đổi | Chỉ đơn fixture; không suy ra mọi endpoint |
| IDOR sửa | Địa chỉ trước/sau, body PATCH, trạng thái. Secure: 403 + không thay đổi | Owner GET 200; stock không đổi; trường khác giữ nguyên | Chỉ một đơn fixture; không test concurrency |
| IDOR hủy | `PENDING → CANCELLED`; stock trước/sau từng sản phẩm; số lượng hoàn. Secure: 403 + vẫn PENDING | Owner GET 200; phép cộng stock khớp quantity | Chỉ một đơn fixture |
| SQLi | Payload, số dòng, tên/id sản phẩm trả về ngoài filter (tối đa 5, còn lại `+N`). Secure: 0 dòng | Control dương có fixture; control âm 0; HTTP 200 | Chỉ search đọc; không chiếm DB/xóa bảng/chạy lệnh OS |
| XSS | Payload, review ID, `labUnsafeReviewHtml`, số `<img>`, marker. Secure: text, 0 img, `undefined` | Review còn qua API; trang 200 | Chỉ marker; không lấy cookie/gửi dữ liệu ra ngoài |
| Auth | Chuỗi 12 kết quả status/error code; vị trí 429 đầu tiên | Login đúng trước/sau; đúng `error.code` | Không tìm ra mật khẩu; không chiếm tài khoản |

Với target ngoài loopback, `observed` bị che mặc định (chỉ còn nhãn và
`<redacted: non-loopback target>`); thêm `--show-evidence` chỉ khi đã được phép.
Local loopback in đầy đủ dữ liệu synthetic. Không bao giờ in password, cookie,
CSRF token hay session.

Mọi POST/PATCH đều lấy CSRF token qua `GET /api/auth/csrf` trước; cookie session
do cookie jar của probe giữ. Probe không in cookie, CSRF token hay mật khẩu.
`POST /login` đúng ở đầu bài auth không bị tính vào limiter vì
`skipSuccessfulRequests: true`.

CSRF do probe tự xử lý không có nghĩa CSRF đã bị tắt trong lab. Đổi flag IDOR
chỉ bỏ ownership trong service; chưa login vẫn 401 và token sai vẫn có thể
403 `CSRF_INVALID`. Đây là các guard khác với bài IDOR.

## 9. Kết thúc và đọc kết quả

Các flag false, APP_PROFILE có thể về production (NODE_ENV vẫn development cho
HTTP local). Lưu và restart B nếu muốn dùng website bình thường. Khi xong: Ctrl+C
ở B/C/D nếu còn chạy, tại A:

```powershell
docker compose --env-file .local/private/database.env stop db
```

Không dùng seed/reset cả DB để kết thúc buổi. Không commit env, manifest, dump,
cookie hoặc password. Chỉ đưa báo cáo đã rà soát vào evidence.

| Kết quả | Ý nghĩa |
| --- | --- |
| EXPLOIT_CONFIRMED | Đã quan sát hành vi lỗi trên fixture |
| DEFENSE_VERIFIED | Control hợp lệ và hành vi trái phép bị chặn đúng bài |
| INCONCLUSIVE | Điều kiện thử không đạt; không kết luận đã vá |
| 401 | Chưa xác thực hoặc credentials sai, tùy endpoint |
| 403 FORBIDDEN ở IDOR | Đã login nhưng không có quyền với đối tượng |
| 403 CSRF | Token/phiên không đúng; không là bằng chứng chặn IDOR |
| 404 | ID/route không tồn tại; không thay cho secure retest đúng fixture |
| 429 | Rate limiter chặn; cần xét bộ đếm trước đó |
| 500/502/503 | Lỗi vận hành/phụ thuộc; không là phòng vệ đã chứng minh |

Sau mỗi `.\demo`, xem ngay trong cùng terminal A:

```powershell
$LASTEXITCODE
```

Lệnh thường: exit **0** khi có kết luận rõ, dù tái hiện được lỗi hay đã chặn.
Khi thêm `--expect`, **0** là khớp kỳ vọng, **1** là không khớp; **2**: INCONCLUSIVE; **130**: hủy do Ctrl+C/EOF. Từ chối xác nhận
sửa/hủy (`n`/Enter) trả 0 nhưng **không chạy probe và không có kết luận PASS**.
Kết quả EXPLOIT_CONFIRMED khi yêu cầu secure sẽ có `passed: False`/exit 1.
DEFENSE_VERIFIED khi yêu cầu vulnerable cũng là mismatch, không phải tái hiện lỗi.

Mỗi lần có JSON hợp lệ từ probe, launcher ghi **hai** file cùng tên:
`.local/reports/security/<scenario>.json` và `.md` cho lệnh thường (ví dụ
`idor.json`, `idor.md`); khi đặt kỳ vọng, dùng `<scenario>-<expect>.json`/`.md`
(ví dụ `idor-secure.json`). File JSON để máy đọc/automation; file Markdown để
người đọc và đưa vào báo cáo. Chạy lại cùng bài/cùng kiểu lệnh sẽ ghi đè cả hai.
Lỗi trước khi có report hoặc từ chối xác nhận không tạo report mới; file cũ có
thể vẫn còn. Đọc `at`, `result`, `completed`, `requests` và
`evidence.observed/controls/limits`; khi đặt kỳ vọng có thêm
`expected`/`passed` thay cho `completed`. Đọc `detail` (nếu có) để xác định đúng
lượt; giờ `at` là UTC, cộng 7 giờ cho Việt Nam/Bangkok. Lưu bản đã rà soát sang
tên có ngày trước khi chạy lại nếu cần giữ evidence.

Với `npm run dev`, `/api/version` có thể trả `revision: unbuilt`, `dirty: true`
vì không có release metadata cạnh TypeScript source. Đây không phải lỗi bài
demo local, cũng không là xác minh exact commit. Ghi thêm `git rev-parse HEAD`
và `git status --short` để mô tả working tree. Chỉ quy trình release EC2 riêng
mới yêu cầu SHA sạch và kiểm tra artifact; không gán nhãn release verified cho
lượt chạy dev này.

### Khi kết quả không như mong đợi

| Hiện tượng | Kiểm tra/khắc phục trong đúng luồng tay |
| --- | --- |
| `Invalid environment` | Đọc tên biến trong lỗi, kiểm tra APP_PROFILE/ack/flag; giữ DATABASE_URL/SESSION_SECRET riêng tư, sửa file rồi restart B |
| Web 5173 lên nhưng API 502/503 | Kiểm tra terminal B, Docker DB và `/api/health`; frontend không tự tạo dữ liệu khi API chết |
| `.\demo` không hỏi | Gõ trực tiếp trong terminal, bỏ pipe/redirect/`--non-interactive`; không có câu hỏi lượt |
| Sửa flag trong file nhưng hành vi chưa đổi | Restart B; xem override không nhạy cảm; kiểm tra có dùng nhầm managed backend hay không |
| Không tìm thấy fixture/account sai | Dừng server và làm setup theo website README; không tự sửa ID/password trong manifest hoặc chạy seed để đoán |
| IDOR update/cancel INCONCLUSIVE vì PENDING | Dừng B, `.\dev reset-order`, chạy lại B; chỉ reset fixture đã xác minh |
| CLI mutation bị hủy | Chạy lại, xem body trước rồi nhập `y`; Enter mặc định không gửi |
| SQLi secure có kết quả ngoài dự kiến | Chọn Tất cả, giữ đúng payload/control; đọc `data`, không chỉ đếm card hoặc status 200 |
| XSS secure vẫn thấy marker 1 | Reload document mới; kiểm tra review còn nguyên và nhánh render qua API/DOM, không tự gán marker |
| XSS không mở browser ra màn hình | Chromium probe chạy headless; tự mở URL sản phẩm đã in để thao tác bằng tay |
| Auth 429 sớm hoặc login control thất bại | Restart B cho bộ đếm mới; không trộn browser/probe, không đổi incognito để reset IP counter |
| Port `EADDRINUSE` | Kiểm tra terminal/process đang dùng port; không kill process lạ hoặc chạy thêm launcher chồng lên server tay |

Kết thúc còn một lượt chức năng bình thường: khi mọi flag false, restart B,
owner đăng nhập, tìm sản phẩm, xem chi tiết và tạo **đơn khác fixture** qua giỏ
hàng. Reload đơn vừa tạo để kiểm tra lưu server. Chỉ ghi PASS nếu bạn thực hiện
và quan sát được; không dùng sự có mặt của source làm bằng chứng đã chạy.

Mapping của dự án dùng OWASP 2021: A01 IDOR, A03 SQLi/XSS, A07 auth, A05 cấu hình.
Cùng payload và dữ liệu trước/sau, người dùng hợp lệ vẫn hoạt động, ghi ngày/revision
và giới hạn. Không nói "không còn mọi lỗ hổng" từ những bài PASS này.

Nguồn giải thích/phòng vệ:
[IDOR](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html),
[SQLi](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html),
[XSS](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html),
[Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
