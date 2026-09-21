# Scanner Fundamentals — Issue #9 (SCAN-01)

Note kiến thức nền và chốt công nghệ cho scanner PBL4-517.
Hiện thực prototype: [`scan.py`](scan.py), hướng dẫn ở [`README.md`](README.md).

## 1. IP và port là gì

- **IP** là địa chỉ của một máy trên mạng (VD: `127.0.0.1` là máy mình,
  Public IP của EC2 là địa chỉ nhóm truy cập từ Internet).
- **Port** là số cửa (1–65535) mà từng dịch vụ trên máy đó lắng nghe.
  VD trên máy dev: `3000` backend Express, `5432` PostgreSQL, trên EC2 sẽ
  thêm `22` SSH và `80` HTTP.

## 2. TCP connection cơ bản

Mở kết nối TCP gồm 3 bước (3-way handshake): client gửi `SYN` →
server trả `SYN-ACK` → client gửi `ACK`. Từ phía scanner, chỉ cần biết:

- `connect()` thành công → có service đang nghe → port **mở**.
- Không cần gửi dữ liệu ứng dụng, chỉ cần bắt tay TCP xong là đủ kết luận.

## 3. Cách kiểm tra port open / closed / filtered

| Kết quả `connect()` | Nghĩa |
| --- | --- |
| Thành công | `OPEN` — có service đang nghe |
| Bị từ chối (`refused`) | `CLOSED` — máy sống nhưng port không có service |
| Hết timeout / lỗi mạng | `FILTERED` — không kết luận được (firewall chặn hoặc host chết) |

`FILTERED` không đồng nghĩa port đóng — chỉ là không quan sát được.
`scan.py` phân loại đúng 3 trạng thái này qua `socket.create_connection`
và `timeout` cho mỗi port.

## 4. Chốt công nghệ scanner

**Python thư viện chuẩn (`socket`, `argparse`) — không thêm dependency.**

- Chạy được ngay trên mọi máy dev lẫn EC2, không cần `pip install`.
- Nhóm đã dùng Python cho script tấn công mẫu (`scripts/attacker/`).
- Output ASCII một dòng một port, dễ parse khi làm alert Telegram/Discord sau này.
- Timeout mặc định `1.0s` mỗi port: đủ nhanh quét vài chục port, đủ chậm
  để không báo `FILTERED` oan trên mạng thường.

## 5. Scanner prototype hoạt động như thế nào (DoD #9)

1. Nhận `host` → resolve DNS/IP qua `gethostbyname`.
2. Parse `--ports` (`22,80,3000` hoặc khoảng `20-25`) → list đã sort/khử trùng.
3. `connect()` từng port với `--timeout` → ghi `OPEN/CLOSED/FILTERED`.
4. In bảng kết quả + dòng tổng hợp `Open ports: ...`, exit code `0`
   (lỗi tham số/host exit `2`).

## 6. Liên quan

- Kiến trúc scanner + alert flow: [docs/architecture/v0.1.md](../docs/architecture/v0.1.md).
- Prototype + test localhost: [README.md](README.md), issue #10.
- Quét EC2 thật sau issue #12.
