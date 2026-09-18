# Decision log

Chỉ ghi **Accepted** khi có yêu cầu/xác nhận hoặc quyết định đã được chấp nhận trong task; **Proposed** dành cho đề xuất chưa chốt. Khi thay đổi quyết định, thêm entry mới, đánh dấu entry cũ **Superseded** và dẫn tới entry thay thế; không xóa lý do/lịch sử cũ. Trạng thái triển khai/kiểm thử được duy trì riêng tại [CURRENT_STATUS.md](CURRENT_STATUS.md).

## 2026-09-14 — Chọn web technology stack cho Issue #7

**Status: Accepted**

**Decision:** React + TypeScript + Vite, CSS thuần; Node.js 24 LTS + Express 5 + TypeScript; PostgreSQL 16 + Prisma 7. Production target: Ubuntu Server 24.04 LTS trên AWS EC2, Nginx phục vụ frontend/proxy API, systemd quản lý backend.

**Reason:** Tận dụng TypeScript từ PBL3, phù hợp nhóm ba người, dữ liệu quan hệ và mục tiêu học Linux/AWS. Người dùng đã xác nhận lựa chọn và yêu cầu hoàn thành Issue #7, commit vào `main`; không suy diễn thành xác nhận riêng của từng thành viên.

**Consequences:** Khóa dependency, học React/Express/Prisma, quản lý frontend/backend riêng. Target production được chấp nhận nhưng chưa đồng nghĩa đã deploy. Không tự đổi stack nếu không có quyết định mới.

