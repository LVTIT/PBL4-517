# CI/CD — PBL4-517

Task: [#28](https://github.com/LVTIT/PBL4-517/issues/28). Quy trình được chấp nhận theo yêu cầu task; kết quả chạy thật và trạng thái review ở [evidence](../../evidence/DEVOPS-01/README.md) và [CURRENT_STATUS](../../wiki/CURRENT_STATUS.md).

## CI đã triển khai

[`PBL4 CI`](../../.github/workflows/ci.yml) chạy trên mọi PR vào `main`, mỗi push `main`, và `workflow_dispatch`. Không lọc đường dẫn: thay đổi docs cũng phải qua đủ check. PR push mới hủy run cũ cùng PR; concurrency phân biệt event để dispatch không hủy PR run. PR kiểm tra merge ref của GitHub (head kết hợp base), vì vậy evidence ghi cả head SHA và tested merge SHA. Push `main` kiểm tra chính SHA đã merge.

Workflow chỉ cấp `contents: read`, checkout không lưu credential, không dùng `pull_request_target`, không cấp production secrets cho PR. Chỉ dùng các action chính thức `actions/checkout`, `actions/setup-node`, `actions/setup-python`, pin full commit SHA và ghi major để audit. Cache chỉ npm download cache; mỗi job vẫn `npm ci`. Không upload artifact/log thô.

| Required check (tên chính xác) | Xác minh | Timeout |
| --- | --- | --- |
| `repo-policy` | Python regression tests; kiểm tra đường dẫn và credential signatures trong toàn bộ Git index | 5 phút |
| `backend-build` | Node 24, clean install, Prisma generate + TypeScript build, npm audit HIGH/CRITICAL | 15 phút |
| `frontend-build` | Node 24, clean install, TypeScript check + Vite production build, cùng audit policy | 15 phút |
| `backend-integration` | PostgreSQL 16 thật; build → migration deploy → seed → compiled backend → health → test | 15 phút |
| `python-check` | Python 3.12 compileall scanner, attacker và CI helpers; không thực thi scanner/exploit | 5 phút |

Không dùng `continue-on-error`. HIGH/CRITICAL advisory, audit registry error, install/build/type error, migration/seed lỗi, health/test lỗi đều fail. LOW/MODERATE được báo nhưng không chặn theo threshold này; không dùng `npm audit fix --force` để chữa CI. Xử lý nguyên nhân, cập nhật dependency có phạm vi/review khi cần và chạy lại CI.

### PostgreSQL và Secure Baseline

Service `postgres:16` khởi tạo database rỗng riêng từng job, health check `pg_isready`, port runner 5432. Password và session secret trong YAML là fixture CI công khai, không dùng được cho production. Backend build riêng cần dummy `DATABASE_URL` vì Prisma config đọc biến này ngay khi generate; job build không kết nối database.

Integration dùng các script canonical trong [website/README](../../website/README.md): `npm ci`, `npm run build` (đã generate), `npm run prisma:migrate` (migrate deploy), `npm run prisma:seed`, `npm start`, `npm run test:integration`. Không mock database hoặc dùng `db push`. Suite đối chiếu SQL thật, PostgreSQL sessions, CSRF, auth và IDOR đọc/sửa/hủy. `NODE_ENV=development` cho fixture seed và HTTP loopback; entrypoint vẫn là bản compile `node dist/server.js`.

`VULN_IDOR_ENABLED=false` được đặt rõ và harness kiểm tra trước khi start. Harness polling `/api/health` tối đa 30 lần, mỗi request tối đa 2 giây và nghỉ 2 giây khi chưa sẵn sàng; test có timeout 180 giây. Backend process group được dừng qua trap khi xong/lỗi. Khi startup/health/test fail, in backend log đã sanitize; test output luôn được sanitize. Không dùng production credential, không upload `.env`, database hay log thô.

CI không quét host public và không chạy attacker scripts: chỉ compile Python. Các assertion IDOR trong integration chỉ gửi request tới backend loopback của runner. Lab có scope/evidence riêng theo [SECURITY_PLAN](../../wiki/SECURITY_PLAN.md).

### Repository policy và giới hạn

[`repo_policy.py`](../../scripts/ci/repo_policy.py) đọc Git index blobs (bao gồm file bị `git add -f`), không dựa vào `.gitignore`. Chặn env thật (chỉ cho basename `.env.example`), key/private key signatures, tên credential phổ biến, token GitHub/AWS/Slack/OpenAI có signature, dependencies/build/generated client, logs, Python cache, database/local dumps. SQL chỉ cho `website/backend/prisma/migrations/<migration>/migration.sql`; migration và evidence text đã sanitize vẫn được commit. Symlink/submodule phải được review policy trước, không tự đi theo đường dẫn ra ngoài repo. Khi fail chỉ in đường dẫn đã escape và loại vi phạm, không in dòng nội dung khớp.

Đây là guard theo đường dẫn/signature, không chứng minh repository không có mọi secret: mật khẩu tùy ý, binary/screenshot, archive và lịch sử cũ cần human review/secret scanning bổ sung. `.env.example` cũng được scan signatures và chỉ chứa placeholder. Không thêm allowlist rộng để CI xanh. Khi lộ credential thật, revoke/rotate theo owner trước; xóa file khỏi HEAD không xóa lịch sử.

CI xanh không ngăn merge cho đến khi required checks/reviews được bật trong repository settings. Workflow/policy cũng có thể bị sửa trong PR: human phải review `.github/`, `scripts/ci/`, tests và thay đổi governance. Chi tiết cấu hình và giới hạn enforce Team Leader merge ở [branch protection](github-branch-protection.md).

## Quy trình nhóm ba thành viên

Issue/task → `feature/<issue>-<description>` → code/test local → push branch → PR → CI PASS trên revision mới nhất → thành viên khác review → Team Leader/Owner final merge. Agent không approve, merge, bỏ check hoặc tự đóng Issue. Main thay đổi: cập nhật feature branch, giải conflict trên branch, test/push và đợi CI mới. Dùng `Refs #N`, không dùng auto-close keyword chỉ vì code xong. Human review/hiểu bài/demo phải do human xác nhận; chi tiết ở [DEVELOPMENT](../../wiki/DEVELOPMENT.md).

## CD — Planned, chưa bật

Không tạo workflow deploy trong task này. Không SSH/AWS/EC2 action, không production secret, không production environment được tạo hoặc thay đổi. [#14](https://github.com/LVTIT/PBL4-517/issues/14) phải chứng minh deploy thủ công, ghi lệnh canonical và evidence trước khi chuyển sang automation; phối hợp #15–#17 cho service và verification.

Thiết kế giai đoạn sau: manual `workflow_dispatch`, job dùng environment `production`, required human reviewer, prevent self-review, không admin bypass, deployment branch chỉ `main`. Owner kiểm tra environment protection thực tế trước khi thêm deploy step: khai báo `environment: production` trong YAML tự nó không tạo approval gate. Không bật auto deploy theo push trong giai đoạn hiện tại.

Secrets chỉ đặt ở GitHub Environment Secrets (logical names `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`, credential khác nếu quy trình đã chứng minh cần); không đưa vào YAML, docs, artifact hoặc `VITE_*`. Không tạo fake production secret. Giữ `VULN_IDOR_ENABLED=false`; pipeline tương lai phải fail trước deploy nếu khác. Source hiện tại có cờ lab, nên CI này không được coi là runtime guard chặn mọi production misconfiguration.

CD tương lai xác nhận đủ năm check của exact SHA trên `main` và human approval, rồi deploy SHA/artifact bất biến đó; không `git pull` lấy HEAD tùy thời điểm. Ghi SHA, timestamp, actor, environment, kết quả và health/external verification; định nghĩa rollback theo quy trình #14 đã được review. Chỉ đề xuất bật tự động khi manual deployment, tài liệu, rollback, CI và approval gate đã có evidence và human đồng ý.

## Troubleshooting

| Failure | Hành động |
| --- | --- |
| Policy | Xem filename/reason; gỡ secret/generated file khỏi index, giữ file local ignored; kiểm tra credential có cần rotate. |
| npm ci / audit | Kiểm tra lockfile, Node 24, registry/network; sửa root cause rồi rerun, không bỏ check. |
| Prisma build | Kiểm tra dummy `DATABASE_URL` và dependency; không thêm generate thừa. |
| Service/migration/seed | Xem PostgreSQL service health và step fail; đối chiếu migration đã commit, env CI, seed development. Không đổi schema để che lỗi CI. |
| Startup/health | Xem sanitized backend log, DB connection và port; test chưa chạy nếu health fail. |
| Integration | Xem assertion; dùng database local riêng theo README để tái hiện, không production. Restart backend và database fixture mới trước lượt lại. |
| Python | Sửa syntax tại file được báo; không cần chạy exploit. |
| Actions không chạy | Kiểm tra Actions enabled, fork approval, billing/quota, workflow syntax, event target. Báo blocker thật; không ghi PASS. |
| Checks pending sau push | Đợi run revision mới; không dùng run xanh của commit cũ. |

Local gate: `python -m unittest discover -s scripts/ci/tests -v`, stage đúng file rồi `python scripts/ci/repo_policy.py`, `python -m compileall -q scanner scripts/attacker scripts/ci`, `actionlint .github/workflows/ci.yml`. Build/integration setup giữ canonical ở README website. Actionlint là công cụ validation local (không thêm third-party action vào CI).

Tham khảo chính thức: [PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers), [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
