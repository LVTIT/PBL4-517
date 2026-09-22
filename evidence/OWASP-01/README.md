# OWASP-01 Evidence — A01:2021 Broken Access Control (IDOR)

Ngày thực nghiệm: **2026-09-22**. Nhánh: `main`.

Tài liệu này ghi nhận hồ sơ kiểm thử, phân tích lỗ hổng và cơ chế phòng thủ chuyên sâu cho kịch bản **OWASP Top 10 - A01: Broken Access Control** trong đề tài PBL4-517.

---

## 1. Tổng quan Lỗ hổng & Kịch bản Nghiệp vụ

Lỗ hổng **Insecure Direct Object Reference (IDOR)** xảy ra khi hệ thống cho phép người dùng truy cập hoặc thao tác trực tiếp trên tài nguyên (Object Reference) bằng định danh (như `orderId`) mà không thực hiện kiểm tra quyền sở hữu tương ứng của người dùng yêu cầu.

Trong hệ thống thương mại điện tử PBL4-517, kịch bản IDOR được xây dựng toàn diện trên vòng đời đơn hàng (Full-Lifecycle Order Management):

| Kịch bản | Thao tác | Endpoint HTTP | Hành vi kẻ tấn công (Attacker) | Hậu quả an ninh |
| :--- | :--- | :--- | :--- | :--- |
| **1. Read IDOR** | Đọc trộm đơn hàng | `GET /api/orders/:id` | Dùng token/session của Attacker gửi request đọc ID đơn hàng của Nạn nhân | Rò rỉ thông tin cá nhân (PII), địa chỉ, số điện thoại, danh mục hàng hóa đã mua. |
| **2. Write IDOR (Update)** | Sửa địa chỉ nhận hàng | `PATCH /api/orders/:id` | Sửa `shippingAddress`, `customerPhone` của đơn hàng nạn nhân về địa chỉ của Hacker | Chiếm đoạt kiện hàng giá trị cao (Package Theft) khi hàng được giao tới. |
| **3. Write IDOR (Cancel)** | Phá hoại hủy đơn hàng | `POST /api/orders/:id/cancel` | Gửi yêu cầu hủy đơn hàng đang `PENDING` của nạn nhân | Phá hoại giao dịch (Business Logic Sabotage / DoS), làm gián đoạn kinh doanh. |

---

## 2. Kiến trúc Phòng thủ Chuyên sâu (Defense-in-Depth)

Hệ thống triển khai 2 trạng thái hoạt động thông qua cờ môi trường `VULN_IDOR_ENABLED` trong file `.env`:

```
                             Cờ VULN_IDOR_ENABLED
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
   VULN_IDOR_ENABLED=true                          VULN_IDOR_ENABLED=false
   (Mô phỏng Lab OWASP)                           (Secure Baseline - Mặc định)
   - DB Query: chỉ lọc theo id                     - DB Query: ép điều kiện id + userId
   - Bỏ qua quyền sở hữu                          - Chuẩn phòng thủ chuyên sâu
   - Kết quả: HTTP 200 OK                          - Kết quả: HTTP 403 Forbidden
```

### So sánh Kỹ thuật Phòng thủ Tầng Ứng dụng vs Tầng Cơ sở dữ liệu:

1. **Cách tiếp cận thông thường (In-memory Filtering):**
   - Ứng dụng query `findUnique({ where: { id: orderId } })` kéo toàn bộ dữ liệu của nạn nhân lên RAM Node.js rồi mới `if (order.userId !== requestingUserId)`.
   - *Nguy cơ:* Dữ liệu PII của nạn nhân đã rời khỏi Database, có nguy cơ rò rỉ qua logs, crash dump hoặc memory profiling.

2. **Chuẩn phòng thủ chuyên sâu của PBL4-517 (Database Query Scoping):**
   - Áp dụng trực tiếp trong `website/backend/src/services/order-service.ts`:
     ```typescript
     // Ép điều kiện sở hữu ngay tại câu lệnh SQL/Prisma
     const scopedOrder = await prisma.order.findFirst({
       where: { id: orderId, userId: requestingUserId },
       include: { ... }
     });
     ```
   - Database engine tự động chặn từ gốc; dữ liệu của nạn nhân **hoàn toàn không được nạp vào RAM** của tiến trình Node.js nếu không đúng chủ sở hữu.