**Related:** [Issue #7](https://github.com/LVTIT/PBL4-517/issues/7), commit [`e1cc09c`](https://github.com/LVTIT/PBL4-517/commit/e1cc09c), [hồ sơ lịch sử](../docs/README.md), [WEB_STACK.md](WEB_STACK.md).

## 2026-09-14 — Skeleton local và quy ước API cho Issue #8

**Status: Accepted**

**Decision:** Source ở `website/frontend` và `website/backend`; chỉ triển khai Home, Login, Products, backend/database và khả năng chạy từ clone sạch. Frontend dùng relative `/api/...`; Vite proxy local và Nginx giữ nguyên prefix khi deploy sau này. Backend production chạy JavaScript compile bằng Node.

**Reason:** Yêu cầu trực tiếp của người dùng cho Issue #8 và hướng kiến trúc Issue #7; cần frontend/backend/PostgreSQL kết nối thật, dễ bàn giao và không phải viết lại khi đưa lên EC2.

**Consequences:** Cần lockfile riêng, `.env.example`, migration/seed, README đầy đủ và kiểm thử thật trước khi đánh dấu DoD. Cart/payment/admin đầy đủ, AWS và scanner không thuộc scope này.

**Related:** [Issue #8](https://github.com/LVTIT/PBL4-517/issues/8), [ARCHITECTURE.md](ARCHITECTURE.md), [website/README.md](../website/README.md).

## 2026-09-14 — PostgreSQL session, cookie và CSRF

**Status: Accepted**

**Decision:** Theo yêu cầu session phía server của Issue #8, dùng `express-session` với `connect-pg-simple`, bảng PostgreSQL được migration quản lý, cookie HttpOnly/SameSite=Lax, Secure khi production. Password bcrypt cost 12; session ID được tạo lại khi login. CSRF synchronizer token lấy qua `GET /api/auth/csrf`, gửi `X-CSRF-Token` cho login/logout.

**Reason:** Lưu phiên qua restart, tránh token nhạy cảm trong localStorage, đáp ứng yêu cầu password hashing và bảo vệ state-changing requests có cookie. CSRF token là lựa chọn triển khai trong phạm vi được giao, tương thích same-origin proxy.

**Consequences:** Auth cần PostgreSQL hoạt động; frontend giữ cookie cùng session khi lấy/gửi token, lấy token mới sau khi session đổi. Production HTTPS và `trust proxy` phải cấu hình theo proxy thực tế. Account seed công khai chỉ dùng local/testing.

**Related:** [Issue #8](https://github.com/LVTIT/PBL4-517/issues/8), [session middleware source](../website/backend/src/middleware/session.ts), [CSRF source](../website/backend/src/middleware/csrf.ts), [SECURITY_PLAN.md](SECURITY_PLAN.md).

## 2026-09-14 — Prisma 7, migration và dữ liệu tiền chính xác

**Status: Accepted**

**Decision:** Dùng Prisma 7 với `prisma.config.ts`, client generate và PostgreSQL driver adapter; CLI/Client khóa cùng phiên bản. Commit migration SQL cho User, Product, Session; clone mới áp dụng `migrate deploy`, seed tường minh. Giá dùng PostgreSQL `Decimal(12,2)`, API trả chuỗi.

**Reason:** Yêu cầu đúng major Prisma 7, migration tái lập được và tránh floating point thiếu kiểm soát cho giá sản phẩm.

**Consequences:** Generate client khi cài/build; không dùng `db push` làm đường setup duy nhất. Seed upsert dữ liệu demo, reset password/role và sản phẩm fixture; bị chặn khi `NODE_ENV=production`. Tạo migration mới bằng `migrate dev` cần shadow database phù hợp.

**Related:** [Issue #8](https://github.com/LVTIT/PBL4-517/issues/8), [schema](../website/backend/prisma/schema.prisma), [migration](../website/backend/prisma/migrations/20260914000000_initial/migration.sql), [Prisma 7 official guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).

## 2026-09-14 — Knowledge base và tách secure baseline khỏi OWASP lab

**Status: Accepted**

**Decision:** Theo yêu cầu bổ sung của người dùng trong task Issue #8, `wiki/` là nguồn context lâu dài, root `AGENTS.md` hướng dẫn bootstrap, README subsystem giữ lệnh setup canonical. `main` giữ secure baseline; vulnerable → exploit → evidence → fix → retest thực hiện trong môi trường/branch lab được kiểm soát với dữ liệu giả.

**Reason:** Thành viên và AI Agent tiếp theo cần biết quyết định, tiến độ và ranh giới đã chốt mà không suy đoán lại; mục tiêu OWASP không làm yếu website baseline hoặc nhầm kế hoạch với kết quả.

**Consequences:** Cập nhật current status sau công việc đáng kể, ghi decision mới khi đổi kiến trúc, ưu tiên link để tránh trùng tài liệu. Lab/scenario và hạ tầng tương lai phải ghi Planned hoặc Proposed đúng tình trạng; không lưu báo cáo/evidence trong wiki.

**Related:** [wiki/README.md](README.md), [DEVELOPMENT.md](DEVELOPMENT.md), [SECURITY_PLAN.md](SECURITY_PLAN.md), [Issue #8](https://github.com/LVTIT/PBL4-517/issues/8).

## 2026-09-18 — Mở rộng tính năng e-commerce tạo bề mặt kiểm thử OWASP Top 10

**Status: Accepted**

**Decision:** Bổ sung các tính năng cốt lõi cho website nhưng giữ cấu trúc cơ bản và tinh gọn:
1. Xác thực mở rộng: Đăng ký (`Register`), Quản lý hồ sơ (`Profile`), Đổi mật khẩu (`changePassword`).
2. Danh mục & Tìm kiếm: Lọc `category`, tìm kiếm theo từ khóa `search`, xem chi tiết sản phẩm.
3. Đánh giá sản phẩm (`Review`): Xếp hạng 1–5 sao và bình luận đánh giá.
4. Giỏ hàng & Đơn hàng (`Cart` & `Order`): Quản lý giỏ hàng phía client (`CartContext`), tạo đơn hàng với tính toán giá và trừ kho phía server, chặn truy cập trái phép IDOR (`/api/orders/:id`).
5. Phân quyền Quản trị viên (`ADMIN`): Bảng điều khiển admin (`/admin`) cho phép thêm/xóa sản phẩm và cập nhật trạng thái đơn hàng thông qua middleware `requireAdmin`.

**Reason:** Đáp ứng yêu cầu của đề tài PBL4-517: Website thương mại điện tử cần đủ các chức năng nghiệp vụ thông dụng để tạo bề mặt tấn công (attack surface) phong phú cho các bài lab OWASP Top 10 (Injection, Broken Authentication, XSS, Broken Access Control / IDOR, Security Misconfiguration), đồng thời duy trì Secure Baseline trên nhánh `main`.

**Consequences:** Thêm migration schema cho `Review`, `Order`, `OrderItem`, `OrderStatus` và `category` cho `Product`. Cập nhật `seed.ts` tài khoản admin demo. Cả frontend và backend cần tiếp tục duy trì 100% build pass và type safety.

**Related:** [wiki/CURRENT_STATUS.md](CURRENT_STATUS.md), [wiki/SECURITY_PLAN.md](SECURITY_PLAN.md), [website/README.md](../website/README.md).

## 2026-09-18 — Chuẩn hóa kịch bản khai thác OWASP bằng script và cờ cấu hình môi trường

**Status: Accepted**

**Decision:** Thay vì chỉnh sửa/comment code thủ công trong lúc demo, hệ thống sử dụng các cờ cấu hình môi trường độc lập (ví dụ `VULN_IDOR_ENABLED=true/false` trong `.env`) để bật/tắt từng kịch bản lỗ hổng. Xây dựng bộ script khai thác tự động lưu trong `scripts/attacker/` (khởi đầu với `exploit_idor.py`).

**Reason:** Đảm bảo nhánh `main` luôn duy trì **Secure Baseline** mặc định (`VULN_*=false`) khi triển khai lên AWS Cloud, đồng thời cho phép bật nhanh chế độ thực nghiệm an toàn khi bảo vệ đồ án trước giảng viên mà không gây rủi ro lỗi cú pháp hay làm xáo trộn mã nguồn.

**Consequences:** Mọi kiểm thử tự động (integration tests) mặc định chạy trên Secure Baseline (100% pass). Khi làm lab/demo, chỉ cần thay đổi cờ môi trường và chạy script Python tương ứng từ máy tấn công (Attacker).

**Related:** [wiki/CURRENT_STATUS.md](CURRENT_STATUS.md), [wiki/SECURITY_PLAN.md](SECURITY_PLAN.md), [scripts/attacker/exploit_idor.py](../scripts/attacker/exploit_idor.py).
