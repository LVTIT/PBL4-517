# Current Project Status

**Last updated:** 2026-09-21

**Current phase:** Hoàn thành mở rộng tính năng website e-commerce (Register, Search & Filter, Product Detail, Reviews, Cart & Orders, Admin panel) đảm bảo Secure Baseline trên `main` và tạo đầy đủ bề mặt kiểm thử cho lab OWASP Top 10.

**Completed:**

- [Issue #7 — Web technology stack selected](https://github.com/LVTIT/PBL4-517/issues/7): đã chốt và CLOSED; hồ sơ ở commit `e1cc09c`.
- [Issue #8 — Website skeleton](https://github.com/LVTIT/PBL4-517/issues/8): Skeleton website ban đầu đã hoàn thành và merge vào `main` (commit `01a3da3`).
- **Nâng cấp tính năng e-commerce phục vụ bề mặt kiểm thử OWASP (2026-09-18):**
  - **Auth mở rộng:** Đăng ký tài khoản mới (`POST /api/auth/register` với rate limiter, check trùng email, hash mật khẩu), xem và cập nhật họ tên (`PUT /api/auth/profile`), đổi mật khẩu có kiểm tra mật khẩu cũ (`PUT /api/auth/password`).
  - **Tìm kiếm & Chi tiết sản phẩm:** Tìm kiếm theo từ khóa `search` và lọc theo `category` (`GET /api/products?search=...&category=...`), xem chi tiết sản phẩm (`GET /api/products/:id`).
  - **Đánh giá sản phẩm (Reviews):** Viết đánh giá 1–5 sao và bình luận (`POST /api/products/:id/reviews`), xem danh sách đánh giá từ khách hàng.
  - **Giỏ hàng & Đơn hàng:** Lưu trữ giỏ hàng client (`CartContext`), tạo đơn hàng với xác thực tồn kho và tính tổng tiền phía server chống gian lận giá (`POST /api/orders`), xem lịch sử đơn hàng (`GET /api/orders`), xem chi tiết đơn hàng (`GET /api/orders/:id`) có cơ chế kiểm tra quyền sở hữu chống **IDOR**.
  - **Bảng điều khiển Quản trị (Admin Panel):** Quản lý kho hàng (thêm mới, xóa sản phẩm) và quản lý danh sách đơn hàng (cập nhật trạng thái `PENDING` → `CONFIRMED` → `SHIPPED` → `DELIVERED` → `CANCELLED`). Phân quyền chặt chẽ qua middleware `requireAdmin`.
  - **Tối ưu phân quyền (RBAC) & Đặt hàng Khách vãng lai (Guest Checkout) (2026-09-18):**
    - **Tách bạch vai trò Admin & Khách hàng:** Quản trị viên (`ADMIN`) chỉ thực hiện các tác vụ quản trị, không thể tham gia mua hàng/đặt đơn (`403 ADMIN_CANNOT_ORDER`) và không được tự viết review sản phẩm (`403 ADMIN_CANNOT_REVIEW`). Ẩn giỏ hàng trên thanh điều hướng đối với tài khoản Admin.
    - **Đặt hàng cho Khách vãng lai (Guest):** Cho phép đặt hàng mà không bắt buộc tạo tài khoản (`POST /api/orders` hỗ trợ `guestInfo: { name, email, phone }`), vẫn được bảo vệ CSRF và session đầy đủ.
    - **Cô lập giỏ hàng & Fix rò rỉ session (Cart Session Isolation):** Giỏ hàng được lưu theo namespace (`pbl517_cart_user_<id>` hoặc `pbl517_cart_guest`). Khi đăng xuất, giỏ hàng trong bộ nhớ và localStorage được xóa sạch hoàn toàn để bảo mật phiên dùng chung máy; khi đăng nhập, giỏ hàng khách được tự động hợp nhất vào tài khoản người dùng.
    - **Sửa giao diện giỏ hàng:** Điều chỉnh CSS `.cart-item-details` dạng flex-column, ngăn chặn việc tên sản phẩm và đơn giá bị dính liền chữ trên cùng một dòng.
  - **Chuẩn hóa kịch bản khai thác OWASP A01 (IDOR) & Attacker Script (2026-09-18):**
    - Viết script tấn công tự động [`scripts/attacker/exploit_idor.py`](../scripts/attacker/exploit_idor.py) kiểm thử khai thác IDOR và đánh giá mã phản hồi HTTP 200 vs 403.
    - Tích hợp cờ môi trường `VULN_IDOR_ENABLED` (mặc định `false` trên baseline) giúp demo chuyển đổi trạng thái "Chưa bịt lỗi" $\leftrightarrow$ "Đã bịt lỗi" tức thì mà không cần can thiệp sửa code thủ công.
  - **Database & Prisma:** Migration `20260918000000_expand_ecommerce` và `20260918140000_guest_checkout` (hỗ trợ `userId String?`, lưu `customerName`, `customerEmail`, `customerPhone` cho đơn hàng khách vãng lai). Cập nhật `seed.ts` với tài khoản Admin demo (`admin@example.com` / `AdminOnly517!`).
  - **Kiểm thử & Build:** Đã bổ sung bộ kiểm thử tự động, 16/16 backend integration tests chạy thành công (`npm run test:integration`); cả frontend (`npm run build`) và backend (`npm run build`) biên dịch 100% không lỗi.

**In progress:**

- [Issue #6 — Launch EC2 Linux](https://github.com/LVTIT/PBL4-517/issues/6): **Implemented, toàn bộ Definition of Done PASS; đang chờ human review, issue giữ OPEN.** EC2 Ubuntu 24.04.4 LTS tại Singapore đã được triển khai và kiểm chứng: Running và cả ba status checks, SSH, Nginx active/enabled, listener 80, HTTP local và browser Public IP. External scanner chạy từ Windows cho kết quả 22/80 OPEN, 3000/5432 FILTERED; SG giới hạn SSH theo một IP `/32`. Người dùng giữ thêm rule 443, chưa cấu hình HTTPS. Đã lưu đủ screenshot/output thật tại [evidence](../evidence/AWS-02/README.md); hướng dẫn và giới hạn kiểm chứng tại [tài liệu AWS](../docs/aws/ec2-launch.md). Chưa deploy website; mini lab tạm gỡ HTTP là tùy chọn, chưa thực hiện.
- Chuẩn bị môi trường AWS EC2 Ubuntu 24.04 LTS để đưa website lên cloud ([Issue #12](https://github.com/LVTIT/PBL4-517/issues/12)–[#14](https://github.com/LVTIT/PBL4-517/issues/14)).

**Next:**

- Tiếp tục các backlog đã giao:
  - [#9](https://github.com/LVTIT/PBL4-517/issues/9)–[#10](https://github.com/LVTIT/PBL4-517/issues/10): Scanner dò quét host/port từ bên ngoài và gửi alert Telegram/Discord.
  - [#11](https://github.com/LVTIT/PBL4-517/issues/11): Architecture v0.1.
  - [#12](https://github.com/LVTIT/PBL4-517/issues/12)–[#17](https://github.com/LVTIT/PBL4-517/issues/17): Cấu hình EC2, Nginx reverse proxy, systemd service, verify deployment và lưu evidence.
  - Chuẩn bị lab branch riêng cho kịch bản OWASP (vulnerable → exploit → evidence → fix → retest) theo đúng [SECURITY_PLAN.md](SECURITY_PLAN.md).

**Important constraints:**

- `main` luôn giữ vững **Secure Baseline** (mã nguồn chuẩn mực, fix đầy đủ các lỗ hổng Injection, XSS, CSRF, IDOR, Broken Authentication).
- Bất kỳ kịch bản cố tình làm yếu hệ thống để thực hiện bài lab tấn công đều phải thực hiện trên branch lab riêng biệt (không đưa lỗ hổng cố ý vào `main`).
