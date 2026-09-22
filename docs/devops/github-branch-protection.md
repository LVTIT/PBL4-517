# Bảo vệ main — đề xuất chờ human review

## Trạng thái đọc thực tế 2026-09-22

Repository `LVTIT/PBL4-517` public, owner là tài khoản cá nhân. API xác nhận quyền admin; `main/protection` trả `404 Branch not protected`, rulesets `[]`, Actions enabled, chưa có environment `production` (chỉ `copilot`). **Chưa áp dụng thay đổi quyền, protection, ruleset hay environment nào.** Mục 8 của task yêu cầu dừng trước khi áp dụng và nhận human review, kể cả khi Agent có quyền admin.

CI source không thay thế repository settings. Cho đến khi owner bật protection, GitHub vẫn có thể cho merge/push thiếu CI/review. Không tuyên bố repository đã được khóa chỉ vì thêm YAML.

## Cấu hình cụ thể cho owner

Sau khi cả năm check đã xuất hiện và PASS trên PR mới nhất, vào repository **Settings → Branches → Add classic branch protection rule**, nhập pattern chính xác `main`:

| Setting | Giá trị đề xuất |
| --- | --- |
| Require a pull request before merging | Bật |
| Require approvals | Bật, **1** approval từ thành viên khác |
| Dismiss stale pull request approvals when new commits are pushed | Bật |
| Require approval of the most recent reviewable push | Bật |
| Require status checks to pass before merging | Bật |
| Require branches to be up to date before merging | Bật |
| Required checks | `repo-policy`, `backend-build`, `frontend-build`, `backend-integration`, `python-check` |
| Expected source của check | Chọn GitHub Actions, không Any source nếu UI cho chọn |
| Require conversation resolution before merging | Bật |
| Do not allow bypassing the above settings | Bật, gồm admin |
| Allow force pushes | **Tắt** |
| Allow deletions | **Tắt** |
| Allow specified actors to bypass required pull requests | Không cấp bypass |

Check lấy theo job name, không nhập `PBL4 CI / ...` tùy ý nếu UI hiện tên job ở trên. Chọn cả năm từ run thật; không yêu cầu tên job bị skip/path-filter. Nếu chọn Rulesets thay classic: Settings → Rules → Rulesets → New branch ruleset; tên `main-reviewed-ci`, target include `main`, enforcement Active, bypass list rỗng; bật Restrict deletions, Block force pushes, Require a pull request (các review option trên), Require status checks (5 tên, strict/up-to-date). Review toàn bộ rule trước Save. Không bật cả hai loại với rule mâu thuẫn.

Không bật merge queue nếu chưa thêm/verify trigger `merge_group`. Không bật Require deployments to succeed khi CD chưa có. Không khóa branch read-only vì nhóm còn phải merge PR đã review.

## Team Leader final merge và giới hạn GitHub

Chính sách nhóm: thành viên tạo/push branch và review; **Lê Viết Thương / repository owner** thực hiện final merge. Agent không tự merge kể cả dùng credential owner. Một approval phải là người khác author/latest pusher; không tự approve và không coi bot review là human confirmation.

Classic setting **Restrict who can push to matching branches** dành cho repository thuộc organization; repository cá nhân này không được coi là đã enforce owner-only merge qua setting đó. Required checks/review bảo vệ chất lượng nhưng không tự biến mọi collaborator thành không có quyền merge. Với cấu hình hiện tại, final merge bởi Team Leader là quy tắc làm việc cần human tuân thủ. Nếu cần enforcement danh tính ở nền tảng, owner phải review riêng phương án organization/role/ruleset; không tự đổi ownership/quyền hoặc tạo bypass cho leader. CODEOWNERS yêu cầu review cũng không đồng nghĩa giới hạn người nhấn Merge.

## Kiểm chứng sau khi owner áp dụng

Owner lưu screenshot hoặc API evidence đã sanitize và ngày áp dụng ở `evidence/DEVOPS-01/`. Kiểm tra PR không có approval bị blocked, check pending/failing bị blocked, approval cũ bị dismiss khi push mới và merge box đòi cập nhật base khi stale. Dùng PR thử có phạm vi, không thử force-push/xóa `main`. Đối chiếu lại protection/rulesets API và required contexts. Human review xác nhận owner đã kiểm chứng các setting; Agent không tự tick.

## Production environment — chỉ thiết kế cho giai đoạn sau

Khi #14 và quy trình deployment đã được kiểm chứng, owner vào Settings → Environments → New environment `production`; thêm required reviewer là thành viên chịu trách nhiệm, bật Prevent self-review, bỏ Allow administrators to bypass configured protection rules, Selected branches/tags chỉ branch `main` (không mở tag cùng tên). Khai báo environment secrets theo quy trình đã duyệt. Public repository hỗ trợ required reviewers; kiểm tra lại plan nếu đổi visibility. Không tạo workflow deploy thực thi trước khi gate được cấu hình/kiểm chứng. Trong task #28 chưa tạo environment hay secrets.

Nguồn: [GitHub — branch protection settings](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule), [protected branches và giới hạn](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
