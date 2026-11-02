# PBL4-517 — KEVILO

Đồ án Linux/AWS Cloud: website thương mại điện tử, giám sát cổng TCP,
cảnh báo Telegram/Discord và các bài lab bảo mật có kiểm soát.

## Chạy local

Cài Git, Node.js 24, Python 3.12+ và bật Docker Desktop. Từ thư mục dự án:

```powershell
.\dev.ps1 setup           # Lần đầu: dependency, build, DB, migration, dữ liệu demo
.\dev.ps1 up              # Những lần sau: PostgreSQL + backend + frontend
.\dev.ps1 status
.\dev.ps1 down            # Dừng dịch vụ; giữ dữ liệu
```

Website: <http://127.0.0.1:5173>. Chi tiết tại [website README](website/README.md#local-nhanh-tren-windows).
Nếu PowerShell chặn script: `powershell -NoProfile -ExecutionPolicy Bypass -File .\dev.ps1 up`
(chỉ áp dụng cho tiến trình này).

## Tìm đúng hướng dẫn

| Công việc | Tài liệu |
| --- | --- |
| Cấu hình, build, database, API | [Website](website/README.md) |
| Bật/tắt, log, migration runtime, khôi phục DB | [Local commands](scripts/dev/README.md) |
| Demo IDOR/SQLi/XSS/auth trước và sau phòng thủ | [Local demo](scripts/demo/README.md) |
| Scanner và Telegram/Discord | [Scanner](scanner/README.md) |
| Demo release trên EC2 | [EC2 runbook](scripts/attacker/README.md) |
| Kiến trúc, quyết định, tiến độ | [Wiki](wiki/README.md) |
| AWS, CI và hồ sơ thiết kế | [Tài liệu](docs/README.md) |
| Bằng chứng kiểm thử | [Evidence index](evidence/README.md) |

## Cấu trúc

```text
dev.ps1             Điểm vào local: setup/up/down/demo/probe/bot/status
compose.yaml        Một PostgreSQL 16; website và lab dùng DB/role riêng
website/frontend/   React + TypeScript + Vite + CSS
website/backend/    Express + Prisma; schema/migration duy nhất của ứng dụng
scanner/            Scanner, reporter, tests, systemd template
alerts/             Telegram/Discord notifier và Telegram ChatOps
scripts/dev/        Lifecycle local, database helpers, migration runtime
scripts/demo/       Chuẩn bị và điều phối lab local
scripts/attacker/   Probe dùng chung local/EC2
scripts/release/    Metadata và xác minh artifact
scripts/ci/         Policy và integration checks
wiki/               Context và quyết định hiện hành
docs/               Hướng dẫn chuyên sâu, hồ sơ thiết kế
evidence/           Bằng chứng đã rà soát theo subsystem/issue
.local/             Dữ liệu riêng của máy, không commit
```

| Dữ liệu local | Vị trí |
| --- | --- |
| Process records, logs, baseline/outbox scanner | `.local/runtime/` |
| HTML/Markdown scanner | `.local/reports/scanner/latest.html` |
| Kết quả demo bảo mật | `.local/reports/security/` |
| Admin DB, lab, tài khoản demo, backup | `.local/private/` |
| Artifact cũ để đối chiếu | `.local/archive/` |
| PostgreSQL website + lab | Docker volume `pbl517-local-data` |

Root `.env` chứa monitoring; `website/backend/.env` chứa DB/session website.
Chỉ `.env.example` được commit. CLI và Telegram dùng chung quy tắc đường dẫn.
Root `.bat` cũ chuyển tiếp tới script mới. Bot bật riêng vì gửi tin thật.

Production giữ PostgreSQL 16, Nginx, backend systemd và build từ commit đã review;
xem [deployment](docs/aws/ec2-deployment-review.md). Local launcher không triển khai EC2.
Thay đổi theo [workflow](wiki/DEVELOPMENT.md): issue → feature branch → test → PR → human review.
Agent bắt đầu từ [AGENTS.md](AGENTS.md).
