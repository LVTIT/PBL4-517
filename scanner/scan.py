"""PBL4-517 scanner prototype — Issue #10 (SCAN-02).

TCP connect scanner tối thiểu: nhận IP/hostname đầu vào, quét danh sách
port với timeout, in port đang mở. Chỉ dùng thư viện chuẩn Python, không
cần cài thêm gì — chạy được trên mọi máy dev lẫn EC2.

Phạm vi cho phép: CHỈ quét localhost hoặc host nhóm sở hữu / được cho phép.
Không quét host lạ khi chưa có sự đồng ý bằng văn bản.
"""

from __future__ import annotations

import argparse
import socket
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

DEFAULT_PORTS = (22, 80, 443, 3000, 5432, 8080)


def parse_ports(value: str) -> list[int]:
    """Parse '22,80,3000' hoặc '20-25' thành danh sách port đã sort/khử trùng."""
    ports: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_raw, end_raw = part.split("-", 1)
            start, end = int(start_raw), int(end_raw)
            if not 1 <= start <= end <= 65535:
                raise ValueError(f"Invalid port range: {part!r}")
            ports.update(range(start, end + 1))
        else:
            port = int(part)
            if not 1 <= port <= 65535:
                raise ValueError(f"Invalid port: {part!r}")
            ports.add(port)
    if not ports:
        raise ValueError("Empty port list.")
    return sorted(ports)


def scan_port(host: str, port: int, timeout: float) -> str:
    """Trả về 'open', 'closed' hoặc 'filtered' cho một port TCP."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return "open"
    except socket.timeout:
        return "filtered"
    except ConnectionRefusedError:
        return "closed"
    except OSError:
        # Host không resolve được, network unreachable, ...
        return "filtered"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Scanner prototype PBL4-517: kiểm tra port TCP của một host."
    )
    parser.add_argument("host", help="IP hoặc hostname cần quét (VD: 127.0.0.1)")
    parser.add_argument(
        "--ports",
        default=",".join(str(p) for p in DEFAULT_PORTS),
        help="Danh sách port: '22,80,3000' hoặc khoảng '20-25'. "
        f"Mặc định: {','.join(str(p) for p in DEFAULT_PORTS)}",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=1.0,
        help="Timeout giây cho mỗi port (mặc định: 1.0).",
    )
    args = parser.parse_args(argv)

    if args.timeout <= 0:
        print("Error: --timeout must be > 0.", file=sys.stderr)
        return 2
    try:
        ports = parse_ports(args.ports)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2

    try:
        resolved = socket.gethostbyname(args.host)
    except socket.gaierror:
        print(f"Error: cannot resolve host {args.host!r}.", file=sys.stderr)
        return 2

    print(f"Scan {args.host} ({resolved}): {len(ports)} ports, timeout={args.timeout}s")
    print("-" * 46)
    open_ports: list[int] = []
    for port in ports:
        status = scan_port(resolved, port, args.timeout)
        mark = "OPEN" if status == "open" else status.upper()
        print(f"  {port:>5}/tcp  {mark}")
        if status == "open":
            open_ports.append(port)
    print("-" * 46)
    if open_ports:
        print("Open ports: " + ", ".join(str(p) for p in open_ports))
    else:
        print("No open ports found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
