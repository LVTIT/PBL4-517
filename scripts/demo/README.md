# Vừa học vừa demo KEVILO trên local

**Tự chạy tay, đăng nhập từng cửa sổ và xem từng request:** đọc
[MANUAL.md](MANUAL.md). Đây là lộ trình dành cho người mới đang học từng thao tác.
MANUAL có bản đồ file/symbol, thứ tự câu hỏi, request/body, giải thích kết quả,
browser/DOM và code phòng vệ từng bài, đối chiếu working tree ngày 2026-11-10.
Phần dưới dùng `.\demo` để chạy probe trên website bạn tự khởi động. `.\dev` chỉ
dùng cho setup/up/down, reset fixture và port lab; không trộn process do
`.\dev up` quản lý với server bạn tự chạy tay.

Refs #68, Related to #44. Đây là hướng dẫn thực hành với dữ liệu giả trên máy
mình. [Setup/env/lệnh chuẩn](../../website/README.md#local-nhanh-tren-windows),
[bản đồ code](../../docs/LEARNING_PATH.md), [EC2](../../docs/aws/DEMO.md).

## Bắt đầu

Sau setup rồi tự chạy DB/API/frontend theo website README, mở
<http://127.0.0.1:5173>. Website và mọi bài
demo dùng **cùng database kevilo_local_lab**, cùng URL. Các cờ mặc định false.

Ba tài khoản local đã được setup tạo sẵn, không cần mở file JSON:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Chủ đơn | `owner@local.test` | `Owner517!demo` |
| Khách khác | `attacker@local.test` | `Attacker517!demo` |
| Quản trị | `admin@local.test` | `Admin517!demo` |

Script tự đọc manifest nội bộ để lấy `orderId`, `productId`, `reviewId` và tự in
URL browser sau mỗi bài. Bạn **không cần** mở `.local/private/lab-fixtures.json`,
không copy ID/password thủ công. Không commit/chụp manifest hoặc file env.

Owner và attacker dùng hai browser profile hoặc một cửa sổ thường và một ẩn danh.
Không dùng hai tab cùng profile vì chúng chia sẻ cookie. Admin được phép quản lý
đơn nên không thể dùng admin để chứng minh người lạ bị chặn.

Chạy bài ngắn rồi trả lời câu hỏi trong terminal:

```powershell
.\demo idor          # hỏi API URL và order; báo kết quả thực tế
```

Mỗi bài: đoán kết quả → chạy lượt lỗi → quan sát → đọc code → chạy lượt secure → quan
sát cùng đối tượng/payload. Không sửa source hoặc rebuild giữa hai lượt. Sau khi
script gửi request, terminal hiện trace/status theo thời gian thực, sau đó
báo kết quả, dữ liệu quan sát/đối chứng/giới hạn và đường dẫn JSON + Markdown.
Giải thích/browser/code vá nằm trong MANUAL.md.

## 1. IDOR — truy cập đơn của người khác

```powershell
# Trong website/backend/.env: APP_PROFILE=lab, LAB_DATA_ACK=synthetic-only,
# chỉ VULN_IDOR_ENABLED=true; lưu và restart backend (MANUAL.md mục 0).
.\demo idor
# Sau khi quan sát trên browser và đọc code, đặt VULN_IDOR_ENABLED=false,
# restart backend, rồi:
.\demo idor
```

`.\demo` chỉ đọc fixture, chạy probe và kiểm chứng; nó **không** đổi env, không
restart hay khởi động server. Việc bật/tắt cờ và restart backend do người vận
hành làm. Script hiện email đóng vai, tóm tắt fixture, trace API, dữ liệu quan
sát/đối chứng/giới hạn, URL đơn/sản phẩm và kết quả; không in mật khẩu, cookie
hoặc CSRF token. `--expect secure|vulnerable` chỉ là kỳ vọng tùy chọn cho
CI/automation; nó không tắt/bật flag. [Ý nghĩa từng lệnh](MANUAL.md#lệnh-terminal-có-nghĩa-gì-có-cần-secure-không).

**Lỗi làm gì?** Backend nhận ID của đơn từ URL. Nếu chỉ tìm `id` và quên kiểm tra
người đang đăng nhập có sở hữu đơn hay không, khách B biết ID có thể đọc đơn A.
UUID khó đoán không thay thế phân quyền; ID có thể lộ qua URL, log hoặc liên kết.

**Quan sát bằng tay:** đăng nhập owner ở cửa sổ A và attacker ở cửa sổ B. Dùng
đúng URL script in ra (dạng `http://127.0.0.1:5173/orders/<orderId>`) ở cả hai.
Khi mode idor: B đọc được đơn của A. Sau secure: refresh cùng URL ở B, API trả
`403 FORBIDDEN`; A vẫn đọc được. DevTools → Network → request
`/api/orders/<orderId>` giúp thấy khác biệt HTTP.

**Tác hại:** lộ tên/địa chỉ/liên hệ/chi tiết mua hàng; nếu endpoint sửa/hủy cũng
thiếu kiểm tra thì có thể đổi địa chỉ nhận hàng hoặc phá giao dịch. Bài lab chỉ
tác động đơn giả. Nó không chứng minh mọi endpoint trong hệ thống đều có IDOR.

**Code vá ở đâu?** [order-service.ts](../../website/backend/src/services/order-service.ts),
`getOrderById`, `updateOrderDetails`, `cancelOrder`: nhánh secure truy vấn có
`where: { id: orderId, userId: requestingUserId }`. Sửa địa chỉ đọc kiểm tra quyền
rồi update theo ID; chưa có conditional UPDATE nguyên tử cho thao tác này.
Quyền lấy từ session server,
không tin userId client gửi. Hủy đơn còn có transaction/conditional claim để bảo
vệ tồn kho khi nhiều request chạy đồng thời. Nhánh lab cố tình bỏ ownership guard.

**Script kiểm tra gì?** [probes/idor.py](../attacker/probes/idor.py), hàm `run`:
login hai tài khoản riêng, chủ đơn đọc được, người lạ bị cấm và dữ liệu/stock
không đổi ở secure; evidence chỉ in đơn bị lộ, không in stock. `.\demo` chỉ gọi
probe và kiểm chứng; người vận hành tự bật `VULN_IDOR_ENABLED` và restart
backend. Nó không vá API.

Nâng cao, làm riêng từng vòng:

```powershell
# Mỗi vòng: bật đúng một cờ, restart backend, chạy probe; sau đó tắt cờ và
# restart trước khi chạy lượt secure.
.\demo idor-update
.\demo idor-update
.\demo idor-cancel
.\demo idor-cancel
```

Trước lượt cần PENDING, dừng backend và chạy `.\dev reset-order` để reset **đúng
fixture đã xác minh**; không reset toàn database, rồi restart backend. Nếu chỉ
nhận 400 vì đơn đã hủy thì chưa chứng minh phân quyền. Probe kiểm tra cả tác
động lưu DB và hoàn kho.

Tự trả lời: vì sao ẩn nút ở frontend hoặc đổi ID sang UUID chưa vá được IDOR?

## 2. SQL Injection — dữ liệu tìm kiếm thành lệnh SQL

```powershell
# Bật riêng VULN_SQLI_ENABLED=true, restart backend.
.\demo sqli
# Tắt cờ, restart backend.
.\demo sqli
# Tại trang Sản phẩm, thử tìm chuỗi dưới đây rồi quan sát danh sách:
# ' OR '1'='1
```

**Lỗi làm gì?** [product-service.ts](../../website/backend/src/services/product-service.ts),
`listProductsWithRawSql`: nhánh lab nối search trực tiếp vào chuỗi SQL rồi gọi
`$queryRawUnsafe`. Dấu nháy và biểu thức OR làm thay đổi điều kiện truy vấn thay
vì chỉ tìm sản phẩm có tên phù hợp. DevTools xem request `/api/products?search=...`.

**Quan sát:** tìm chuỗi vô nghĩa trước phải không có kết quả. Với payload trên,
vulnerable trả về sản phẩm dù không chứa chuỗi đó. Secure coi payload là dữ liệu
tìm kiếm thông thường và không trả sản phẩm giả. Tìm tên sản phẩm hợp lệ vẫn chạy.

**Tác hại có thể xảy ra:** bỏ qua điều kiện lọc, đọc dữ liệu ngoài phạm vi; tùy
câu SQL và quyền database, lỗi tương tự có thể dẫn tới sửa/xóa dữ liệu. Probe này
chỉ kiểm tra search chỉ đọc; không thực hiện xóa bảng hay khẳng định đã chiếm DB.

**Vá:** `listProducts` dùng `prisma.product.findMany` với `contains` và điều kiện
có cấu trúc; Prisma parameterize giá trị. Nếu cần SQL thô phải dùng binding/tham
số đúng cách. Không dùng nối chuỗi, escape thủ công hoặc blacklist từ khóa làm
biện pháp chính. Role ít quyền là lớp bổ sung, không thay việc sửa query.

**Script:** [probes/sqli.py](../attacker/probes/sqli.py), hàm `run`: kiểm tra
search đúng tên, search không tồn tại, rồi cùng payload ở hai lượt; evidence in
số dòng và tên/id sản phẩm bị trả về ngoài filter. `VULN_SQLI_ENABLED=false`
chọn nhánh Prisma đã phòng vệ.

Tự trả lời: vì sao validation frontend không đủ nếu có thể gọi API trực tiếp?

## 3. Stored XSS — review trở thành JavaScript trong browser

```powershell
# Bật riêng VULN_XSS_ENABLED=true, restart backend.
.\demo xss
# Tắt cờ, restart backend.
.\demo xss
# Mở URL sản phẩm mà script in ra.
```

Fixture đã lưu một review chứa marker vô hại:

```html
<img src="/missing-pbl517-probe" onerror="window.__pbl517_xss_probe=1">
```

**Lỗi làm gì?** Nội dung review được lưu PostgreSQL rồi hiển thị cho người xem
sản phẩm. Ở lab, backend trả `labUnsafeReviewHtml`, và
[ProductDetailPage.tsx](../../website/frontend/src/pages/ProductDetailPage.tsx)
dùng `dangerouslySetInnerHTML`. Trình duyệt tạo phần tử img; ảnh lỗi kích hoạt
handler. Đây là **Stored XSS** vì payload đã lưu, không chỉ nằm trong URL.

**Quan sát:** trong Console của trang sản phẩm, đọc
`window.__pbl517_xss_probe`: vulnerable là `1`. Sau secure reload, review hiện như
văn bản, marker không tồn tại. Probe Chromium tự kiểm tra cả DOM và marker.
Không chỉ nhìn xem có hộp thoại alert hay không. Không xóa review giữa hai lượt.

**Tác hại có thể xảy ra:** giả mạo nội dung, lừa nhập thông tin, đọc dữ liệu mà
JavaScript cùng origin được phép đọc hoặc gửi thao tác dưới phiên nạn nhân nếu
đủ điều kiện. Cookie HttpOnly ngăn JS đọc cookie, nhưng không loại bỏ mọi tác
hại XSS. Marker của bài này không lấy cookie hoặc gửi dữ liệu ra ngoài.

**Vá:** secure render `{r.comment}` để React escape nội dung, không chèn HTML tùy
ý. Nếu sau này thật sự cần rich text thì phải thiết kế allowlist/sanitization
phù hợp; hiện chưa có yêu cầu đó. CSP là lớp bổ sung, không thay sửa chỗ render.

**Script:** [xss.mjs](../attacker/xss.mjs) mở Chromium, chứng minh review vẫn đúng
payload trong DB/API, rồi kiểm tra marker hoặc text escaping. Cờ
`VULN_XSS_ENABLED` điều khiển nhánh lab; không phải script xóa payload để giả vá.

Tự trả lời: vì sao cùng chuỗi được lưu trong DB nhưng hai cách render có kết quả khác?

## 4. Authentication — bỏ giới hạn thử mật khẩu

Làm bài này cuối cùng:

```powershell
# Bật riêng VULN_AUTH_ENABLED=true, restart backend.
.\demo auth
# Tắt cờ, restart backend.
.\demo auth
# Sau quan sát, để mọi VULN_* false và tự restart backend local.
# Không gọi dev up khi đang chạy server bằng tay.
```

**Lỗi thực nghiệm:** nhánh lab bỏ login rate limiter, không bỏ bcrypt, session
hay CSRF. Đây là demo thiếu giới hạn thử đăng nhập, không phải toàn bộ các lỗi
xác thực hoặc một cuộc tấn công đã tìm ra mật khẩu.

**Quan sát:** probe login đúng trước để xác nhận auth hoạt động, rồi gửi 12 lần
sai có giới hạn. Lab: 12 lần `401 INVALID_CREDENTIALS`. Secure: 10 lần đầu 401,
từ lần 11 `429 TOO_MANY_ATTEMPTS`. Xem kết quả JSON hoặc request trong công cụ
debug. Không chạy check liên tục sau secure rồi cho rằng login bị hỏng.

**Tác hại:** nếu không giới hạn, kẻ tấn công có thể tự động đoán mật khẩu hoặc
thử credential bị lộ, làm tăng nguy cơ chiếm tài khoản và tiêu tốn tài nguyên.
Bài này không gửi request số lượng lớn và không chứng minh đã chiếm tài khoản.

**Vá:** [auth-routes.ts](../../website/backend/src/routes/auth-routes.ts),
`loginLimiter`: limit 10, window 15 phút, đặt trước session/password hashing;
secure gắn middleware vào POST `/login`. Bcrypt bảo vệ password lưu trữ, session
rotation/CSRF bảo vệ các mặt khác. Rate limit hiện theo IP và trong bộ nhớ một
process; hệ thống nhiều instance cần thiết kế limiter dùng chung và chống khóa
nhầm người dùng. Restart lab làm mới counter để so sánh, không là cách vận hành
production để vượt limiter.

**Script:** [probes/auth.py](../attacker/probes/auth.py), hàm `run`: xác nhận
đúng mã lỗi và vị trí bắt đầu 429; evidence in chuỗi 12 status/error code, không
in mật khẩu sai. `VULN_AUTH_ENABLED=false` đưa middleware về. Incognito không
đổi IP nên không xóa được bộ đếm. Tắt cờ rồi restart backend để nhóm đăng nhập
lại bình thường; `.\dev up` chỉ dùng nếu bạn đang ở managed mode, không dùng khi
server chạy tay.

## 5. Port exposure — nối scanner với cấu hình hạ tầng

```powershell
.\dev ports
.\dev open-port
.\dev ports
.\dev close-port
.\dev ports
```

Giữ cùng state suốt vòng. Lần đầu mong đợi `INITIAL_SCAN` (nếu state mới); sau mở
8080 thấy `NEW_PORT_DETECTED`; sau dừng listener và nhận TCP refusal mới có
`PORT_CLOSED`. Nếu state đã có thì INITIAL không lặp lại; xem trạng thái thực tế,
không tự xóa baseline đang dùng để tạo kết quả đẹp.

Listener chỉ bind `127.0.0.1`, phục vụ thư mục trống. Các lệnh trên **không gửi
tin thật**; báo cáo ở `.local/reports/scanner/latest.html`. Nếu một lần quét thất
bại (DNS/state/lock), `latest.html` được thay bằng trang lỗi nêu lý do và những gì
**không** kết luận, để không đọc nhầm báo cáo cũ. Để thử receipt thật, cấu hình
root env rồi tự chạy lệnh scanner theo [scanner README](../../scanner/README.md).
Bot/timer không tự bật cùng website. ChatOps có `/status`, `/report` (gửi file
`latest.html`/`latest.md` vào chat), `/scan`, `/ping`, `/help`; `/report` chỉ đọc
đúng hai file báo cáo mới nhất, không gửi file ngoài đường dẫn cấu hình.

**Tác hại thực tế:** service không cần thiết có thể tạo thêm bề mặt tấn công khi
expose ra mạng không tin cậy. Chỉ thấy port mở chưa chứng minh có CVE hoặc dịch
vụ không xác thực. Local loopback là mô phỏng; chưa chứng minh external AWS scan.
Trên EC2 phải kiểm tra cả listener và SG/NACL, chỉ mở lab cho IP scanner `/32`,
gỡ rule/listener sau thử. Không mở PostgreSQL/API để tạo cảnh báo.

**Vá ở đâu?** Dừng service thừa, bind đúng interface và giới hạn firewall/SG.
Scanner quan sát và cảnh báo; nó không tự thay AWS rule hoặc vá website.
Timeout/filtered là uncertain, không ghi thành CLOSED. Điểm port là heuristic,
không phải CVSS. Source: scanner `scan.py`, `state_store.py`, `alerts/notifier.py`.

## Đọc kết quả và kết thúc

| Output | Cách hiểu |
| --- | --- |
| EXPLOIT_CONFIRMED | Đã tái hiện được hành vi lỗi |
| DEFENSE_VERIFIED | Payload bị chặn/escape đúng bài, control hợp lệ |
| INCONCLUSIVE | Sai fixture, TLS/login/CSRF, timeout hoặc API/browser lỗi; chưa kết luận |

JSON lệnh thường ở `.local/reports/security/<scenario>.json`; đặt kỳ vọng dùng
`<scenario>-<expect>.json`. Cùng tên với phần mở rộng `.md` là bản đọc được
(tóm tắt evidence, đối chứng, giới hạn và request). Mỗi lần chạy cùng kiểu sẽ ghi
đè cả hai; log process ở `.local/runtime/logs/` chỉ có khi dùng managed launcher;
server chạy tay ghi log ở terminal B/C. Chạy lại `.\demo <bài>` khi
cần, nhưng auth counter và các bài sửa/hủy có điều kiện trạng thái; nên bắt đầu
lại đúng lượt cho vòng demo mới. `--expect secure|vulnerable` chỉ cần khi muốn
kiểm tra PASS/FAIL theo kỳ vọng; lệnh thường không hỏi lượt và không suy kết quả
từ file env.

Kết thúc luồng tay: tắt cờ lab và restart backend để kiểm tra chức năng bình
thường; sau đó Ctrl+C các terminal web/listener và dừng database theo MANUAL.
Nếu dùng managed mode trong một lượt riêng, kết thúc bằng `.\dev down`.
Ghi revision, working-tree dirty/clean, ngày, mode, payload, kết quả và giới hạn.
Không chia sẻ manifest credential, cookie hoặc nguyên env. Local build dirty
không được coi là release EC2 sạch.

## Kịch bản bảo vệ và tự học

Bản đầy đủ 25–30 phút: kiến trúc 3 phút → website bình thường 3 phút → scanner /
baseline/port mới/rollback 7 phút → bốn bài web 12 phút → log/kết luận 3 phút.
Bản ngắn 10 phút: kiến trúc, IDOR, SQLi, scanner, trạng thái cuối. Evidence dự
phòng luôn ghi ngày/commit và không trình bày như kết quả live.

Mapping dùng **OWASP Top 10:2021**: A01 IDOR; A03 SQLi/XSS; A07 authentication;
A05 misconfiguration. Có năm kịch bản trong bốn nhóm, không phải năm nhóm riêng.
Bản 2025 giữ A01/A07, đổi Injection sang A05 và Misconfiguration sang A02.
Nguồn: [OWASP 2025](https://top10.owasp.org/2025/0x00_2025-Introduction/).

Sau mỗi bài, tự giải thích: input nào không tin cậy, kiểm soát bị bỏ ở đâu, tác
động nào đã đo được, kiểm soát secure thay đổi gì, control dương chứng minh gì,
và kết quả chưa chứng minh được điều gì. Một bạn khác cần tự chạy lại để xác nhận
bàn giao; agent không tự tick tiêu chí cả nhóm hiểu bài.
