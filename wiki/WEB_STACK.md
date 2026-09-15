# Web stack và conventions

**Status: Accepted.** Stack được chốt ở [Issue #7](https://github.com/LVTIT/PBL4-517/issues/7), ngày 2026-09-14, với hồ sơ gốc tại commit [`e1cc09c`](https://github.com/LVTIT/PBL4-517/commit/e1cc09c). [DECISIONS.md](DECISIONS.md) lưu lịch sử quyết định; [docs/README.md](../docs/README.md) được giữ làm hồ sơ lịch sử.

| Thành phần | Lựa chọn bắt buộc |
| --- | --- |
| Frontend | React + TypeScript + Vite, CSS thuần |
| Backend | Node.js 24 LTS + Express 5 + TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma ORM 7; CLI, Client và adapter khóa phiên bản tương thích |
| Production target | Ubuntu Server 24.04 LTS trên AWS EC2, Nginx, systemd — Planned |

Lý do: tận dụng TypeScript từ PBL3, chia source dễ học cho nhóm ba người, dữ liệu quan hệ phù hợp PostgreSQL, frontend build static và backend Node phù hợp Linux service. Đánh đổi: phải học React/Express/Prisma, quản lý hai project npm và tự cấu hình validation, session, CSRF, migration, vận hành database. Không tự đổi sang Next.js, framework CSS hoặc database khác khi chưa có quyết định thay thế được chấp nhận.

## Conventions

- Source ở `website/frontend/` và `website/backend/`; không tạo monolithic single-file app hoặc website ngoài repository.
- REST API giữ prefix `/api/`. Frontend dùng đường dẫn tương đối; Vite proxy local, Nginx reverse proxy production. Không hard-code production origin trong component.
- Backend dùng ES modules, TypeScript strict; Prisma 7 lấy URL CLI từ `prisma.config.ts`, client generate vào source ignored và runtime dùng PostgreSQL driver adapter. Xem [Prisma ORM 7 chính thức](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).
- Schema thay đổi qua migration SQL được commit; clone mới/deploy dùng `prisma migrate deploy`. Seed gọi rõ ràng, chỉ dùng development. Không dùng `db push` làm cơ chế setup duy nhất.
- Giá sản phẩm dùng `Decimal(12,2)`, API gửi chuỗi; stock/price có ràng buộc không âm trong migration. Session store dùng bảng PostgreSQL được migration quản lý.
- Mỗi frontend/backend giữ `package.json` và `package-lock.json`, cài bằng `npm ci`. Phiên bản patch cụ thể nằm trong manifest/lockfile; wiki không duy trì bảng version thứ hai. Không update dependency tùy tiện sau khi kiểm tra ổn định.
- Backend cấu hình qua `.env` local/environment: `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`, `TRUST_PROXY`. Chỉ commit `.env.example`; không dùng `VITE_*` cho secret. Ý nghĩa và giá trị local chính xác ở [website/README.md — Environment](../website/README.md#environment).
- Build frontend thành static `dist/`; backend compile JavaScript rồi chạy `node dist/server.js`. Nginx/systemd chưa được triển khai trong Issue #8. Không copy `node_modules` từ Windows lên Linux.

Authentication, cookie và CSRF flow nằm tại [website/README.md](../website/README.md#session-password-và-csrf); chiến lược baseline/lab nằm tại [SECURITY_PLAN.md](SECURITY_PLAN.md). Setup local, account demo và lệnh thực thi chỉ duy trì ở README website.
