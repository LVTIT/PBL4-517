"""PBL4-517: Protocol Banner Grabbing & Service Detection (Issue #10).

Thực hiện thăm dò nhẹ (Lightweight Probing) để nhận diện tên và phiên bản dịch vụ thực tế:
- SSH (port 22): Đọc banner chào mừng từ máy chủ (VD: OpenSSH/Ubuntu).
- HTTP/HTTPS (port 80, 443, 3000, 8080, 8000): Gửi HEAD request đọc Server, X-Powered-By.
- PostgreSQL (port 5432): Gửi SSLRequest probe để phát hiện Postgres engine.
- Redis (port 6379): Gửi PING kiểm tra phản hồi PONG.
- MySQL (port 3306): Đọc handshake packet chứa phiên bản MySQL/MariaDB.
Chỉ dùng socket thuần của Python, timeout cực ngắn (0.5s - 1.0s) để không làm chậm quá trình quét.
"""

from __future__ import annotations

import socket
import ssl


def grab_banner(host: str, port: int, timeout: float = 1.0) -> str | None:
    """Thăm dò và lấy banner phiên bản theo từng loại cổng mạng."""
    # 1. SSH Probe (Port 22 hoặc cổng dạng SSH)
    if port == 22:
        return _probe_ssh(host, port, timeout)

    # 2. Web HTTP Probe (Port 80, 3000, 8080, 8000, ...)
    if port in (80, 3000, 8000, 8080, 5000, 8888):
        return _probe_http(host, port, use_tls=False, timeout=timeout)

    # 3. Web HTTPS Probe (Port 443, 8443)
    if port in (443, 8443):
        return _probe_http(host, port, use_tls=True, timeout=timeout)

    # 4. PostgreSQL Probe (Port 5432)
    if port == 5432:
        return _probe_postgres(host, port, timeout)

    # 5. Redis Probe (Port 6379)
    if port == 6379:
        return _probe_redis(host, port, timeout)

    # 6. MySQL Probe (Port 3306)
    if port == 3306:
        return _probe_mysql(host, port, timeout)

    # 7. Generic Probe: Kết nối và đọc dữ liệu chờ sẵn (nếu có)
    return _probe_generic(host, port, timeout)


def _probe_ssh(host: str, port: int, timeout: float) -> str | None:
    """SSH servers gửi banner ngay sau khi kết nối TCP thành công."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            data = sock.recv(512)
            if data and data.startswith(b"SSH-"):
                banner = data.decode("utf-8", errors="replace").strip()
                # Rút gọn chuỗi banner cho đẹp mắt
                return banner
    except Exception:
        pass
    return None


def _probe_http(host: str, port: int, use_tls: bool, timeout: float) -> str | None:
    """Gửi HTTP HEAD request để lấy header Server và X-Powered-By."""
    request_data = f"HEAD / HTTP/1.1\r\nHost: {host}:{port}\r\nUser-Agent: PBL4-517-Scanner\r\nConnection: close\r\n\r\n".encode("utf-8")
    try:
        raw_sock = socket.create_connection((host, port), timeout=timeout)
        raw_sock.settimeout(timeout)

        if use_tls:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            sock = context.wrap_socket(raw_sock, server_hostname=host)
        else:
            sock = raw_sock

        with sock:
            sock.sendall(request_data)
            response = sock.recv(2048).decode("latin-1", errors="replace")

        headers = response.split("\r\n")
        server_header = ""
        powered_by = ""
        status_line = headers[0] if headers else ""

        for line in headers[1:]:
            line_lower = line.lower()
            if line_lower.startswith("server:"):
                server_header = line.split(":", 1)[1].strip()
            elif line_lower.startswith("x-powered-by:"):
                powered_by = line.split(":", 1)[1].strip()

        parts = []
        if server_header:
            parts.append(f"Server: {server_header}")
        if powered_by:
            parts.append(f"Powered-By: {powered_by}")

        if parts:
            return ", ".join(parts)
        if status_line.startswith("HTTP/"):
            return status_line.split(" ", 2)[-1] if len(status_line.split(" ", 2)) > 2 else status_line
    except Exception:
        pass
    return None


def _probe_postgres(host: str, port: int, timeout: float) -> str | None:
    """Gửi gói SSLRequest probe đặc thù của giao thức PostgreSQL."""
    # Gói SSLRequest: length=8, code=80877103 (0x04d2162f)
    ssl_probe = b"\x00\x00\x00\x08\x04\xd2\x16\x2f"
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(ssl_probe)
            response = sock.recv(1)
            # 'S' = Server hỗ trợ SSL, 'N' = Server không hỗ trợ SSL nhưng xác nhận là PostgreSQL
            if response in (b"S", b"N"):
                return f"PostgreSQL Server (SSL {'hỗ trợ' if response == b'S' else 'tắt'})"
    except Exception:
        pass
    return None


def _probe_redis(host: str, port: int, timeout: float) -> str | None:
    """Gửi lệnh PING tới Redis."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(b"PING\r\n")
            response = sock.recv(64).decode("utf-8", errors="replace")
            if "+PONG" in response:
                return "Redis Database (Không yêu cầu mật khẩu - Cực nguy hiểm!)"
            if "NOAUTH" in response:
                return "Redis Database (Yêu cầu mật khẩu AUTH)"
    except Exception:
        pass
    return None


def _probe_mysql(host: str, port: int, timeout: float) -> str | None:
    """MySQL server tự động gửi gói Initial Handshake Packet kèm phiên bản."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            data = sock.recv(256)
            if len(data) > 5 and data[4] in (10, 9):  # Protocol version 10 (MySQL 5+)
                # Trích xuất chuỗi version kết thúc bằng null byte
                null_pos = data.find(b"\x00", 5)
                if null_pos != -1:
                    version = data[5:null_pos].decode("latin-1", errors="replace")
                    return f"MySQL / MariaDB Server ({version})"
    except Exception:
        pass
    return None


def _probe_generic(host: str, port: int, timeout: float) -> str | None:
    """Đọc dữ liệu phản hồi chung nếu server gửi banner khi mở kết nối."""
    try:
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            data = sock.recv(256)
            if data:
                text = data.decode("utf-8", errors="replace").strip()
                if text:
                    # Lấy dòng đầu tiên tối đa 80 ký tự
                    first_line = text.splitlines()[0][:80]
                    return first_line
    except Exception:
        pass
    return None
