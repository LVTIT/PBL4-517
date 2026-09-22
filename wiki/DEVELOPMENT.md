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

Quy trình bắt buộc: Issue/task → branch riêng → code/test local → push branch → PR vào `main` → CI → human review → Team Leader final merge. Không phát triển hoặc push feature/fix trực tiếp trên `main`; Agent không approve hay merge PR.

Từ working tree sạch, cập nhật `main` bằng `git pull --ff-only origin main`, rồi tạo `feature/<issue-number>-<short-description>`. Nếu có công việc chưa commit, giữ nguyên và tách workspace khi cần. Stage đúng file liên quan (không `git add .` mù quáng), commit `<type>(<scope>): <description> (#issue)`, push task branch và tạo PR. Ví dụ: Toàn `feature/8-web-improvements`, Ninh `feature/10-scanner` hoặc `feature/24-idor-lab`, Team Leader `feature/14-ec2-deployment`.

CI canonical ở [docs/devops/ci-cd.md](../docs/devops/ci-cd.md); năm required checks là `repo-policy`, `backend-build`, `frontend-build`, `backend-integration`, `python-check`. Tất cả phải PASS trên revision mới nhất trước khi báo `READY FOR HUMAN REVIEW`. Main thay đổi thì cập nhật feature branch, giải thích/xử lý conflict tại đó, test lại, push lại và đợi CI mới; không force push hay sửa main để né conflict. Team Leader/Owner merge sau review từ thành viên khác và giải quyết conversations.

### Issue và evidence

- Mặc định dùng `Refs #N` / `Related to #N` trong PR và commit. Agent không dùng `Closes #N`, `Fixes #N`, `Resolves #N` chỉ vì viết xong code.
- Chỉ đóng Issue sau khi tasks thực hiện thật, DoD được xác minh, required CI PASS, evidence có đủ, human review bắt buộc đã xong và không còn blocker của Issue. Sau merge vẫn phải kiểm tra riêng các điều kiện này.
- Không tự tick tiêu chí “cả 3 thành viên hiểu”, “human review”, “demo cho nhóm”, “người dùng xác nhận”; human phải xác nhận.
- Source tồn tại ≠ verified; build PASS ≠ integration PASS; integration PASS ≠ deployment PASS; deployment PASS ≠ security verified; PR merged ≠ Issue Done.
- Ghi command, môi trường, SHA, kết quả và giới hạn; evidence ở `evidence/`, wiki chỉ link. Checklist Implemented / Verified / CI PASS / Human reviewed tách biệt trong PR template.
- Thay đổi permission/ruleset phải có đề xuất cụ thể và human review trước áp dụng. [Hướng dẫn settings](../docs/devops/github-branch-protection.md) không có nghĩa settings đã bật. CD chờ #14 kiểm chứng thủ công; deployment tương lai cần `production` approval và exact tested SHA/artifact.

- Tuân theo workflow/branch thực tế của repository và ủy quyền trong task hiện tại. Việc Issue #7 từng được phép commit `main` không tự tạo quyền bỏ qua mọi workflow tương lai.
- Commit chỉ chứa file liên quan, message mô tả kết quả và issue, ví dụ `feat(web): build initial website skeleton (#8)`.
- Trước commit: kiểm tra diff/status, secret và generated files. Không commit `.env`, `node_modules`, `dist`, log, IDE local files, credential hoặc dump có dữ liệu nhạy cảm.
- Không rewrite history, force push hoặc xóa commit của thành viên. Chỉ cập nhật checklist GitHub đã kiểm chứng; phân biệt implementation xong và issue đang chờ review. Không tự đóng issue khi còn yêu cầu review.
- Sau công việc đáng kể: cập nhật [CURRENT_STATUS.md](CURRENT_STATUS.md); nếu thay đổi kiến trúc, thêm decision và đánh dấu decision cũ Superseded khi phù hợp. Sửa README subsystem nếu lệnh/config/hành vi thay đổi.
- Báo cáo rõ PASS/FAIL và blocker thật, không coi có code/build thành bằng chứng rằng database, browser hoặc deployment đã hoạt động.

Nếu tài liệu và code lệch nhau, kiểm tra Git history/Issue để xác định thông tin hiện hành trước khi sửa. Báo cáo môn học và evidence có thư mục riêng; `wiki/` chỉ giữ context lâu dài và liên kết.
