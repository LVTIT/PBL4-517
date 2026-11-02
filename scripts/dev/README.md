# Local commands — Windows PowerShell

Refs #68. Setup/migration/seed/build/config website canonical tại
[website README](../../website/README.md#local-nhanh-tren-windows).

## Sử dụng hằng ngày

```powershell
.\dev.ps1 up
.\dev.ps1 status
.\dev.ps1 down
```

`up` bật Compose rồi BE/FE, kiểm tra PostgreSQL 16 và health qua proxy trước khi
báo ready. Web <http://127.0.0.1:5173>, API mặc định 3000; luôn tắt bốn cờ lab.
BE chạy bản đã build: sau sửa source, build theo website README rồi down/up.
`down` dừng các process launcher quản lý và DB, giữ volume. Log: `.local/runtime/logs/`.
Start lặp lại giữ process đang chạy; đổi cấu hình cần stop/start.
Stop kiểm tra PID, thời điểm tạo và executable để tránh nhầm PID tái sử dụng.
Cổng do process khác chiếm sẽ báo lỗi, không tự kill. Root `.bat` cũ vẫn hoạt động.

## Database

Compose chỉ có service `db`: `pbl517-db`, volume `pbl517-local-data`, PostgreSQL 16
bind **127.0.0.1:55432**. Hai DB/role riêng, không SUPERUSER/CREATEDB/CREATEROLE:

| Database | Role | Dùng cho |
| --- | --- | --- |
| `kevilo_local` | `kevilo_local_app` | Website |
| `kevilo_demo_lab` | `kevilo_demo_lab_app` | Lab dữ liệu giả |

Admin ở `.local/private/database.env`, website ở `website/backend/.env`, lab ở
`.local/private/lab.env`. DB mới thu hồi quyền PUBLIC. Đổi mật khẩu trong file
không tự đổi mật khẩu trong volume. Không tạo thêm container bằng lệnh docker run cũ.

```powershell
.\dev.ps1 db                         # Chỉ bật PostgreSQL
.\scripts\dev\psql-cli.ps1           # Theo kết nối backend .env
.\scripts\dev\view-db.ps1            # Prisma Studio
```

Máy có DB cũ cần backup/chuyển dữ liệu trước; setup không ghi đè cấu hình hoặc
xóa container/DB đang tồn tại. Backup từng DB bằng `pg_dump -Fc`; trước gỡ nguồn,
restore vào DB kiểm tra riêng với `pg_restore --no-owner --no-acl --exit-on-error`,
đối chiếu bảng/migration/dữ liệu. Giữ dump và cấu hình trong `.local/private/`.
PowerShell 5: dump ra file trong container rồi `docker cp`; không dùng `>` cho dump nhị phân.
Rollback: dừng web/lab, restore vào DB riêng, kiểm tra rồi đổi DATABASE_URL.
Không restore đè DB đang dùng hoặc dùng `docker volume prune`.
Volume external được giữ khi `compose down -v`; xóa volume thủ công vẫn mất dữ liệu.

## Bot và demo

Token/chat/sender allowlist theo [scanner README](../../scanner/README.md).
Start bot gửi thông báo sẵn sàng tới nhóm Telegram thật:

```powershell
.\dev.ps1 bot
.\scripts\dev\run.ps1 -Action stop -Component bot
```

Chỉ một listener/token; dừng listener từ terminal khác trước. Status chỉ xác nhận
process; receipt và `/ping` phải xem trong nhóm. Demo theo [scripts/demo](../demo/README.md).

## Di chuyen runtime cu

Dừng bot/watch/scan trước, rồi:

```powershell
python scripts/dev/migrate-runtime.py
python scripts/dev/migrate-runtime.py --apply --stopped
Remove-Item Env:PBL517_REPORTS_DIR -ErrorAction SilentlyContinue
Remove-Item Env:SCANNER_STATE_FILE -ErrorAction SilentlyContinue
```

Lệnh đầu dry-run. Apply copy/kiểm tra baseline, pending alerts, audit và reports;
giữ nguồn, không gộp baseline; đích khác nội dung thì dừng. Backup `.env` ở
`.local/private/migration-<timestamp>/root.env`, reports cũ ở `.local/archive/runtime-<timestamp>/`.
Chỉ sửa hai biến đường dẫn. Nếu bị ngắt, kiểm tra bản copy trước chạy lại.
Sau xác minh, archive artifact cũ với đường dẫn đã kiểm tra; không chuyển DB/dependency/evidence.
Rollback trước scan mới: dừng writer và khôi phục hai đường dẫn từ backup.
Sau scan mới: chuyển nguyên state/outbox/audit mới nhất dưới lock, không restore
baseline cũ làm mất pending delivery. HTML không phải nguồn state.

## Kiểm tra

```powershell
python -m unittest discover -s scanner/tests -v
python -m unittest discover -s scripts/dev/tests -v
powershell -NoProfile -File scripts/dev/tests/lifecycle.ps1
```

Scanner tests mô phỏng delivery. Website test theo README subsystem. Local Compose
không thay production workflow Nginx/systemd; production dùng secrets riêng, không
seed tài khoản mẫu hoặc đưa DB lab lên môi trường thật.
