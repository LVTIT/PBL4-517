# Website PBL4-517

Skeleton thương mại điện tử cho [Issue #8 — WEB-02](https://github.com/LVTIT/PBL4-517/issues/8), theo [technology stack đã chốt ở Issue #7](../docs/README.md). Trang chủ, danh sách sản phẩm và đăng nhập kết nối với Express và PostgreSQL thật.

## Requirements

- Git.
- **Node.js 24 LTS** và npm đi kèm. Kiểm tra bằng `node --version` và `npm --version`.
- **PostgreSQL 16** đang chạy, kèm công cụ `psql`; hoặc Docker để chạy PostgreSQL 16 theo lựa chọn bên dưới.
- Hai terminal để chạy backend và frontend.

Frontend dùng React, TypeScript, Vite và CSS thuần. Backend dùng Express 5, TypeScript và Prisma ORM 7. Hai project có `package-lock.json` riêng; dùng `npm ci` để cài đúng phiên bản đã khóa.

Trên Windows PowerShell, nếu `npm` bị chặn bởi execution policy, dùng **`npm.cmd`** thay cho `npm` trong mọi lệnh bên dưới. Không cần đổi execution policy của máy.

## Project structure

```text
website/
├── README.md
├── frontend/
│   ├── src/
│   │   ├── components/   # Header, hiển thị sản phẩm và thành phần dùng chung
│   │   ├── pages/        # Home, Products, Login
│   │   ├── services/     # Gọi /api và xử lý session/CSRF
│   │   └── types/        # Kiểu dữ liệu API
│   ├── vite.config.ts   # Proxy /api tới backend local
│   └── package-lock.json
└── backend/
    ├── .env.example
    ├── prisma.config.ts # URL database và seed cho Prisma 7
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/  # SQL migration được commit
    │   └── seed.ts
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── middleware/
    │   ├── services/
    │   ├── lib/
    │   ├── types/
    │   ├── app.ts
    │   └── server.ts
    └── package-lock.json
```

## Clone repository

```sh
git clone https://github.com/LVTIT/PBL4-517.git
cd PBL4-517
```

Các lệnh dưới đây bắt đầu từ thư mục repository, trừ khi đã ghi thư mục khác.

## Setup database

Chọn **một** trong hai cách. Database ví dụ là `pbl517`, user là `pbl517_app`. Chuỗi `local_dev_password` chỉ là mật khẩu minh họa cho database local; thay bằng mật khẩu của bạn và dùng cùng giá trị trong `.env`.

### Cách A: PostgreSQL 16 đã cài trên máy

Khởi động dịch vụ PostgreSQL 16. Mở `psql` bằng tài khoản quản trị PostgreSQL:

Windows, với `psql` trong `PATH`:

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

Nếu `psql` chưa ở `PATH`, có thể dùng đường dẫn mặc định:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

Linux có cài PostgreSQL dưới dạng service:

```sh
sudo -u postgres psql
```

Chạy SQL sau trong `psql`, chỉ cần một lần:

```sql
CREATE USER pbl517_app WITH PASSWORD 'local_dev_password';
CREATE DATABASE pbl517 OWNER pbl517_app;
\q
```

User sở hữu database nên có quyền tạo các bảng migration; không cần cấp `SUPERUSER`. Các bước setup dùng `migrate deploy`, vì vậy không yêu cầu quyền tạo shadow database.

Kiểm tra kết nối từ TCP bằng lệnh sau và nhập mật khẩu vừa đặt:

```sh
psql -h 127.0.0.1 -p 5432 -U pbl517_app -d pbl517 -c "SELECT version();"
```

### Cách B: PostgreSQL 16 trong Docker

Khi Docker đang chạy, thực hiện một lệnh sau trên Windows PowerShell hoặc Linux:

```sh
docker run --name pbl517-postgres -e POSTGRES_USER=pbl517_app -e POSTGRES_PASSWORD=local_dev_password -e POSTGRES_DB=pbl517 -p 127.0.0.1:5432:5432 -v pbl517-postgres-data:/var/lib/postgresql/data -d postgres:16
```

Đợi database sẵn sàng:

```sh
docker exec pbl517-postgres pg_isready -U pbl517_app -d pbl517
```

Kết quả phải có `accepting connections`. Dữ liệu được giữ trong Docker volume. Lần sau dùng `docker start pbl517-postgres`; dừng bằng `docker stop pbl517-postgres`. Biến `POSTGRES_*` chỉ khởi tạo user/password/database khi volume còn trống. Đây là cấu hình development local, không phải mẫu phân quyền production.

Nếu máy đã có PostgreSQL chiếm port 5432, dùng cách A hoặc đổi phần publish thành `127.0.0.1:5433:5432` và đổi port trong `DATABASE_URL` thành `5433`.

## Environment

Đi vào backend:

```sh
cd website/backend
```

Tạo file `.env` từ file mẫu, **không commit `.env`**.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux/macOS:

```sh
cp .env.example .env
```

Tạo session secret ngẫu nhiên bằng Node, rồi chép kết quả vào `SESSION_SECRET` trong `.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Ví dụ cấu hình (điền `SESSION_SECRET` bằng kết quả của lệnh trên; backend sẽ từ chối chạy nếu để trống):

```dotenv
DATABASE_URL=postgresql://pbl517_app:local_dev_password@127.0.0.1:5432/pbl517?schema=public
SESSION_SECRET=
PORT=3000
NODE_ENV=development
TRUST_PROXY=0
```

| Biến | Ý nghĩa |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL của database vừa tạo. Nếu mật khẩu có ký tự đặc biệt như `@`, `:`, `/`, `%`, phải percent-encode phần mật khẩu trong URL. |
| `SESSION_SECRET` | Secret riêng cho mỗi môi trường, tối thiểu 32 ký tự ngẫu nhiên; giữ ổn định giữa các lần restart nếu muốn giữ session. |
| `PORT` | Backend local mặc định `3000`. Nếu đổi, cập nhật target trong `frontend/vite.config.ts` tương ứng. |
| `NODE_ENV` | Dùng `development` để test HTTP local. `production` bật cookie Secure, cần HTTPS. |
| `TRUST_PROXY` | `0` khi không có reverse proxy; khi chạy sau Nginx cùng máy có thể cấu hình `loopback`. Chỉ tin proxy thật sự kiểm soát. |

Không đặt database URL, session secret hay mật khẩu vào biến `VITE_*`; các biến frontend có thể nằm trong bundle gửi đến trình duyệt.

## Backend setup

Trong `website/backend`, sau khi tạo `.env` và database:

```sh
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run build
npm run dev
```

Giữ terminal này mở. Backend bind loopback `127.0.0.1`, chạy tại **http://127.0.0.1:3000**. `npm run dev` theo dõi TypeScript; thay đổi source sẽ restart server.

### Prisma

| Lệnh (trong `website/backend`) | Mục đích |
| --- | --- |
| `npm run prisma:generate` | Tạo Prisma Client từ schema. Chạy lại khi sửa schema hoặc sau khi cài dependency. |
| `npm run prisma:migrate` | Chạy `prisma migrate deploy`, áp dụng các migration đã commit; dùng khi clone mới và khi triển khai. |
| `npm run prisma:seed` | Chạy seed rõ ràng sau migration, tạo tài khoản và sáu sản phẩm demo. |
| `npm run prisma:migrate:dev -- --name describe_change` | Tạo migration mới khi phát triển schema. Cần quyền tạo shadow database hoặc cấu hình shadow database riêng. Commit SQL migration sinh ra. |

Prisma 7 lấy URL từ `prisma.config.ts`, dùng PostgreSQL driver adapter và client được generate; không dùng cấu hình URL theo tutorial Prisma 5/6. CLI và Client được khóa cùng phiên bản 7.x. Không cần `prisma db push` để chạy project. Đối chiếu [hướng dẫn chính thức Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) khi sửa cấu hình hoặc nâng cấp dependency.

Schema có `User`, `Product` và bảng lưu session. Email unique; password lưu dưới dạng hash. Giá sản phẩm dùng PostgreSQL `DECIMAL`, API gửi giá dạng chuỗi để tránh mất độ chính xác; frontend định dạng thành VND khi hiển thị.

Seed chỉ dành cho development/testing và bị chặn khi `NODE_ENV=production`. Chạy seed lại không cần xóa database: script upsert theo email/ID cố định, khôi phục mật khẩu/role tài khoản demo và dữ liệu sáu sản phẩm demo.

## Frontend setup và Run local

Mở **terminal thứ hai** từ thư mục repository:

```sh
cd website/frontend
npm ci
npm run build
npm run dev
```

Mở **http://127.0.0.1:5173**:

- `/`: trang chủ và liên kết đến sản phẩm/đăng nhập.
- `/products`: sản phẩm lấy từ PostgreSQL qua `GET /api/products` (hỗ trợ tìm kiếm `search` và lọc `category`).
- `/products/:id`: xem chi tiết sản phẩm, tồn kho và danh sách đánh giá từ khách hàng.
- `/cart`: giỏ hàng mua sắm, chọn số lượng và đặt hàng (`CartContext`).
- `/orders`: xem lịch sử đơn hàng đã đặt của tài khoản hiện tại.
- `/login`: đăng nhập thật bằng session cookie.
- `/register`: đăng ký tài khoản thành viên mới.
- `/profile`: quản lý họ tên và đổi mật khẩu an toàn.
- `/admin`: bảng điều khiển quản trị (thêm/xóa sản phẩm, duyệt và đổi trạng thái đơn hàng; chỉ tài khoản `ADMIN` mới truy cập được).

Giữ cả hai terminal chạy. Dùng cùng `http://127.0.0.1:5173` trong quá trình test vì `localhost` và `127.0.0.1` là hai cookie host khác nhau.

```text
Browser → Vite :5173
            ├── React frontend (SPA)
            └── /api/ → Express 127.0.0.1:3000 → Prisma → PostgreSQL
```

Frontend gọi đường dẫn tương đối `/api/...`; Vite proxy giữ cùng origin trong trình duyệt, nên không cần CORS. Khi triển khai Nginx sau này, frontend giữ nguyên cách gọi API.

## Test accounts

Sau khi seed:

```text
1. Khách hàng Demo (CUSTOMER):
   Email:    demo@example.com
   Password: DemoOnly517!

2. Quản trị viên Demo (ADMIN):
   Email:    admin@example.com
   Password: AdminOnly517!
```

Các tài khoản này có mật khẩu công khai, chỉ dùng development/testing với dữ liệu giả. Đây không phải thông tin đăng nhập thật của thành viên. Không dùng tài khoản hoặc mật khẩu demo trên môi trường public.

## API endpoints

| Method | Đường dẫn | Quyền hạn | Kết quả |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Trạng thái backend/database. |
| `GET` | `/api/products` | Public | Danh sách sản phẩm từ PostgreSQL (`?search=...&category=...`). |
| `GET` | `/api/products/:id` | Public | Chi tiết sản phẩm, trung bình đánh giá và danh sách reviews. |
| `GET` | `/api/products/:id/reviews` | Public | Danh sách đánh giá của sản phẩm. |
| `POST` | `/api/products/:id/reviews` | Đăng nhập | Gửi đánh giá 1–5 sao kèm nhận xét. |
| `POST` | `/api/products` | Admin | Thêm sản phẩm mới vào kho hàng. |
| `PUT` | `/api/products/:id` | Admin | Cập nhật thông tin/giá/kho sản phẩm. |
| `DELETE` | `/api/products/:id` | Admin | Xóa sản phẩm khỏi kho hàng. |
| `GET` | `/api/auth/csrf` | Public | CSRF token gắn với session hiện tại; đặt cookie khi cần. |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản: `{ "name", "email", "password" }`. |
| `POST` | `/api/auth/login` | Public | Đăng nhập: `{ "email", "password" }`. |
| `GET` | `/api/auth/me` | Public | Thông tin user hiện tại (`null` nếu chưa đăng nhập). |
| `POST` | `/api/auth/logout` | Đăng nhập | Hủy session server-side, xóa cookie. |
| `PUT` | `/api/auth/profile` | Đăng nhập | Cập nhật thông tin họ tên của tài khoản. |
| `PUT` | `/api/auth/password` | Đăng nhập | Đổi mật khẩu tài khoản (yêu cầu mật khẩu cũ). |
| `GET` | `/api/orders` | Đăng nhập | Lịch sử các đơn hàng của user hiện tại. |
| `POST` | `/api/orders` | Public (Khách / User) | Tạo đơn hàng (tính tiền & trừ kho phía server; chặn Admin). |
| `GET` | `/api/orders/:id` | Chủ đơn / Admin | Chi tiết đơn hàng (bảo vệ chống **IDOR**). |
| `GET` | `/api/admin/orders` | Admin | Toàn bộ đơn hàng trong hệ thống (bao gồm đơn khách vãng lai). |
| `PATCH` | `/api/admin/orders/:id/status` | Admin | Cập nhật trạng thái đơn (`PENDING`, `CONFIRMED`, `SHIPPED`...). |

Response thành công dùng `{ "data": ... }`; lỗi dùng `{ "error": { "code": "...", "message": "..." } }`. API không bao giờ trả password hash.

### Session, password và CSRF

- Session được lưu trong PostgreSQL, cookie chỉ giữ session ID đã ký; không dùng MemoryStore làm nơi lưu session.
- Cookie `pbl517.sid` có `HttpOnly`, `SameSite=Lax`, path `/api`, thời hạn tám giờ; `Secure` bật trong `NODE_ENV=production`. Frontend không lưu password hay session token trong `localStorage`.
- Đăng nhập thành công tạo lại session ID để tránh session fixation. Refresh frontend gọi `/api/auth/me` để khôi phục trạng thái; logout hủy session phía server.
- Password được hash bằng bcrypt (cost 12) trước khi ghi vào database. Lỗi đăng nhập dùng thông báo chung cho email không tồn tại và password không đúng.
- Backend kiểm tra body/email/password, giới hạn body, áp dụng HTTP security headers và rate limit login. Lỗi được xử lý tập trung, không gửi stack trace về client.
- CSRF dùng **synchronizer token** trong session, không chỉ dựa vào `SameSite`. Frontend gọi `GET /api/auth/csrf`, giữ token trong memory rồi gửi `X-CSRF-Token` cho login/logout. Sau khi session được tạo lại, lấy token mới trước request thay đổi trạng thái tiếp theo. Gọi API bằng script cần giữ cookie và gửi token cùng session đó. Request thiếu hoặc sai token nhận `403`.

Cách lưu session/cấu hình cookie theo [Express session middleware](https://expressjs.com/en/resources/middleware/session/); lựa chọn CSRF theo [OWASP CSRF Prevention — Synchronizer Token Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#synchronizer-token-pattern).

## Kiểm tra chức năng local

Sau khi chạy hai server, thực hiện:

1. Mở `/`, `/products`, `/login`; refresh trực tiếp `/products` và `/login` để kiểm tra SPA routing.
2. Trang sản phẩm phải hiển thị sáu sản phẩm seed, tên, mô tả, giá VND và tồn kho. Trong DevTools Network, kiểm tra request `/api/products` trả dữ liệu API.
3. Đăng nhập bằng tài khoản demo; header hiển thị user hiện tại. Refresh trang vẫn nhận diện user.
4. Đăng xuất; refresh vẫn ở trạng thái chưa đăng nhập. Nhập password sai phải thấy lỗi đăng nhập và không tạo phiên đăng nhập.
5. Kiểm tra DevTools Console không có lỗi nghiêm trọng. Khi tạm dừng backend rồi tải lại trang sản phẩm, phải hiển thị lỗi và cho thử lại; chạy backend lại để tiếp tục.
6. Để kiểm tra danh sách rỗng mà không xóa sản phẩm hiện có, tạo một database thử nghiệm riêng, đổi `DATABASE_URL` của backend sang database đó, chỉ migrate (chưa seed), rồi khởi động lại backend. `/products` phải hiển thị trạng thái rỗng. Sau khi test, khôi phục URL database ban đầu và restart backend. Dùng Network throttling trong DevTools để quan sát trạng thái loading.

Kiểm tra API read-only từ terminal thứ ba:

Windows PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Invoke-RestMethod http://127.0.0.1:3000/api/products
```

Linux/macOS:

```sh
curl -i http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/products
```

Để kiểm tra session bằng PowerShell, giữ cùng cookie jar trong `$webSession`:

```powershell
$csrf = Invoke-RestMethod http://127.0.0.1:3000/api/auth/csrf -SessionVariable webSession
$headers = @{ 'X-CSRF-Token' = $csrf.data.csrfToken }
$body = @{ email = 'demo@example.com'; password = 'DemoOnly517!' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:3000/api/auth/login -Method Post -WebSession $webSession -Headers $headers -ContentType 'application/json' -Body $body
Invoke-RestMethod http://127.0.0.1:3000/api/auth/me -WebSession $webSession
$csrf = Invoke-RestMethod http://127.0.0.1:3000/api/auth/csrf -WebSession $webSession
$headers = @{ 'X-CSRF-Token' = $csrf.data.csrfToken }
Invoke-RestMethod http://127.0.0.1:3000/api/auth/logout -Method Post -WebSession $webSession -Headers $headers
Invoke-RestMethod http://127.0.0.1:3000/api/auth/me -WebSession $webSession
```

Sau login, `/me` có user demo; sau logout, `/me` có `user: null`. Muốn thử password sai, lấy CSRF token lại cho cookie jar hiện tại rồi gửi login với password khác; server phải trả `401` và thông báo chung. Login thiếu token phải trả `403`. Sau quá nhiều lần thử, server có thể trả `429`; chờ hết cửa sổ rate limit trước khi thử tiếp.

### Integration test tự động

Giữ backend chạy, dùng database development đã migrate/seed. Mở terminal khác ở `website/backend`, với `.env` trỏ cùng database với backend đang chạy:

```sh
npm run test:integration
```

Suite kiểm tra health, dữ liệu sản phẩm khớp SQL, validation/body limit, CSRF, đăng nhập đúng/sai, hash password, PostgreSQL session, cookie, session fixation và logout/replay. Test gọi backend ở `http://127.0.0.1:3000` mặc định; nếu server test dùng port khác, đặt `TEST_API_URL` theo URL đó (PowerShell: `$env:TEST_API_URL='http://127.0.0.1:3002'`; Linux: `TEST_API_URL=http://127.0.0.1:3002 npm run test:integration`). Không chạy suite trên production. Chạy lặp quá nhanh có thể chạm rate limit từ các login lỗi; chờ 15 phút hoặc restart backend local trước một lượt kiểm thử mới.

## Build

Backend, trong `website/backend`:

```sh
npm ci
npm run build
npm start
```

Build generate Prisma Client rồi biên dịch TypeScript. `npm start` chạy **`node dist/server.js`**; production không dùng `tsx`, `ts-node` hay Vite. Dừng `npm run dev` trước khi chạy `npm start` nếu cùng port. Để kiểm tra bản build bằng HTTP local, giữ `NODE_ENV=development`.

Frontend, trong `website/frontend`:

```sh
npm ci
npm run build
```

Output là `frontend/dist/`, backend là `backend/dist/`. Không commit `dist/`, `node_modules/`, log hoặc `.env`.

Khi triển khai production ở issue sau: cài dependency/build trên môi trường Linux đích, chạy `npm run prisma:migrate` để áp dụng migration đã commit, phục vụ `frontend/dist/` bằng Nginx và chạy backend JavaScript bằng systemd. Nginx giữ nguyên `/api/` khi proxy, chỉ dùng SPA fallback cho frontend. Cần HTTPS cho cookie Secure và cấu hình `TRUST_PROXY` theo proxy thực tế; không dùng Vite dev server/preview để phục vụ production.

## Troubleshooting

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Không tìm thấy `node`, `npm`, `psql` | Cài đúng phần mềm, kiểm tra `PATH`, mở lại terminal sau cài đặt. Windows có thể gọi trực tiếp `psql.exe` theo đường dẫn bên trên. |
| Database connection refused | Dịch vụ/container PostgreSQL phải chạy; đối chiếu host/port trong `DATABASE_URL`. |
| Password authentication failed | Đối chiếu user/password đã tạo; percent-encode ký tự đặc biệt trong password của URL. |
| Bảng chưa tồn tại | Tại backend chạy `npm run prisma:migrate`, rồi `npm run prisma:seed`. Kiểm tra đúng database trong `.env`. |
| Prisma Client chưa generate | Chạy `npm run prisma:generate` sau `npm ci` hoặc dùng `npm run build`. |
| `migrate dev` không tạo được shadow database | Clone mới dùng `npm run prisma:migrate`. Chỉ lúc phát triển migration mới mới cần quyền `CREATEDB` cho user dev hoặc shadow database riêng. |
| Port backend/Vite bị chiếm | Dừng process cũ hoặc đổi port và target proxy cho thống nhất. Mở đúng URL được Vite thông báo. |
| Products báo lỗi / proxy ECONNREFUSED | Giữ backend chạy ở terminal thứ nhất; kiểm tra `/api/health` và cấu hình Vite proxy. |
| Login thành công nhưng refresh mất user | Dùng cùng hostname; local HTTP phải để `NODE_ENV=development`. Kiểm tra cookie trong DevTools và session secret không đổi. |
| API trả `403` khi login/logout | Lấy token mới từ `/api/auth/csrf`, giữ cookie cùng session, gửi `X-CSRF-Token`. Refresh frontend để khởi tạo lại luồng này. |

## Notes

Kiểm chứng local ngày **2026-09-15** trên Windows, Node.js **24.21.0**, npm **11.6.1**, PostgreSQL **16.15** native và Chrome: `npm ci`/build cả hai project, Prisma generate/migrate/seed và API integration **10/10 PASS**. Một bản source sạch không mang theo dependency/client generate/build output cũng được chạy với database mới: empty state trước seed, sáu sản phẩm sau seed, Home/Login/Products và session/logout đều PASS. Chrome kiểm tra responsive 390px, SPA refresh, loading/error/retry và không ghi nhận lỗi console ngoài lỗi HTTP cố ý tạo để kiểm thử.

Đã kiểm thử session qua restart backend, cookie cũ sau logout, PostgreSQL outage trả `503` rồi phục hồi, rate limit `429`, CSRF thiếu/token cũ và cookie Secure sau proxy HTTPS. `npm audit` tại thời điểm kiểm tra: 0 vulnerabilities ở cả hai project. Đây là kết quả local; Docker/Linux/EC2/Nginx/systemd chưa được chạy kiểm thử trong Issue #8. Tiến độ publish/review được duy trì tại [wiki/CURRENT_STATUS.md](../wiki/CURRENT_STATUS.md).

Issue #8 chỉ cung cấp Home, Login, Products, backend REST API, migration và seed local. Cart, checkout, payment, admin đầy đủ, EC2, Nginx/systemd, scanner/alerts và OWASP lab nằm ở các issue khác. Skeleton này áp dụng security baseline; không cố tình tạo lỗ hổng phục vụ lab.

Backend có scoped npm overrides cho `@prisma/config@7.10.0 → deepmerge-ts@8.0.2` và `prisma@7.10.0 → mysql2@3.24.4` để xử lý advisory [deepmerge-ts recursion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [mysql2 auth downgrade](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) và [mysql2 decompression DoS](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) trong dependency bắc cầu. Prisma CLI/Client/adapter vẫn cùng `7.10.0`, database ứng dụng vẫn là PostgreSQL. Khi nâng Prisma 7 sau này, kiểm tra dependency upstream, bỏ override khi đã có bản sửa phù hợp và chạy lại `npm ci`, audit, generate/build, migrate/seed và integration test.
