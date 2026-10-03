# UI-01 — triển khai nhánh KEVILO lên EC2

Refs #51. Ngày 2026-10-03 (Asia/Bangkok). Người dùng yêu cầu triển khai nhánh
`feature/51-kevilo-ui`, giữ PR #52 chưa merge và tiếp tục hoàn thiện UI.
Đây là lần triển khai thủ công được chỉ định, không bật CD hoặc sửa main.

## Bản triển khai đầu tiên

- Commit: `0cfed004b92168a2fb92c9b91d3fac78f8bc31e3`.
- [CI run 37038666755](https://github.com/LVTIT/PBL4-517/actions/runs/37038666755):
  5/5 jobs PASS; API 16/16, Playwright 28/28.
- Ubuntu EC2 `47.129.214.70`, Node v24.21.0, npm 11.19.0, PostgreSQL 16,
  Nginx và systemd `pbl4-backend`.
- SSH khôi phục sau khi human kiểm tra allowlist. Key và strict known-host
  verification được giữ; agent không thay Security Group.
- Build Linux ở worktree riêng, website cũ vẫn hoạt động khi build.
- Backup app và database riêng tư trước migration. Migration
  `20261002000000_add_product_image_key` PASS; dry-run 10 tạo mới/0 cập nhật.
- Apply catalog: 10 sản phẩm KEVILO, tổng 11 gồm sản phẩm kiểm chứng cũ.
  Stock cũ giữ nguyên; user/order/order-item/review counts giữ nguyên 1/1/1/0.
  Không chạy development seed, không tạo tài khoản demo.
- Source/build/dependencies được chuyển sang candidate và service restart
  lúc 10:46:17 Asia/Bangkok. Active/enabled, NRestarts=0; HTTPS health database
  connected; backend/PostgreSQL vẫn chỉ loopback. Hash `.env` không đổi;
  hash toàn bộ build phục vụ khớp manifest build Linux.

## Bằng chứng thực thi

- [Preflight](01-preflight.txt)
- [Build Linux](02-build.txt), [dependency audit](03-audit.txt)
- [Backup, migration và dry-run](04-migration-dry-run.txt)
- [Import và activation](05-activation.txt)
- [Service/database/build postflight](06-postflight.txt)

Lệnh build/migrate/catalog canonical ở [website README](../../../website/README.md).
Các script trong thư mục này ghi lại lệnh đã thực thi cho đúng các SHA/path
đó, không phải script để chạy lại mù quáng hoặc CI/CD tự động.

## Kiểm tra browser và giới hạn

Kiểm tra public đầu tiên tìm thấy header rộng 384px ở viewport 320px sau khi
auth hoàn tất. CI cũ đo DOM quá sớm; test menu còn dùng sai accessible name và
bỏ qua nếu không tìm thấy nút. Bản sửa header và test đang được kiểm thử trên
nhánh 51 trước lần cập nhật tiếp theo. Chưa báo responsive public PASS ở đây.

Dependency audit trên Linux PASS ngưỡng HIGH/CRITICAL. Backend có 2 advisory
mức moderate (`fast-uri`, `ip-address`), frontend 0; xem output audit để biết
phạm vi chính xác. Không tự đổi lockfile của commit đã kiểm thử trong lúc deploy.

Không thực hiện checkout thật, tạo đơn, đăng ký tài khoản hoặc kiểm thử IDOR
trên production. Human review/merge của PR và các phần UI tiếp theo vẫn còn;
không coi bản deploy là hoàn tất Issue #51 hoặc chứng nhận toàn bộ WCAG.

## Backup và rollback

Backup đầu tiên nằm riêng tư trên EC2 tại
`/home/ubuntu/.local/state/pbl4-517/ui51-0cfed00-20261003` (0700, các file 0600).
Chứa dump PostgreSQL, bản build/env trước deploy, dependency cũ và manifest.
Không tải hoặc commit dữ liệu/secret từ backup. Rollback ứng dụng dùng SHA,
build và dependency cũ rồi restart service; giữ cột nullable và catalog đã
import. Không tự restore database/drop cột vì có thể làm mất giao dịch mới.
Nhánh rollback lỗi activation đã chuẩn bị nhưng không cần chạy trong lần này.
