# Security Group verification — Issue #12

Ngày xác minh: **2026-09-21**. Nguồn: xác nhận của người dùng trong cuộc hội thoại này, đối chiếu metadata EC2 và kiểm tra mạng thực tế của agent. Đây là bản ghi xác nhận, **không phải screenshot hay output AWS API**.

Agent yêu cầu người dùng chép toàn bộ inbound rules của mọi Security Group đang gắn với instance và nêu rõ bộ ba rule dưới đây. Người dùng trả lời nguyên văn: **"đúng như vậy"**.

| Type | Protocol / port | Source được người dùng xác nhận |
| --- | --- | --- |
| SSH | TCP 22 | `171.225.185.22/32` |
| HTTP | TCP 80 | `0.0.0.0/0` |
| HTTPS | TCP 443 | `0.0.0.0/0` |

Theo xác nhận trên, chỉ có ba rule này; không có rule cho TCP 3000, 5432, 8080 hay rule mở toàn bộ port. Rule 443 được giữ theo yêu cầu người dùng; TLS chưa cấu hình và không có listener 443.

Trước đó SSH timeout khi IP máy người dùng là `171.225.185.22` nhưng rule 22 còn dùng `117.3.54.230/32`. Sau hướng dẫn sửa source, người dùng SSH thành công và xác nhận bộ rule hiện tại như trên. Agent cũng SSH trực tiếp thành công từ workspace Windows. Không mở SSH cho `0.0.0.0/0`.

Đối chiếu độc lập:

- [Metadata EC2](08-instance-network-metadata.txt): SG gắn với instance là `launch-wizard-1`, Region `ap-southeast-1`, instance `t3.micro`, public IPv4 `47.129.214.70`; metadata `ipv6` không tồn tại (HTTP 404).
- [Mạng Linux](00-environment.txt): interface chỉ có IPv4 và IPv6 link-local, không có địa chỉ IPv6 global.
- [Listeners](07-listening-ports.txt): SSH 22, Nginx 80; PostgreSQL chỉ `127.0.0.1:5432`. UFW inactive; không dùng UFW làm bằng chứng chặn Internet.
- [Scanner từ Windows](09-external-scanner.txt): 22/80 OPEN, 3000/5432/8080 FILTERED.
- [HTTP từ Windows](10-external-http.txt): HTTP 200 OK.

**Kết quả: PASS theo xác nhận cấu hình của người dùng và các kiểm tra nêu trên.** Agent không có AWS CLI/credential để đọc rule qua API và không thao tác AWS Console. Metadata không trả inbound rules; `ss` không chứng minh policy SG; FILTERED chỉ là phân loại timeout của scanner, không tự chứng minh nguyên nhân chặn. Không có kiểm thử từ một IP nguồn ngoài allowlist SSH.
