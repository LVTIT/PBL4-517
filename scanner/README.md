# Scanner prototype — Issue #10 (SCAN-02)

Prototype kiểm tra port TCP của một host: [`scan.py`](scan.py) (chỉ dùng
thư viện chuẩn Python, không cài thêm gì).

## Chạy

```sh
# Quét các port mặc định 22,80,443,3000,5432,8080 của localhost
python scanner/scan.py 127.0.0.1

# Chỉ định port và timeout
python scanner/scan.py 127.0.0.1 --ports 22,80,3000,5432 --timeout 0.5

# Quét khoảng port
python scanner/scan.py 127.0.0.1 --ports 20-25
```

Output mẫu (port mở hiện `OPEN`, kèm dòng tổng hợp cuối):

```text
Scan 127.0.0.1 (127.0.0.1): 6 ports, timeout=1.0s
----------------------------------------------
     22/tcp  CLOSED
     80/tcp  CLOSED
    443/tcp  CLOSED
   3000/tcp  OPEN
   5432/tcp  OPEN
   8080/tcp  CLOSED
----------------------------------------------
Open ports: 3000, 5432
```

## Đối chiếu yêu cầu Issue #10

| Task / DoD | Thực hiện |
| --- | --- |
| Nhận IP/hostname đầu vào | Arg `host` (resolve qua `gethostbyname`, báo lỗi rõ khi sai) |
| Scan danh sách port | `--ports` nhận `22,80,3000` hoặc khoảng `20-25` |
| Có timeout | `--timeout` giây cho mỗi port (mặc định 1.0) |
| Hiển thị port open | Mỗi port in `OPEN/CLOSED/FILTERED` + dòng tổng hợp |
| Test với máy/EC2 của nhóm | Đã test localhost (thấy 3000 backend, 5432 PostgreSQL); port 22/80 sẽ hiện `OPEN` khi test EC2 có mở SSH/HTTP (issue #12) |
| Push code lên `scanner/` | `scan.py` + file này |

## Phạm vi cho phép

Chỉ quét `localhost` hoặc host nhóm sở hữu / được cho phép bằng văn bản.
Kết quả port mở là giám sát mạng, chưa chứng minh lỗ hổng ứng dụng.
Xem kiến trúc tại [docs/architecture/v0.1.md](../docs/architecture/v0.1.md)
và context scanner tại [wiki/PROJECT_CONTEXT.md](../wiki/PROJECT_CONTEXT.md).

## Bước tiếp theo

- Issue #9 chốt ngôn ngữ/công nghệ scanner (prototype này đề xuất Python stdlib).
- Quét EC2 thật sau issue #12, rồi làm alert Telegram/Discord theo backlog.
