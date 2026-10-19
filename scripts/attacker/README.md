# Attacker Scripts — PBL4-517

Thư mục chứa các kịch bản (scripts) tự động phục vụ việc thực nghiệm tấn công theo chuẩn **OWASP Top 10** từ máy tấn công (Attacker Machine / Ubuntu VM / WSL / Local).

## Danh sách kịch bản

| File | Lỗ hổng OWASP | Mô tả kịch bản |
| :--- | :--- | :--- |
| `exploit_idor.py` | **A01:2021 – Broken Access Control (Read IDOR)** | Đăng nhập phiên Kẻ tấn công (`hacker@example.com`), gửi request `GET /api/orders/<id>` để đọc trộm đơn hàng của Nạn nhân (`demo@example.com`). |
| `exploit_idor_update.py` | **A01:2021 – Broken Access Control (Write IDOR - Sửa địa chỉ)** | Đăng nhập phiên Kẻ tấn công, gửi request `PATCH /api/orders/<id>` để đổi địa chỉ nhận hàng của đơn hàng nạn nhân về địa chỉ của hacker. |
| `exploit_idor_cancel.py` | **A01:2021 – Broken Access Control (Write IDOR - Hủy đơn)** | Đăng nhập phiên Kẻ tấn công, gửi request `POST /api/orders/<id>/cancel` để phá hoại, hủy đơn hàng đang chờ xử lý của nạn nhân. |

---

## Hướng dẫn sử dụng: Kịch bản A01 IDOR (`exploit_idor.py`)

### 1. Yêu cầu môi trường
- Python 3.x
- Thư viện `requests`:
  ```bash
  pip install requests
  # hoặc trên Ubuntu Linux:
  sudo apt install -y python3-requests
  ```

### 2. Cách chạy script
Mặc định script trỏ tới `http://127.0.0.1:3000` và mã đơn hàng của nạn nhân demo:
```bash
python exploit_idor.py
```

Tuỳ chỉnh mục tiêu (ví dụ khi deploy lên AWS EC2 hoặc IP LAN):
```bash
python exploit_idor.py --url http://<IP_MAY_CHU>:3000 --id <MA_DON_HANG>
```

### 3. Điều khiển trạng thái Bị lỗi $\leftrightarrow$ Đã bịt lỗi
Trong file `website/backend/.env`:
- **Chế độ Lỗ hổng (Vulnerable - phục vụ demo khai thác):**
  ```dotenv
  VULN_IDOR_ENABLED=true
  ```
  $\rightarrow$ Script chạy sẽ in ra: `[+] VULNERABLE: IDOR confirmed` kèm toàn bộ dữ liệu đơn hàng nạn nhân.
- **Chế độ An toàn (Secure Baseline - đã vá lỗi):**
  ```dotenv
  VULN_IDOR_ENABLED=false
  ```
  $\rightarrow$ Script chạy sẽ in ra: `[-] SECURE: Access control enforced (403 Forbidden)`.
