# PBL4 - Project 517

## Topic

Tìm hiểu AWS Cloud, xây dựng chương trình phân tích và giám sát các điểm yếu bảo
mật từ bên ngoài.

## Team

- Lê Viết Thương - Team Leader
- Nguyễn Thái Toàn
- Đinh Khang Ninh

## Thành phần chính

- **Website KEVILO** (`website/frontend`, `website/backend`): React + TypeScript +
  Vite, Express + Prisma, PostgreSQL, API dưới `/api/`.
- **External Scanner** (`scanner/`): quét cổng TCP, thu thập banner, chấm điểm
  heuristic theo OWASP A05, lưu Baseline và phát hiện thay đổi.
- **Cảnh báo & ChatOps** (`alerts/`): Discord Webhook và Telegram Bot, gửi báo
  cáo HTML/Markdown, hỗ trợ `/scan`, `/status`, `/report`, `/ping`, `/help`.
- **Công cụ local** (`scripts/dev`, `scripts/demo`): dựng môi trường và chạy các
  bài lab OWASP với dữ liệu giả.
- **Hạ tầng AWS**: EC2, Security Group, Nginx, HTTPS; tài liệu trong `docs/aws/`.

## Kiến trúc

```text
Trình duyệt ──> Nginx/Vite (frontend) ──> Express API (/api/) ──> PostgreSQL
                                              │
Scanner (TCP + banner) ──> Baseline + báo cáo HTML/Markdown
        │
        └──> Discord Webhook / Telegram Bot (ChatOps)
```

- Local dùng **một PostgreSQL giả dùng chung** (`kevilo_local_lab`) cho website
  và mọi bài demo.
- Lab OWASP bật/tắt bằng cờ `VULN_*`; mặc định **false** (secure baseline).
- Cấu hình lấy từ `.env` ở thư mục gốc và `website/backend/.env`; không commit
  file cấu hình thật.

## Chạy nhanh trên Windows

```powershell
.\dev setup      # cài dependency, tạo database/dữ liệu giả
.\dev up         # chạy database + backend + frontend
.\dev status     # xem trạng thái
.\dev down       # dừng mọi process do launcher quản lý
```

Mở <http://127.0.0.1:5173>. Chạy một bài demo ngắn:

```powershell
.\demo idor
.\demo sqli
.\demo xss
.\demo auth
```

`.\demo` chỉ chạy probe và kiểm chứng kết quả; bạn tự bật/tắt cờ `VULN_*` trong
`website/backend/.env` và restart backend giữa hai pha. Xem chi tiết và lộ trình
tự thao tác tay tại [`scripts/demo/README.md`](scripts/demo/README.md) và
[`scripts/demo/MANUAL.md`](scripts/demo/MANUAL.md).

## Tài liệu

- [wiki/README.md](wiki/README.md) — điểm bắt đầu cho kiến trúc, quyết định,
  context và tiến độ. AI Agent bắt đầu từ [AGENTS.md](AGENTS.md).
- [wiki/ARCHITECTURE.md](wiki/ARCHITECTURE.md) và
  [wiki/DECISIONS.md](wiki/DECISIONS.md).
- [website/README.md](website/README.md) — cài đặt, database, kiểm thử website.
- [scanner/README.md](scanner/README.md) — scanner, Baseline, cảnh báo, báo cáo.
- [scripts/dev/README.md](scripts/dev/README.md) — launcher và database local.
- [docs/LEARNING_PATH.md](docs/LEARNING_PATH.md) — bản đồ code để tự học.
- [docs/aws/](docs/aws/) — hạ tầng, triển khai và vận hành EC2.

## Trạng thái dự án

- Website, scanner và cảnh báo đã có bản triển khai local; các bài lab IDOR,
  SQLi, XSS và auth có probe vulnerable/secure.
- Việc hợp nhất runtime local, lệnh demo ngắn và tài liệu điều hướng đang được
  hoàn thiện trên nhánh `feature/68-simple-local-demo` (Refs #68), chưa merge.
- Triển khai AWS/EC2 và nghiệm thu thật vẫn theo dõi ở các Issue/PR tương ứng;
  tài liệu không thay thế kiểm chứng runtime hoặc human review.

Chi tiết tiến độ đã kiểm chứng nằm ở [wiki/CURRENT_STATUS.md](wiki/CURRENT_STATUS.md).
