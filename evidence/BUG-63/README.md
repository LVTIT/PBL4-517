# Bug #63 — Lỗi Prisma bị bọc thành 503

Refs #63. Related to #44.

**Trạng thái: đã sửa trong source; chưa merge, chưa triển khai.**

Đo trên `main` tại `43bebb1`, sửa trên `feature/63-prisma-error-mapping`.

## Tóm tắt

Mọi service kết thúc bằng `catch { throw databaseUnavailable(); }`, nên **tất cả** lỗi
Prisma đều trả `503 DATABASE_UNAVAILABLE` — kể cả lỗi hoàn toàn do dữ liệu đầu vào.

| Request | Trước | Sau |
| --- | --- | --- |
| `GET /api/products/not-a-uuid` | `503 DATABASE_UNAVAILABLE` | `400 INVALID_ID` |
| `PUT /api/products/<uuid không tồn tại>` | `503 DATABASE_UNAVAILABLE` | `404 NOT_FOUND` |
| `DELETE /api/products/<uuid không tồn tại>` | `503 DATABASE_UNAVAILABLE` | `404 NOT_FOUND` |
| `DELETE /api/products/<uuid đang được đơn hàng tham chiếu>` | `503 DATABASE_UNAVAILABLE` | `409 CONFLICT` |
| `GET /api/orders/not-a-uuid` | `503 DATABASE_UNAVAILABLE` | `400 INVALID_ID` |

## Vì sao đây là lỗi thật, không phải chuyện câu chữ

Khi trả `503`, hệ thống đang nói với client hai điều sai:

1. **"Dịch vụ tạm thời không khả dụng"** → client và monitoring sẽ coi là sự cố hạ tầng,
   bật cảnh báo, kiểm tra database và backend. Trong khi nguyên nhân chỉ là một UUID gõ sai.
2. **"Vui lòng thử lại"** → client tự động retry một request **không bao giờ** thành công.
   Đây là retry storm tự gây ra.

Ngoài ra, `503` làm mất khả năng phân biệt sự cố thật với lỗi dữ liệu trong dashboard và
trong scanner, đúng loại nhiễu mà #42 (đối chiếu log) cần tránh.

## Mã Prisma đo được trên chính schema hiện tại

```text
findUnique invalid uuid  -> PrismaClientKnownRequestError | code: P2007
update missing record    -> PrismaClientKnownRequestError | code: P2025
delete missing record    -> PrismaClientKnownRequestError | code: P2025
delete referenced (FK)   -> code: P2003   (PostgreSQL 23503, OrderItem_productId_fkey)
duplicate email          -> code: P2002   (User_email_key)
```

## Môi trường

Windows, Node 24.19.0, PostgreSQL 16 container dùng-một-lần
(`pbl517-err-20261101`, loopback `127.0.0.1:55443`, database `pbl517_lab_test`),
compiled backend, Secure Baseline (mọi `VULN_*` = `false`), seed development.
Container và mọi tiến trình đã xoá/dừng sau khi đo.

## Cách sửa

Thêm `website/backend/src/lib/data-errors.ts` với `translatePrismaError()`:

| Mã Prisma | Trả về | Nghĩa |
| --- | --- | --- |
| `P2007`, `P2023` | `400 INVALID_ID` | Giá trị sai định dạng (UUID) |
| `P2001`, `P2015`, `P2018`, `P2025` | `404 NOT_FOUND` | Bản ghi câu lệnh cần không tồn tại |
| `P2003` | `409 CONFLICT` | Bị bản ghi khác tham chiếu |
| `P2002` | `409 CONFLICT` | Vi phạm ràng buộc duy nhất |
| `P2000`, `P2004` | `400 INVALID_INPUT` | Bị `CHECK` hoặc giới hạn độ dài từ chối |
| còn lại / không phải Prisma | `503 DATABASE_UNAVAILABLE` | Lỗi hạ tầng thật |

Nguyên tắc: **lỗi do dữ liệu đầu vào phải trả 4xx; chỉ lỗi hạ tầng thật mới trả 503.**
Mã lạ **không** được đoán thành 4xx — mặc định vẫn `503` để không che giấu sự cố thật.

Đồng thời:

- `product-controller.ts` kiểm tra hình dạng UUID trước khi chạm database, nên id sai không
  bao giờ tới Prisma. Đây là biện pháp bổ sung, không thay thế ánh xạ ở trên.
- `registerUser` ánh xạ `P2002` thành `409 EMAIL_EXISTS` vì bước kiểm tra trùng và bước tạo
  có thể bị đua bởi một đăng ký đồng thời.

Thông báo lỗi trả về client **không** chứa tên constraint, tên bảng hay thông điệp của driver.

## Kiểm chứng

| Kiểm tra | Trước khi sửa | Sau khi sửa |
| --- | --- | --- |
| `data errors keep their 4xx status instead of 503` (HTTP) | **FAIL** (17/19) | **PASS** (19/19) |
| `test:data-errors` (unit, ánh xạ mã) | — | 3/3 PASS |
| `npm run test:integration` | — | 19/19 PASS |
| `LOCAL_SECURITY_LAB=1 npm run test:security` | — | 9/9 PASS |
| `npm run build` | — | PASS |

Test hồi quy HTTP đã được xác minh là **thực sự bắt được lỗi** bằng cách stash bản vá,
build lại code cũ và chạy lại: subtest đỏ. Sau khi khôi phục bản vá: xanh.

Log: `api-integration.txt`, `data-errors-unit.txt`, `security-lifecycle.txt`.

## Không thay đổi

- Không đổi schema, không migration.
- Không đổi mã lỗi đã đúng: `405`, `415`, `403 CSRF_INVALID`, `401`, `400 INVALID_INPUT` từ zod.
- Không đổi hành vi lab OWASP. `product-service` vẫn giữ nhánh raw SQL chỉ khi
  `VULN_SQLI_ENABLED=true`.
- Không đổi `error-handler.ts`: vẫn không log body, cookie, URL database hay stack.
- Không đổi `.env`, không tạo resource AWS, không deploy.

## Ghi chú

`POST /api/products/<id>/reviews` với sản phẩm không tồn tại **đã** trả `404` đúng từ trước
vì `addReview` tự kiểm tra. Điều này xác nhận nguyên nhân nằm ở cách bọc lỗi, không phải ở
Prisma. Hành vi đó được giữ nguyên.
