# Development workflow

## Bắt đầu một task

1. Đọc [wiki/README.md](README.md) theo thứ tự quy định, đặc biệt [DECISIONS.md](DECISIONS.md) và [CURRENT_STATUS.md](CURRENT_STATUS.md).
2. Đọc GitHub Issue liên quan và README của subsystem; xem code trước khi sửa.
3. Kiểm tra `git branch --show-current`, `git status --short` và lịch sử liên quan. Giữ nguyên công việc không liên quan của thành viên khác.
4. Giới hạn thay đổi theo task; không sửa scanner, alerts, evidence hoặc AWS chỉ vì đang làm website.

```sh
git clone https://github.com/LVTIT/PBL4-517.git
cd PBL4-517
```

Đối với web, cần Node.js 24 LTS, npm và PostgreSQL 16. Cấu trúc subsystem tại [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md); source web tách `website/frontend/` và `website/backend/`.

## Website

**Canonical setup: [website/README.md](../website/README.md).** Tài liệu này có lệnh Windows/Linux, tạo database/user, `.env`, tài khoản demo và troubleshooting; không sao chép toàn bộ lệnh setup vào wiki.

Luồng chuẩn: tạo PostgreSQL database → tạo `.env` và secret riêng → backend `npm ci` → Prisma generate/migrate/seed → chạy backend → frontend `npm ci` → chạy frontend. Prisma migration đã commit dùng cho clone mới; `migrate dev` chỉ khi tạo migration mới và có shadow database phù hợp.

Trước bàn giao thay đổi web, chạy `npm ci` và `npm run build` ở cả hai project; kiểm tra generate, migration, seed và API thật. Kiểm thử đăng nhập đúng/sai, `/me`, refresh, logout; sản phẩm phải từ PostgreSQL. Đọc hướng dẫn [kiểm tra chức năng](../website/README.md#kiểm-tra-chức-năng-local) và lệnh integration test trong README website. Với thay đổi setup, kiểm tra lại từ bản clone/copy source sạch, không mang theo `.env`, dependency/generated files hoặc database cũ.

## Git và bàn giao

- Tuân theo workflow/branch thực tế của repository và ủy quyền trong task hiện tại. Việc Issue #7 từng được phép commit `main` không tự tạo quyền bỏ qua mọi workflow tương lai.
- Commit chỉ chứa file liên quan, message mô tả kết quả và issue, ví dụ `feat(web): build initial website skeleton (#8)`.
- Trước commit: kiểm tra diff/status, secret và generated files. Không commit `.env`, `node_modules`, `dist`, log, IDE local files, credential hoặc dump có dữ liệu nhạy cảm.
- Không rewrite history, force push hoặc xóa commit của thành viên. Chỉ cập nhật checklist GitHub đã kiểm chứng; phân biệt implementation xong và issue đang chờ review. Không tự đóng issue khi còn yêu cầu review.
- Sau công việc đáng kể: cập nhật [CURRENT_STATUS.md](CURRENT_STATUS.md); nếu thay đổi kiến trúc, thêm decision và đánh dấu decision cũ Superseded khi phù hợp. Sửa README subsystem nếu lệnh/config/hành vi thay đổi.
- Báo cáo rõ PASS/FAIL và blocker thật, không coi có code/build thành bằng chứng rằng database, browser hoặc deployment đã hoạt động.

Nếu tài liệu và code lệch nhau, kiểm tra Git history/Issue để xác định thông tin hiện hành trước khi sửa. Báo cáo môn học và evidence có thư mục riêng; `wiki/` chỉ giữ context lâu dài và liên kết.
