# OWASP-02 Evidence — A03:2021 Injection (SQL Injection)

Ngày thực nghiệm: **2026-09-30**. Issue: [#37 — Implement SQL Injection Lab Lifecycle](https://github.com/LVTIT/PBL4-517/issues/37). Nhánh: `feature/37-sqli-lab` (`Refs #37`).

Tài liệu này ghi nhận toàn bộ chu trình **vulnerable → exploit → evidence → fix → retest** cho kịch bản SQL Injection trên ô tìm kiếm sản phẩm, đồng thời giữ `main` là Secure Baseline.

---

## 1. Bề mặt tấn công

| Thành phần | Vị trí |
| --- | --- |
| Endpoint | `GET /api/products?search=...` (public, không cần đăng nhập) |
| Route | `website/backend/src/routes/api-routes.ts` |
| Controller | `website/backend/src/controllers/product-controller.ts` — `getProducts` đọc `req.query.search` |
| Service | `website/backend/src/services/product-service.ts` — `listProducts` |
| Cờ lab | `VULN_SQLI_ENABLED` khai báo tại `website/backend/src/lib/config.ts` |

Đây là điểm vào hợp lý cho A03 vì nó:
* nhận input người dùng từ query string;
* **public** — bất kỳ ai cũng gọi được, không cần session hay CSRF token;
* truy vấn bảng chứa dữ liệu nghiệp vụ (`Product`) nên khai thác thành công sẽ lộ dữ liệu thật.

---

## 2. Cơ chế Lab: hai trạng thái qua cờ môi trường

```text
                    Cờ VULN_SQLI_ENABLED
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
VULN_SQLI_ENABLED=true                    VULN_SQLI_ENABLED=false
(Mô phỏng lab OWASP A03)                   (Secure Baseline — mặc định)
────────────────────────────────           ────────────────────────────────
prisma.$queryRawUnsafe                     prisma.product.findMany
search nối thẳng vào chuỗi SQL             { contains: search, mode: 'insensitive' }
Bỏ qua ranh giới dữ liệu                  Prisma sinh parameterized query
        │                                           │
        ▼                                           ▼
HTTP 200 + toàn bộ bảng                     HTTP 200 + 0 hàng
```

Nguồn lab path: `listProductsWithRawSql()` trong `website/backend/src/services/product-service.ts`. Hàm này chỉ được gọi khi `VULN_SQLI_ENABLED=true`.

### Phòng thủ tầng cấu hình

`website/backend/src/lib/config.ts` dùng `superRefine` để **từ chối khởi động** nếu `NODE_ENV=production` mà bất kỳ cờ `VULN_*_ENABLED` nào bằng `true`. Điều này biến "tình cờ bật lab trên production" từ sự cố thành lỗi khởi động rõ ràng, và nó áp dụng cho cả `VULN_IDOR_ENABLED` lẫn `VULN_SQLI_ENABLED`.

Mặc định của cả hai cờ là `false`, và `.env.example` ghi rõ điều đó.

---

## 3. Danh mục Payload

Script [`scripts/attacker/exploit_sqli.py`](../../scripts/attacker/exploit_sqli.py) dùng **thư viện chuẩn Python** (`urllib`), không cần `pip install`.

| # | Scenario | Payload | Mục đích |
| :--- | :--- | :--- | :--- |
| 1 | `tautology` | `' OR '1'='1` | Vô hiệu hóa điều kiện tìm kiếm, lộ toàn bộ bảng `Product` |
| 2 | `union` | `') UNION SELECT id, name, email, NULL::text, 0, 'CUSTOMER', "createdAt", "updatedAt" FROM "User" --` | Đọc bảng khác (`User`) qua cùng endpoint sản phẩm |

Về payload `union`: cột được chọn phải khớp **kiểu dữ liệu** với `SELECT` gốc, vì PostgreSQL yêu cầu các cột `UNION` cùng kiểu. `Product` không có `category` và `price` kiểu `numeric` không tương thích với `User`, nên payload dùng `NULL::text` cho `price` và literal `'CUSTOMER'` cho `category`.

**Không dùng `DROP TABLE` / `DELETE` trong payload.** Mục tiêu lab là chứng minh khả năng **đọc** dữ liệu ngoài ý muốn, không phá hủy database. Bảng `Product` được kiểm tra còn nguyên sau mỗi lần chạy.

Script tự đối chiếu với một từ khóa baseline không khớp sản phẩm nào, nên kết luận dựa trên chênh lệch số hàng chứ không dựa trên ngưỡng hard-code.

---

## 4. Hồ sơ bằng chứng thực nghiệm

| File | Thao tác | Cờ | Kết quả |
| :--- | :--- | :--- | :--- |
| [01-exploit-search-vulnerable.txt](01-exploit-search-vulnerable.txt) | Chạy `exploit_sqli.py` ở lab | `VULN_SQLI_ENABLED=true` | `tautology` → **6 sản phẩm** (toàn bộ bảng). `union` → **17 hàng**, gồm dữ liệu bảng `User`. HTTP 200 |
| [02-defense-search-secure.txt](02-defense-search-secure.txt) | Chạy lại đúng script đó ở baseline | `VULN_SQLI_ENABLED=false` | Cả hai scenario → **0 hàng**, HTTP 200. Script kết luận `SECURE` |
| [03-automated-tests.txt](03-automated-tests.txt) | `npm run test:integration` | cả hai | Secure Baseline: **17/17 PASS**. Lab: sub-test mới **FAIL** với `SQL injection must not return rows on the secure baseline` |

### Vì sao 03 chạy hai lần

Một assertion luôn PASS thì không chứng minh được gì. Vì vậy cùng một revision code và cùng một database đã migrate/seed được chạy hai lần, chỉ khác cờ môi trường:

* **Run 1 (baseline)** — `VULN_SQLI_ENABLED=false`, `TEST_API_URL=http://127.0.0.1:3002` → 17/17 PASS. Đây là kết quuả chuẩn xác minh cho repository.
* **Run 2 (lab)** — `VULN_SQLI_ENABLED=true`, `TEST_API_URL=http://127.0.0.1:3001` → sub-test `product search rejects SQL injection payloads` FAIL. Đây là **negative control**: chứng minh assertion thật sự bắt được lỗi.

Hai backend chạy song song ở port khác nhau (`3001` lab, `3002`/`3000` baseline) nên không phải khởi động lại server giữa các lần test, và baseline vẫn luôn sẵn sàng.

### Về việc che dữ liệu

Script che mọi địa chỉ email trong output bằng `<email-REDACTED>`. Bằng chứng trong `evidence/OWASP-02/` vì vậy không chứa PII thô, không chứa session cookie, CSRF token, `DATABASE_URL` hay credential nào. Toàn bộ dữ liệu lab là dữ liệu seed giả.

---

## 5. Runbook trình diễn 2 phút

### Bước 1 — Chuẩn bị (một lần)

```bash
cd website/backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# điền DATABASE_URL, SESSION_SECRET, giữ NODE_ENV=development
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### Bước 2 — Chứng minh Secure Baseline (trước)

```bash
# .env giữ VULN_SQLI_ENABLED=false
npm run dev                                    # terminal 1
python scripts/attacker/exploit_sqli.py        # terminal 2
```

Kết quả mong đợi: hai scenario đều `0` hàng, kết luận `[-] KẾT LUẬN: Secure Baseline giữ vững`.

Mở `http://127.0.0.1:5173/products`, gõ `' OR '1'='1` vào ô tìm kiếm: danh sách **rỗng** — payload được coi là chuỗi tìm kiếm bình thường.

### Bước 3 — Chuyển sang vulnerable mode

```bash
# .env: VULN_SQLI_ENABLED=true
# restart backend
npm run dev
python scripts/attacker/exploit_sqli.py
```

Kết quả mong đợi: `tautology` trả 6 sản phẩm, `union` trả 17 hàng có dữ liệu `User`, kết luận `[+] SQL injection THÀNH CÔNG`.

Gõ lại payload trên web: danh sách **hiện toàn bộ sản phẩm** dù từ khóa không tồn tại.

### Bước 4 — Retest sau khi vá

```bash
# .env: VULN_SQLI_ENABLED=false
# restart backend
python scripts/attacker/exploit_sqli.py
npm run test:integration
```

Kết quả mong đợi: exploit thất bại, test **17/17 PASS**.

---

## 6. Regression test

Sub-test mới nằm trong [`website/backend/tests/api.integration.test.mjs`](../../website/backend/tests/api.integration.test.mjs), tên `product search rejects SQL injection payloads`. Nó kiểm ba điều trên Secure Baseline:

1. Tautology trả về mảng rỗng.
2. `UNION` trả về mảng rỗng và **không có** cột `email` của `User` trong bất kỳ hàng nào.
3. Payload stacked-statement không làm mất bảng `"Product"` — test query trực tiếp `SELECT count(*) FROM "Product"` qua pool `pg` và assert còn ít nhất 6 hàng.

Điểm 3 quan trọng vì nó phát hiện cả trường hợp bảng thật sự bị phá hủy, không chỉ việc API trả sai dữ liệu.

---

## 7. Phạm vi và giới hạn

* Toàn bộ thực nghiệm chạy ở **local lab** với dữ liệu seed giả. Không payload nào nhắm vào hệ thống của bên thứ ba.
* Backend lab chạy ở `127.0.0.1`; không public. Trên EC2, `.env` production giữ `VULN_IDOR_ENABLED=false` và nay cả `VULN_SQLI_ENABLED=false`.
* Payload lab chỉ **đọc**. Không chứng minh khả năng ghi/xoá dữ liệu, và không nên suy ra điều đó.
* Bằng chứng này phủ **một** input của **một** endpoint. Không kết luận website không còn SQL injection ở nơi khác.
* Nhánh `main` không chứa lab path có thể kích hoạt từ môi trường; code vulnerable chỉ tồn tại khi `VULN_SQLI_ENABLED=true`, mà `config.ts` từ chối dưới `NODE_ENV=production`.

---

## 8. Liên hệ

* Issue: [#37 — Implement SQL Injection Lab Lifecycle](https://github.com/LVTIT/PBL4-517/issues/37)
* Pattern lab: [`evidence/OWASP-01/README.md`](../OWASP-01/README.md) (A01 IDOR)
* Script: [`scripts/attacker/exploit_sqli.py`](../../scripts/attacker/exploit_sqli.py), hướng dẫn tại [`scripts/attacker/README.md`](../../scripts/attacker/README.md)
* Chiến lược lab: [`wiki/SECURITY_PLAN.md`](../../wiki/SECURITY_PLAN.md)
