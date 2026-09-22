# OWASP-01 Evidence — A01:2021 Broken Access Control (IDOR)

Ngày thực nghiệm: **2026-09-22**. Nhánh: `feat/owasp-01-idor` / `main`.

Tài liệu này ghi nhận hồ sơ kiểm thử, phân tích lỗ hổng, cơ chế phòng thủ chuyên sâu tầng Database, giao diện minh họa trực quan và bộ bằng chứng thực nghiệm đầy đủ cho kịch bản **OWASP Top 10 - A01: Broken Access Control (IDOR)** trong đề tài PBL4-517.

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

## 2. Kiến trúc Phòng thủ Chuyên sâu (Database-level Query Scoping)

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
   - Ứng dụng query `findUnique({ where: { id: orderId } })` kéo toàn bộ dữ liệu của nạn nhân lên RAM Node.js rồi mới kiểm tra `if (order.userId !== requestingUserId)`.
   - *Nguy cơ:* Dữ liệu PII của nạn nhân đã rời khỏi Database, có nguy cơ rò rỉ qua log tập trung, crash dump, profiler hoặc tiến trình rà quét bộ nhớ.

2. **Chuẩn phòng thủ chuyên sâu của PBL4-517 (Database Query Scoping):**
   - Áp dụng thống nhất cho cả **Đọc**, **Cập nhật** và **Hủy** đơn hàng trong [`website/backend/src/services/order-service.ts`](../../website/backend/src/services/order-service.ts):
     ```typescript
     // Ép điều kiện sở hữu ngay tại câu lệnh SQL/Prisma
     const scopedOrder = await prisma.order.findFirst({
       where: { id: orderId, userId: requestingUserId },
       select: { ... }
     });
     ```
   - Database engine tự động chặn từ gốc; dữ liệu của nạn nhân **hoàn toàn không được nạp vào RAM** của tiến trình Node.js nếu không đúng chủ sở hữu.

### Đánh giá mã phản hồi (HTTP 403 vs HTTP 404):
* Khi truy cập đơn hàng của người khác, hệ thống kiểm tra sự tồn tại của ID để trả về **`403 FORBIDDEN`**. Mã lỗi này thể hiện rõ ràng cơ chế phân quyền (Access Control) đã từ chối yêu cầu, phục vụ trực quan cho việc chấm bài và chạy kiểm thử tự động.
* *Ghi chú kiến trúc:* Trong môi trường Zero-Trust thương mại, hệ thống có thể cấu hình trả về **`404 NOT_FOUND`** (Denial of Existence) để ngăn chặn kẻ tấn công dò quét sự tồn tại của mã đơn hàng (ID Enumeration Oracle).

---

## 3. Giao diện Web Trực quan (Frontend Demonstration)

Bên cạnh các công cụ dòng lệnh, giao diện người dùng React SPA được trang bị cơ chế phản hồi trực quan giúp người xem dễ dàng quan sát:

1. **Trang Quản lý Đơn hàng ([`OrdersPage.tsx`](../../website/frontend/src/pages/OrdersPage.tsx)):**
   - Hiển thị danh sách đơn hàng đã mua kèm mã đơn hàng UUID.
   - Thao tác trực tiếp: Nút **"Xem chi tiết"** và nút **"Hủy đơn"** (gọi `POST /api/orders/:id/cancel` kèm hoàn lại tồn kho sản phẩm).
2. **Trang Chi tiết Đơn hàng ([`OrderDetailPage.tsx`](../../website/frontend/src/pages/OrderDetailPage.tsx)):**
   - Truy cập qua route `/orders/:id`.
   - **Khi bị chặn (Secure Baseline - HTTP 403):** Hiển thị màn hình cảnh báo đỏ nổi bật:
     > 🔴 **403 FORBIDDEN — TRUY CẬP BỊ TỪ CHỐI**: Cơ chế Access Control (OWASP Top 10 A01) đã chặn yêu cầu. Hệ thống thực thi chính sách *Database-level Query Scoping*.
   - **Khi ở chế độ Lỗ hổng (Vulnerable Lab - HTTP 200):** Hiển thị banner cảnh báo rò rỉ dữ liệu chéo người dùng (*Cross-User Order Leak*) kèm toàn bộ PII của nạn nhân.
   - Hỗ trợ form cập nhật nhanh địa chỉ nhận hàng và số điện thoại (`PATCH /api/orders/:id`).

---

## 4. Danh mục Hồ sơ Bằng chứng Thực nghiệm (Evidence Logs)

Toàn bộ quá trình kiểm thử thực tế được ghi nhận thành các file log chuẩn mực trong thư mục này:

