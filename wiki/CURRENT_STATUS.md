# Current Project Status

**Last updated:** 2026-09-22 (Asia/Bangkok; evidence #12 ghi thời gian UTC ngày 2026-09-21)

**Current phase:** Môi trường EC2 cho Issue #12 đã được chuẩn bị và kiểm chứng, sẵn sàng nhận source ở #14. Website e-commerce đã có source local; chưa deploy website hay systemd backend. OWASP hiện có scenario IDOR; scanner #10 do Ninh tiếp tục.

**Completed:**

- [Issue #12 — Configure EC2 Web Environment](https://github.com/LVTIT/PBL4-517/issues/12): **Implemented / verified ngày 2026-09-21; EC2 READY cho #14.** Ubuntu sau nâng cấp/reboot là 24.04.5 LTS, kernel 7.0.0-1012-aws; APT không còn package chờ nâng cấp. Git 2.43.0, Node.js v24.21.0, npm 11.19.0, PostgreSQL 16.15 (cluster 16/main active, query local PASS, chỉ listen 127.0.0.1:5432), Nginx 1.24.0 active/enabled và HTTP local/public 200. Thư mục `/var/www/pbl4-517` rỗng, `ubuntu:ubuntu`, 0755, kiểm tra ghi file PASS. Người dùng xác nhận toàn bộ SG rules: SSH `171.225.185.22/32`, HTTP/443 public; chưa có TLS, không public 3000/5432/8080. Agent đối chiếu metadata/listeners và scan từ Windows: 22/80 OPEN, 3000/5432/8080 FILTERED; không có quyền đọc SG qua API. [Tài liệu canonical](../docs/aws/ec2-web-environment.md), [evidence thật và giới hạn](../evidence/AWS-03/README.md); trạng thái merge/đóng issue xem liên kết GitHub. Chưa deploy source/app database/systemd backend; RAM khoảng 909 MiB, không swap, chưa kiểm chứng build website.
- [Issue #6 — Launch EC2 Linux](https://github.com/LVTIT/PBL4-517/issues/6): **Completed / CLOSED ngày 2026-09-21.** Human review đã hoàn thành; [PR #25](https://github.com/LVTIT/PBL4-517/pull/25) đã merge cùng evidence (commit `8a66a88`). EC2 Ubuntu 24.04.4 LTS tại Singapore: Running và cả ba status checks PASS, SSH PASS, Nginx active/enabled PASS, port 80 PASS, HTTP local và Browser Public IP PASS. External scanner từ Windows: 22/80 OPEN, 3000/5432 FILTERED; SG giới hạn SSH theo một IP `/32`. Rule 443 được giữ, HTTPS chưa triển khai. [Evidence gốc](../evidence/AWS-02/README.md) được giữ nguyên; trạng thái hiện tại và giới hạn kiểm chứng ở [tài liệu AWS](../docs/aws/ec2-launch.md). Không còn blocker thuộc Issue #6; chưa deploy website.
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
  - **Mở rộng chu trình IDOR toàn diện & Phòng thủ chuyên sâu tầng Database (2026-09-22):**
    - Mở rộng kịch bản IDOR đầy đủ 3 thao tác: Đọc trộm (`GET /api/orders/:id`), Sửa địa chỉ nhận hàng (`PATCH /api/orders/:id`), và Hủy đơn hàng có hoàn tồn kho (`POST /api/orders/:id/cancel`).
    - Triển khai kỹ thuật **Phòng thủ chuyên sâu (Database-level Scoping)** trong `order-service.ts`: Ép điều kiện sở hữu `id + userId` ngay tại tầng truy vấn Database khi ở Secure Baseline (`VULN_IDOR_ENABLED=false`), triệt tiêu hoàn toàn nguy cơ rò rỉ dữ liệu nhạy cảm (PII) lên RAM Node.js.
    - Bổ sung bộ công cụ khai thác hoàn chỉnh trong `scripts/attacker/`: [`exploit_idor.py`](../scripts/attacker/exploit_idor.py) (Read IDOR), [`exploit_idor_update.py`](../scripts/attacker/exploit_idor_update.py) (Write IDOR - Đổi địa chỉ), [`exploit_idor_cancel.py`](../scripts/attacker/exploit_idor_cancel.py) (Write IDOR - Hủy đơn).
    - Tạo hồ sơ kiểm chứng đầy đủ tại [`evidence/OWASP-01/README.md`](../evidence/OWASP-01/README.md).
    - Mở rộng bộ kiểm thử tự động [`tests/api.integration.test.mjs`](../website/backend/tests/api.integration.test.mjs) kiểm tra toàn diện cả 3 thao tác cho cả kẻ tấn công (chặn 403) và chủ đơn hợp lệ (thành công 200). Backend build đạt 100% không lỗi (`npm run build`).
  - **Database & Prisma:** Migration `20260918000000_expand_ecommerce` và `20260918140000_guest_checkout` (hỗ trợ `userId String?`, lưu `customerName`, `customerEmail`, `customerPhone` cho đơn hàng khách vãng lai). Cập nhật `seed.ts` với tài khoản Admin demo (`admin@example.com` / `AdminOnly517!`).
  - **Kiểm thử & Build:** Đã bổ sung bộ kiểm thử tự động, 16/16 backend integration tests chạy thành công (`npm run test:integration`); cả frontend (`npm run build`) và backend (`npm run build`) biên dịch 100% không lỗi.

**In progress:**

- [#28 — GitHub CI/process](https://github.com/LVTIT/PBL4-517/issues/28): **Implemented / hosted CI verified; chờ human review và Team Leader merge ở [PR #29](https://github.com/LVTIT/PBL4-517/pull/29)**. [Run triển khai](https://github.com/LVTIT/PBL4-517/actions/runs/35713164678) PASS cả 5 checks; PostgreSQL 16.15 thật, 3 migration, seed, health, integration 16/16 PASS; audit cả hai project 0 vulnerabilities. Đã thêm PR template, policy/evidence governance và [CI/CD docs](../docs/devops/ci-cd.md). [Evidence và giới hạn](../evidence/DEVOPS-01/README.md) ghi rõ SHA; trước merge phải đối chiếu latest PR checks, kể cả commit cập nhật docs. Branch protection hiện chưa bật; [đề xuất settings](../docs/devops/github-branch-protection.md) chờ human review trước áp dụng. CD chưa triển khai, không deploy EC2 hay tự đóng Issue.

- [#10 — Scanner](https://github.com/LVTIT/PBL4-517/issues/10): Ninh tiếp tục thực hiện; việc dùng scanner trong #12 chỉ là kiểm tra hạ tầng phụ.

**Next:**

- Tiếp tục các backlog đã giao:
  - [#10](https://github.com/LVTIT/PBL4-517/issues/10): Ninh tiếp tục học/phát triển scanner; task #12 chỉ dùng prototype để verification phụ, không đóng #10. Alert Telegram/Discord thuộc giai đoạn sau.
  - [#11](https://github.com/LVTIT/PBL4-517/issues/11): Architecture v0.1.
  - [#14](https://github.com/LVTIT/PBL4-517/issues/14): Deploy source website lên EC2; [#15](https://github.com/LVTIT/PBL4-517/issues/15): systemd backend; [#16](https://github.com/LVTIT/PBL4-517/issues/16): verify deployment; [#17](https://github.com/LVTIT/PBL4-517/issues/17): tài liệu/evidence triển khai.
  - Chuẩn bị lab branch riêng cho kịch bản OWASP (vulnerable → exploit → evidence → fix → retest) theo đúng [SECURITY_PLAN.md](SECURITY_PLAN.md).

**Important constraints:**

- `main` luôn giữ vững **Secure Baseline** (mã nguồn chuẩn mực, fix đầy đủ các lỗ hổng Injection, XSS, CSRF, IDOR, Broken Authentication).
- Bất kỳ kịch bản cố tình làm yếu hệ thống để thực hiện bài lab tấn công đều phải thực hiện trên branch lab riêng biệt (không đưa lỗ hổng cố ý vào `main`).