### Đánh giá mã phản hồi (HTTP 403 vs HTTP 404):
* Khi truy cập đơn hàng của người khác, hệ thống kiểm tra sự tồn tại của ID để trả về **`403 FORBIDDEN`**. Mã lỗi này thể hiện rõ ràng cơ chế phân quyền (Access Control) đã từ chối yêu cầu, phục vụ trực quan cho việc chấm bài và chạy kiểm thử tự động.
* *Ghi chú kiến trúc:* Trong môi trường Zero-Trust thương mại, hệ thống có thể cấu hình trả về **`404 NOT_FOUND`** (Denial of Existence) để ngăn chặn kẻ tấn công dò quét sự tồn tại của mã đơn hàng (ID Enumeration Oracle).

---

## 3. Bộ công cụ Thực nghiệm & Kiểm chứng

### Các script khai thác (Attacker Tools):
Vị trí: `scripts/attacker/`
- [exploit_idor.py](../../scripts/attacker/exploit_idor.py): Kiểm thử đọc trộm đơn hàng (`GET`).
- [exploit_idor_update.py](../../scripts/attacker/exploit_idor_update.py): Kiểm thử đổi địa chỉ giao hàng (`PATCH`).
- [exploit_idor_cancel.py](../../scripts/attacker/exploit_idor_cancel.py): Kiểm thử hủy đơn hàng (`POST`).

### Hướng dẫn chạy kiểm thử 2 chiều:

1. **Chiều 1 — Khai thác thành công (Vulnerable Mode):**
   - Cấu hình trong `website/backend/.env`:
     ```dotenv
     VULN_IDOR_ENABLED=true
     ```
   - Chạy các script khai thác:
     ```bash
     python scripts/attacker/exploit_idor.py --id <TARGET_ORDER_ID>
     python scripts/attacker/exploit_idor_update.py --id <TARGET_ORDER_ID>
     python scripts/attacker/exploit_idor_cancel.py --id <TARGET_ORDER_ID>
     ```
   - *Kết quả:* Toàn bộ các request trả về **HTTP 200 OK**, dữ liệu bị lộ, địa chỉ bị sửa đổi và đơn hàng bị hủy thành công.

2. **Chiều 2 — Phòng thủ thành công (Secure Baseline):**
   - Cấu hình trong `website/backend/.env`:
     ```dotenv
     VULN_IDOR_ENABLED=false
     ```
   - Chạy lại các script khai thác với cùng target ID:
   - *Kết quả:* Toàn bộ các request tấn công bị từ chối với **HTTP 403 FORBIDDEN**.
   - Chủ sở hữu đơn hàng hợp lệ vẫn thực hiện chỉnh sửa và hủy đơn bình thường (**HTTP 200 OK**).

---

## 4. Kiểm thử Tích hợp Tự động (Integration Test)

Toàn bộ các ràng buộc an ninh trên được tự động hóa kiểm tra trong file test tích hợp:
[website/backend/tests/api.integration.test.mjs](../../website/backend/tests/api.integration.test.mjs)

Các bài test bao phủ:
1. `User A tạo đơn hàng`: Xác nhận tạo thành công và tính giá chính xác phía server.
2. `User B gọi GET /api/orders/:id của User A`: Bị chặn với mã **403 FORBIDDEN**.
3. `User B gọi PATCH /api/orders/:id của User A`: Bị chặn với mã **403 FORBIDDEN**.
4. `User B gọi POST /api/orders/:id/cancel của User A`: Bị chặn với mã **403 FORBIDDEN**.
5. `User A gọi PATCH /api/orders/:id của chính mình`: Thành công **200 OK**, địa chỉ được cập nhật.
6. `User A gọi POST /api/orders/:id/cancel của chính mình`: Thành công **200 OK**, đơn chuyển sang trạng thái `CANCELLED` và hoàn lại tồn kho sản phẩm.
