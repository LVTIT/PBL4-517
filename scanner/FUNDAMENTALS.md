# Scanner Fundamentals — Issue #9 (SCAN-01)

Kiến thức nền của prototype Issue #9 và cách áp dụng với Nmap ở Issue #35.
Hướng dẫn chạy và xem kết quả nằm trong [README scanner](README.md).

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

`FILTERED` biểu thị rằng phép đo chưa xác định được cổng mở hay đóng. Ví dụ,
Security Group có thể loại bỏ gói tin dù dịch vụ vẫn đang lắng nghe trên EC2.
Đọc thêm [trạng thái cổng trong Nmap](https://nmap.org/book/man-port-scanning-basics.html).

## 4. Chốt công nghệ scanner

Prototype Issue #9 dùng `socket.create_connection`. Bản hiện tại dùng
[Nmap TCP Connect](https://nmap.org/book/scan-methods-connect-scan.html),
vẫn dựa vào lời gọi `connect()` của hệ điều hành. Python đọc XML và đảm nhiệm
lưu baseline, gửi thông báo cùng báo cáo. Cài đặt theo [README scanner](README.md).

## 5. Theo dõi một lượt đo từ đầu đến cuối

1. Phân giải `host` thành một địa chỉ IPv4 và chuẩn hoá danh sách cổng.
2. [`nmap_backend.py`](nmap_backend.py) lấy trạng thái TCP từ XML của Nmap.
3. [`scan.py`](scan.py) so cổng đang mở với baseline. Chỉ kết quả `closed`
   xác nhận loại cổng khỏi baseline.
4. Đối chiếu bảng kết quả, file trạng thái và mã sự kiện trong audit với tin cảnh báo.

## 6. Liên quan

- Kiến trúc scanner + alert flow: [docs/architecture/v0.1.md](../docs/architecture/v0.1.md).
- Prototype: issue #10. Quét định kỳ từ Ubuntu VM: [hướng dẫn systemd](systemd/README.md).
