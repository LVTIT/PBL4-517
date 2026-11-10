# Công cụ local — Refs #68

Lệnh cài/chạy website, database và env được duy trì tại
[website README](../../website/README.md#local-nhanh-tren-windows).
Kịch bản học và demo: [demo README](../demo/README.md).

## Cách launcher hoạt động

`dev.cmd` gọi PowerShell với policy chỉ áp dụng cho process hiện tại; không đổi
execution policy của máy. `cli.ps1` khóa thao tác đồng thời, điều phối database,
website và probe. Các process nền ẩn cửa sổ, stdout/stderr nằm trong
`.local/runtime/logs/`. Ownership kiểm tra PID + thời điểm tạo + executable trước
khi dừng; không tự kill process đang chiếm port nhưng không thuộc launcher.

`run.ps1` dùng đúng `website/backend/.env` cho DATABASE_URL/SESSION_SECRET/PORT,
chỉ chấp nhận database loopback `kevilo_local_lab`. Mode secure ép mọi flag false;
mode lab ép đúng một flag true cùng acknowledgment. File env gốc được giữ nguyên
khi chuyển mode; giá trị hiệu lực được truyền cho child process rồi phục hồi môi
trường của launcher. Production không sử dụng launcher Windows này.

Website luôn ở `http://127.0.0.1:5173`; API mặc định 3000. `up` lặp lại giữ process
đang chạy nếu không có demo/cấu hình thay đổi. Trở về `up` sau demo tạo backend mới,
xóa bộ đếm auth cũ. Đổi source cần down rồi setup để build lại.

## Database và bảo toàn dữ liệu

Compose có một service `db`, PostgreSQL 16, container mặc định `pbl517-db`, publish
`127.0.0.1:55432`. Volume external `pbl517-local-data` được giữ khi down. Chỉ một
database **đang sử dụng**: `kevilo_local_lab`, role `kevilo_local_lab_app` không có
SUPERUSER/CREATEDB/CREATEROLE. Admin chỉ phục vụ provisioning, ở
`.local/private/database.env`; credential ứng dụng ở backend `.env`.

Setup mới tạo secret/database, migrate, seed khi cả User/Product trống và tạo
fixture nếu chưa có. Setup lại không reset tài khoản, đơn, tồn kho hoặc fixture.
Đổi POSTGRES_PASSWORD trong file không đổi password của volume đã khởi tạo.

Nếu còn cấu hình PR #69 (`kevilo_local` cùng managed port/container), setup copy
qua `pg_dump -Fc`/`pg_restore --no-owner --no-acl`, so SHA-256 nội dung **mọi bảng
public** trước khi chuyển DATABASE_URL. Config/manifest cũ và dump ở
`.local/private/backup-<timestamp>/`. Source database cũ vẫn giữ làm nguồn rollback;
không tự merge dữ liệu hai DB hoặc xóa database cũ. Lab manifest cũ thuộc database
khác được archive, rồi tạo fixture cho database chung mới. Setup từ chối database
remote/tên không quản lý; không tự đổi production env.

Sau chuyển đổi, các DB cũ có thể còn trong volume để rollback nhưng không được
launcher sử dụng. Không cần chạy thêm container hay website lab thứ hai. Không dùng
`docker volume prune` hoặc xóa volume để sửa lỗi mật khẩu.

## Troubleshooting

| Hiện tượng | Việc cần làm |
| --- | --- |
| Docker Engine unavailable | Mở Docker Desktop, chọn Linux containers; chạy doctor |
| Port occupied | Xem terminal/process gốc; launcher không tự kill |
| UNMANAGED_DATABASE | Giữ env hiện tại; dùng checkout mới cho lab hoặc xem xét migration riêng |
| DATABASE_NAME_TAKEN | Có DB/role nhưng thiếu private binding; kiểm tra backup, không ghi đè |
| MIGRATION_CONTENT_MISMATCH | Giữ nguồn/dump/đích; kiểm tra writers và restore, chưa chuyển env |
| Health thất bại | Đọc log backend riêng tư, kiểm tra DB; không kết luận đã vá lỗi |
| Auth nhận 429 | Sau bài auth chạy up để restart và dùng phiên mới |
| XSS INCONCLUSIVE | Kiểm tra Chromium, fixture và API; chạy setup để chuẩn bị Chromium |

Không chia sẻ nguyên log trước khi rà secret. `status` cho biết process đang được
quản lý; health/probe mới kiểm tra hành vi ứng dụng.

## Runtime scanner cũ

CLI và ChatOps dùng cùng resolver: process environment > root `.env` > default.
Đường dẫn tương đối tính từ repository, không từ thư mục terminal. Default state
`.local/runtime/scanner.state.json`, reports `.local/reports/scanner/`. Có legacy
state thì tiếp tục dùng cho tới migration, không tự tạo baseline rỗng.

Migration chạy dry-run trước, dừng mọi scanner/bot rồi mới apply:

```powershell
python scripts/dev/migrate-runtime.py
python scripts/dev/migrate-runtime.py --apply --stopped
```

Apply copy/xác minh baseline, pending delivery và audit; giữ nguồn, đích khác nội
dung sẽ dừng. Root env chỉ đổi hai đường dẫn, backup riêng tư và reports archive
trong `.local/`. Process environment cũ vẫn ưu tiên hơn dotenv: bỏ override cũ
trong terminal trước khi restart. Sau có scan mới không restore baseline cũ làm
mất outbox; dừng writer và chuyển nguyên state/audit mới nhất dưới lock.

## Kiểm chứng công cụ

```powershell
node --test scripts/dev/tests/settings.test.mjs
python -m unittest discover -s scripts/dev/tests -v
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/tests/lifecycle.ps1
```

Fresh-source/Docker acceptance được ghi riêng trong evidence; CI Windows kiểm tra
guards/lifecycle/parser, không giả định Docker Linux sẵn có trên Windows runner.