| File Bằng chứng | Thao tác kiểm thử | Trạng thái cờ | Kết quả ghi nhận |
| :--- | :--- | :--- | :--- |
| [01-exploit-read-vulnerable.txt](01-exploit-read-vulnerable.txt) | Đọc trộm đơn hàng (`GET`) | `VULN_IDOR_ENABLED=true` | **HTTP 200 OK** — Lộ toàn bộ PII nạn nhân |
| [02-exploit-update-vulnerable.txt](02-exploit-update-vulnerable.txt) | Đổi địa chỉ nhận hàng (`PATCH`) | `VULN_IDOR_ENABLED=true` | **HTTP 200 OK** — Địa chỉ bị sửa thành kho hacker |
| [03-exploit-cancel-vulnerable.txt](03-exploit-cancel-vulnerable.txt) | Hủy đơn hàng nạn nhân (`POST`) | `VULN_IDOR_ENABLED=true` | **HTTP 200 OK** — Đơn bị chuyển sang `CANCELLED` |
| [04-defense-read-blocked-403.txt](04-defense-read-blocked-403.txt) | Đọc trộm đơn hàng (`GET`) | `VULN_IDOR_ENABLED=false` | **HTTP 403 Forbidden** — Database Scoping chặn từ gốc |
| [05-defense-update-blocked-403.txt](05-defense-update-blocked-403.txt) | Đổi địa chỉ nhận hàng (`PATCH`) | `VULN_IDOR_ENABLED=false` | **HTTP 403 Forbidden** — Chặn sửa đổi trái phép |
| [06-defense-cancel-blocked-403.txt](06-defense-cancel-blocked-403.txt) | Hủy đơn hàng nạn nhân (`POST`) | `VULN_IDOR_ENABLED=false` | **HTTP 403 Forbidden** — Chặn hủy đơn phá hoại |
| [07-automated-tests-pass.txt](07-automated-tests-pass.txt) | Bộ kiểm thử tự động | Mặc định (Secure) | **16/16 Tests PASS** — Đạt 100% tiêu chuẩn kiểm thử |

---

## 5. Hướng dẫn Trình diễn Thực tế (2-Minute Live Demo Runbook)

Kịch bản demo được thiết kế để nhóm trình bày trước giảng viên/hội đồng một cách trực quan, mạch lạc:

### Bước 1: Khởi tạo đơn hàng thật trên Web UI (Vai trò Nạn nhân)
1. Đăng nhập vào website với tài khoản: `demo@example.com` / `DemoOnly517!`.
2. Chọn mua một sản phẩm bất kỳ (ví dụ: Bàn phím cơ) và tiến hành đặt hàng.
3. Vào trang **Lịch sử đơn hàng** (`/orders`), copy mã đơn hàng UUID vừa tạo (ví dụ: `<TARGET_ORDER_ID>`).

### Bước 2: Trình diễn qua Web UI (Minh họa trực quan)
1. Mở cửa sổ trình duyệt ẩn danh (Incognito), đăng nhập tài khoản khác.
2. Dán đường dẫn `http://localhost:5173/orders/<TARGET_ORDER_ID>` vào thanh địa chỉ:
   - **Ở Secure Baseline:** Trình duyệt hiển thị ngay lập tức màn hình cảnh báo **403 FORBIDDEN — TRUY CẬP BỊ TỪ CHỐI**.
   - **Khi bật Lab (`VULN_IDOR_ENABLED=true`):** Trình duyệt hiển thị thông tin đơn hàng và PII của `demo@example.com` kèm banner cảnh báo rò rỉ IDOR.

### Bước 3: Trình diễn qua Terminal Script (Khai thác tự động diện rộng)
Mở terminal và thực thi các script tấn công tự động với mã đơn hàng thật vừa tạo:
```bash
# 1. Đọc trộm thông tin
python scripts/attacker/exploit_idor.py --id <TARGET_ORDER_ID>

# 2. Can thiệp đổi địa chỉ giao hàng
python scripts/attacker/exploit_idor_update.py --id <TARGET_ORDER_ID> --address "Kho hàng bí mật của Hacker"

# 3. Phá hoại hủy đơn hàng
python scripts/attacker/exploit_idor_cancel.py --id <TARGET_ORDER_ID>
```
- Khi `VULN_IDOR_ENABLED=false`: Cả 3 script in ra `[-] SECURE: Access control enforced (403 Forbidden)`.
- Khi `VULN_IDOR_ENABLED=true`: Cả 3 script in ra `[+] VULNERABLE` và trả về dữ liệu thành công.

---

## 6. Kiểm thử Tích hợp Tự động (Integration Test)

Toàn bộ các ràng buộc an ninh trên được tự động hóa kiểm tra trong file test tích hợp:
[`website/backend/tests/api.integration.test.mjs`](../../website/backend/tests/api.integration.test.mjs)

Chạy lệnh kiểm thử:
```bash
npm run test:integration
```
Kết quả: **16/16 tests pass**, bao phủ đầy đủ các kiểm tra phân quyền cho cả 2 vai trò: Kẻ tấn công (bị chặn 403) và Chủ đơn hàng hợp lệ (thực hiện thành công 200).
