# UI-01 — kiểm tra nhánh và bản public

Kiểm tra ngày 2026-10-02 (Asia/Bangkok), Refs #51.

## Kết quả đối chiếu

| Thành phần | Kết quả kiểm chứng |
| --- | --- |
| Local và remote feature branch | `feature/51-kevilo-ui`, `7cf386848c3d4500f006e6faf215f644935338d8`; working tree sạch trước kiểm tra |
| Remote main | `4e5fb08f7863be0e8015929b05787250c8d371f5`, chưa chứa commit UI |
| [PR #52](https://github.com/LVTIT/PBL4-517/pull/52) | OPEN, chưa merge, danh sách review rỗng tại thời điểm kiểm tra |
| [CI run 37034394584](https://github.com/LVTIT/PBL4-517/actions/runs/37034394584) | Cả năm required jobs PASS; log backend-integration xác nhận API 16/16 và Playwright 28/28 PASS |
| EC2 `/var/www/pbl4-517` | SSH read-only xác nhận detached HEAD sạch tại `e0f783b619def8c7123ec417239e32866ff72ee7` |
| EC2 frontend | `website/frontend/dist/index.html` còn title `517 Store · Góc làm việc của bạn`, JS `index-ggfYMJl0.js`, CSS `index-DQxJU7bz.css` |
| Public HTTPS | GET `https://47.129.214.70/` trả 200, cùng HTML cũ; Last-Modified `Sun, 27 Sep 2026 08:26:17 GMT` |
| Backend service | Tên thực tế `pbl4-backend`, active/enabled; health trả `status: ok`, `database: connected` |
| Public catalog | Backend trả một sản phẩm `Deployment verification item - NOT FOR SALE`, stock 0; chưa có catalog KEVILO 10 sản phẩm |

Nguyên nhân UI cũ là EC2 chưa được triển khai commit UI mới. Checkout/build
trên Windows và push feature branch không cập nhật thư mục `dist` trên EC2.
Workflow hiện tại chạy CI, không có bước tự động deploy production.

## Kiểm tra local trong lượt audit

- `npm.cmd run build` tại frontend và backend: PASS.
- `npm.cmd run test:e2e -- --workers=2` tại frontend: 28/28 PASS (16.1s).
- Backend local không chạy trong lượt E2E này; có proxy ECONNREFUSED cho các
  request không được mock. Kết quả này chỉ xác nhận các assertion hiện có;
  kiểm chứng API với PostgreSQL thật lấy từ log CI nêu trên.
- Không checkout, build, migrate, import, restart hay thay cấu hình trên EC2.

## Giới hạn so với Issue #51

- Các luồng UI chính và assets đã có trong source. Chưa xác nhận hoàn tất toàn
  bộ plan hoặc toàn bộ WCAG 2.2 AA: `accessibility.spec.ts` tắt `color-contrast`,
  chỉ chọn tag WCAG 2.0/2.1, chỉ audit Home và Catalog.
- 28 lượt test là 14 test chạy ở hai cấu hình trình duyệt. Chúng chưa kiểm chứng
  toàn bộ checkout thật, cô lập giỏ hàng qua login/logout, account/admin/orders.
- `KeviloWordmark` hiện render `<span>`; biểu tượng K là SVG. Chưa có wordmark
  SVG và favicon PNG như mô tả trong Issue.

## Để public hiển thị UI mới

1. Hoàn tất review các điểm còn thiếu; Team Leader/Owner merge PR #52 sau khi
   required CI trên revision cuối PASS, theo quy trình repository.
2. Chốt commit/artifact đã kiểm thử và phê duyệt triển khai production. EC2
   đang detached HEAD; cập nhật đúng commit đã duyệt, không dùng pull như một
   cơ chế tự động deploy hoặc tự merge trên server.
3. Sao lưu bản build/dữ liệu cần thiết cho rollback; cài/build frontend và
   backend trên Linux, áp dụng migration `imageKey` theo
   [lệnh canonical](../../website/README.md#build).
4. Kiểm tra catalog importer ở chế độ dry-run. Nếu bản phát hành được duyệt
   gồm 10 sản phẩm demo, áp dụng importer sau migration; không chạy development
   seed trên production. Importer giữ stock của sản phẩm đã tồn tại nhưng thêm
   stock mặc định cho sản phẩm mới.
5. Restart đúng service `pbl4-backend`, phục vụ frontend build mới qua Nginx,
   kiểm tra HTTPS, API, ảnh, title KEVILO và các luồng cần thiết.

Đây là kết quả audit và thứ tự triển khai đề xuất; chưa phải evidence deploy
KEVILO thành công. Các bước vận hành service ở
[tài liệu #15](../../docs/aws/linux-service-review.md).
