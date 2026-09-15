# Current Project Status

**Last updated:** 2026-09-15

**Current phase:** Xây dựng và kiểm chứng website local Issue #8; thiết lập knowledge base để bàn giao context.

**Completed:**

- [Issue #7 — Web technology stack selected](https://github.com/LVTIT/PBL4-517/issues/7): đã chốt và CLOSED; hồ sơ ở commit `e1cc09c`. Không coi đây là kết quả deploy Linux/EC2.
- Issues [#2](https://github.com/LVTIT/PBL4-517/issues/2), [#3](https://github.com/LVTIT/PBL4-517/issues/3) đang CLOSED theo GitHub; đọc nội dung issue trước khi suy ra phạm vi đã làm.

**In progress:**

- [Issue #8 — Website skeleton](https://github.com/LVTIT/PBL4-517/issues/8): frontend/backend `npm ci` và build PASS; Prisma generate/migration/seed và API integration 10/10 PASS. Chrome kiểm thử Home/Products/Login, refresh/session/logout, mobile và loading/empty/error PASS. Bản source sạch với database mới cũng PASS; đang push và kiểm tra clone GitHub trước khi cập nhật checklist cuối cùng.
- Knowledge base `wiki/`, bootstrap `AGENTS.md` và liên kết README đã tạo, đang hoàn tất kiểm tra/publish cùng source.

**Next:**

- Hoàn tất kiểm thử/push source và cập nhật checklist/evidence Issue #8 theo kết quả thật. Giữ issue OPEN để người quản lý review, trừ khi workflow hoặc người dùng có chỉ dẫn đóng rõ ràng.
- Tiếp tục backlog đã giao sau khi đọc issue: [#9](https://github.com/LVTIT/PBL4-517/issues/9)–[#10](https://github.com/LVTIT/PBL4-517/issues/10) scanner, [#11](https://github.com/LVTIT/PBL4-517/issues/11) architecture v0.1, [#12](https://github.com/LVTIT/PBL4-517/issues/12)–[#17](https://github.com/LVTIT/PBL4-517/issues/17) EC2/deploy/service/verification/docs, [#18](https://github.com/LVTIT/PBL4-517/issues/18) integration. Viết wiki chưa đồng nghĩa hoàn thành các issue đó.

**Known problems:**

- GitHub publish và kiểm tra bản clone từ remote còn đang thực hiện. Audit cả hai project không còn advisory tại thời điểm kiểm tra; ghi chú duy trì override ở [website/README.md](../website/README.md#notes).
- Docker không chạy được trên máy kiểm thử hiện tại do cấu hình WSL2. PostgreSQL 16 native được dùng để kiểm thử; hướng dẫn Docker chỉ là lựa chọn local, chưa có kết quả chạy trên máy này.

**Important constraints:**

- Giữ stack Accepted ở [WEB_STACK.md](WEB_STACK.md); source web chỉ trong `website/`, API `/api/`, auth session PostgreSQL + HttpOnly/CSRF; không commit secret/generated files.
- AWS/Nginx/systemd, ALB/VPC/SG/NACL, scanner/alerts và OWASP lab chưa triển khai trong scope Issue #8. `main` giữ secure baseline.

**Do not redo:**

- Không chọn lại stack Issue #7 nếu task không yêu cầu thay đổi quyết định.
- Không tạo thêm một website hoặc hướng dẫn setup song song; dùng source hiện có và [website/README.md](../website/README.md).
- Không ghi Planned/Proposed thành Implemented hay đánh dấu checklist chưa kiểm chứng.
