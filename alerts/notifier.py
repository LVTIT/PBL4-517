#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PBL4-517: Dual-Channel Alert Notifier (Issue #10)

Module gửi cảnh báo an ninh hạ tầng song song tới cả Discord Webhook và Telegram Bot.
Chỉ sử dụng thư viện chuẩn Python (urllib.request, json, os), không cần cài thêm package.
"""

from __future__ import annotations

import datetime
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ánh xạ tên dịch vụ thông dụng phục vụ cảnh báo trực quan
KNOWN_SERVICES: dict[int, str] = {
    21: "FTP — truyền tệp",
    22: "SSH — quản trị từ xa",
    23: "Telnet — không mã hóa",
    25: "SMTP — mail server",
    53: "DNS — phân giải tên miền",
    80: "HTTP — Nginx",
    110: "POP3 — mail",
    143: "IMAP — mail",
    443: "HTTPS — TLS",
    3000: "Node.js Express API — backend thô",
    3306: "MySQL",
    5432: "PostgreSQL",
    6379: "Redis — in-memory cache",
    8000: "Dev web server — FastAPI/Django",
    8080: "HTTP thay thế / proxy",
    8443: "HTTPS thay thế",
    27017: "MongoDB",
}


ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
from scanner.config import load_env


def get_credentials() -> tuple[str | None, str | None, str | None]:
    """Lấy thông tin cấu hình từ os.environ hoặc file .env."""
    env = load_env()
    discord_url = os.environ.get("DISCORD_WEBHOOK_URL", env.get("DISCORD_WEBHOOK_URL"))
    tele_token = os.environ.get("TELEGRAM_BOT_TOKEN", env.get("TELEGRAM_BOT_TOKEN"))
    tele_chat_id = os.environ.get("TELEGRAM_CHAT_ID", env.get("TELEGRAM_CHAT_ID"))
    return discord_url, tele_token, tele_chat_id


def format_port_label(port: int, banner: str | None = None) -> str:
    """Trả về mô tả port kèm tên dịch vụ, banner phiên bản và mức độ rủi ro."""
    service = KNOWN_SERVICES.get(port, "Dịch vụ mạng khác")
    badge = ""
    try:
        from scanner.risk_matrix import assess_port
        profile = assess_port(port, banner)
        if profile.severity == "CRITICAL":
            badge = " [CRITICAL]"
        elif profile.severity == "HIGH":
            badge = " [HIGH]"
        elif profile.severity == "MEDIUM":
            badge = " [MEDIUM]"
    except Exception:
        pass

    banner_str = f" » `{banner}`" if banner else ""
    return f"`{port}/tcp` ({service}){badge}{banner_str}"


def send_discord_alert(
    webhook_url: str,
    title: str,
    description: str,
    color: int,
    fields: list[dict[str, str | bool]] | None = None,
) -> bool:
    """Gửi cảnh báo Rich Embed tới Discord Webhook."""
    if not webhook_url:
        return False

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    embed = {
        "title": title,
        "description": description,
        "color": color,
        "fields": fields or [],
        "footer": {"text": "PBL4-517 · Quét cổng TCP, không phải kiểm thử toàn diện"},
        "timestamp": now_iso,
    }
    payload: dict = {
        "username": "PBL4 Security Monitor",
        "embeds": [embed],
        "allowed_mentions": {"parse": []},
    }

    # Đính kèm Action Row Buttons trên Discord (Link Buttons)
    payload["components"] = [
        {
            "type": 1,
            "components": [
                {
                    "type": 2,
                    "style": 5,
                    "label": "AWS Security Group",
                    "url": "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html",
                },
                {
                    "type": 2,
                    "style": 5,
                    "label": "OWASP A05",
                    "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
                },
            ],
        }
    ]

    try:
        # Incoming webhooks otherwise silently discard link buttons. Preserve
        # thread_id and other caller query parameters; wait for server acceptance.
        parts = urllib.parse.urlsplit(webhook_url)
        query = urllib.parse.parse_qs(parts.query, keep_blank_values=True)
        query.update({"with_components": ["true"], "wait": ["true"]})
        execute_url = urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query, doseq=True)))
        req = urllib.request.Request(
            execute_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "PBL4-517-Scanner/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 204)
    except Exception as exc:
        print(f"[-] Discord Webhook error: {exc}", file=sys.stderr)
        return False


def send_telegram_alert(
    bot_token: str,
    chat_id: str,
    markdown_text: str,
    buttons: list[list[dict[str, str]]] | None = None,
) -> bool:
    """Gửi tin nhắn định dạng Markdown kèm Inline Keyboard Buttons tới Telegram Group Chat."""
    if not bot_token or not chat_id:
        return False

    api_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload: dict = {
        "chat_id": chat_id,
        "text": markdown_text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }

    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}

    try:
        req = urllib.request.Request(
            api_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "PBL4-517-Scanner/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return bool(data.get("ok"))
    except Exception as exc:
        print(f"[-] Telegram Bot error: {exc}", file=sys.stderr)
        return False


def send_telegram_document(
    bot_token: str,
    chat_id: str,
    document_path: str | Path,
    caption: str = "",
    buttons: list[list[dict[str, str]]] | None = None,
) -> bool:
    """Gửi file báo cáo (HTML/Markdown) tới Telegram bằng multipart/form-data.

    Chỉ dùng thư viện chuẩn; không đọc hoặc gửi file ngoài đường dẫn được truyền.
    """
    path = Path(document_path)
    if not bot_token or not chat_id or not path.is_file():
        return False
    boundary = "----PBL517" + uuid.uuid4().hex
    body = bytearray()

    def field(name: str, value: str) -> None:
        body.extend(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'
            f"{value}\r\n".encode("utf-8")
        )

    field("chat_id", str(chat_id))
    if caption:
        field("caption", caption[:1024])
        field("parse_mode", "Markdown")
    if buttons:
        field("reply_markup", json.dumps({"inline_keyboard": buttons}, ensure_ascii=False))

    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    body.extend(
        f'--{boundary}\r\nContent-Disposition: form-data; name="document"; '
        f'filename="{path.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode("utf-8")
    )
    body.extend(path.read_bytes())
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))

    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{bot_token}/sendDocument",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "PBL4-517-Scanner/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return bool(data.get("ok"))
    except Exception as exc:
        print(f"[-] Telegram document error: {exc}", file=sys.stderr)
        return False


def notify_scan_event(
    event_type: str,
    target_host: str,
    open_ports: list[int],
    new_ports: list[int] | None = None,
    closed_ports: list[int] | None = None,
    uncertain_ports: list[int] | None = None,
    scan_duration: float | None = None,
    banners: dict[int, str | None] | None = None,
    channels: list[str] | None = None,
    event_id: str | None = None,
    detected_at: str | None = None,
) -> dict[str, bool]:
    """Hàm điều phối gửi cảnh báo song song tới cả Discord và Telegram."""
    discord_url, tele_token, tele_chat_id = get_credentials()
    now_str = detected_at or datetime.datetime.now(datetime.timezone.utc).isoformat()

    duration_str = f"{scan_duration:.2f}s" if scan_duration is not None else "N/A"
    b_map = banners or {}
    open_list_str = ", ".join(format_port_label(p, b_map.get(p)) for p in open_ports) if open_ports else "Không quan sát thấy cổng mở"
    uncertain = list(uncertain_ports or [])
    uncertain_list_str = ", ".join(f"`{p}/tcp`" for p in uncertain) if uncertain else "Không có"
    try:
        from scanner.risk_matrix import calculate_system_posture
        posture = calculate_system_posture(open_ports)
        posture_line = f"{posture['grade']} · {posture['status'].capitalize()}"
    except Exception:
        posture_line = "Chưa có dữ liệu đánh giá"

    # 1. Chuẩn bị nội dung theo sự kiện
    if event_type == "INITIAL_SCAN":
        title_discord = f"Đã lưu baseline · {target_host}"
        color_discord = 0x3498DB
        desc_discord = (
            f"Lần quét đầu tiên cho `{target_host}` đã xong. "
            "Kết quả này được dùng làm mốc so sánh cho các lần sau."
        )
        fields_discord = [
            {"name": "Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "Thời gian quét", "value": duration_str, "inline": True},
            {"name": "Thời điểm", "value": now_str, "inline": True},
            {"name": "Đánh giá", "value": posture_line, "inline": False},
            {"name": "Cổng đang mở", "value": open_list_str, "inline": False},
            {"name": "Cổng chưa xác định", "value": uncertain_list_str, "inline": False},
        ]

        text_telegram = (
            f"*Đã lưu baseline cho* `{target_host}`\n"
            f"Quét lúc {now_str}, mất {duration_str}.\n"
            f"Đánh giá: {posture_line}\n\n"
            f"Cổng đang mở:\n"
            + ("\n".join(f"  • {format_port_label(p, b_map.get(p))}" for p in open_ports) if open_ports else "  • Không có")
            + f"\nChưa xác định: {uncertain_list_str}\n\n"
            "Kết quả này là mốc so sánh cho các lần quét sau."
        )

    elif event_type == "NEW_PORT_DETECTED":
        new_list_str = ", ".join(format_port_label(p, b_map.get(p)) for p in (new_ports or []))
        title_discord = f"Cổng mới mở · {target_host}"
        color_discord = 0xE74C3C
        desc_discord = (
            f"`{target_host}` vừa mở thêm cổng. "
            "Kiểm tra Security Group hoặc tiến trình vừa bật trên máy chủ."
        )
        fields_discord = [
            {"name": "Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "Đánh giá", "value": posture_line, "inline": False},
            {"name": "Cổng mới mở", "value": f"**{new_list_str}**", "inline": False},
            {"name": "Cổng đang mở", "value": open_list_str, "inline": False},
            {"name": "Cổng chưa xác định", "value": uncertain_list_str, "inline": False},
            {"name": "Thời điểm", "value": now_str, "inline": True},
            {"name": "Gợi ý", "value": "Kiểm tra AWS Security Group (Inbound Rules) và đóng cổng không cần thiết.", "inline": False},
        ]

        text_telegram = (
            f"*Cổng mới mở trên* `{target_host}`\n"
            f"Lúc {now_str}. Đánh giá: {posture_line}\n\n"
            f"Cổng mới:\n"
            + ("\n".join(f"  • {format_port_label(p, b_map.get(p))}" for p in (new_ports or [])) or "  • Không xác định")
            + f"\nĐang mở: {', '.join(str(p) for p in open_ports) if open_ports else 'Không có'}\n"
            f"Chưa xác định: {uncertain_list_str}\n\n"
            "Kiểm tra Security Group hoặc tiến trình vừa bật trên máy chủ."
        )

    elif event_type == "PORT_CLOSED":
        closed_list_str = ", ".join(format_port_label(p) for p in (closed_ports or []))
        title_discord = f"Đã đóng cổng · {target_host}"
        color_discord = 0x2ECC71
        desc_discord = (
            f"Các cổng dưới đây trên `{target_host}` đã từ chối kết nối TCP. "
            "Không suy ra các dịch vụ còn lại đã an toàn."
        )
        fields_discord = [
            {"name": "Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "Đánh giá", "value": posture_line, "inline": False},
            {"name": "Cổng vừa đóng", "value": closed_list_str, "inline": False},
            {"name": "Cổng còn mở", "value": open_list_str, "inline": False},
            {"name": "Cổng chưa xác định", "value": uncertain_list_str, "inline": False},
            {"name": "Thời điểm", "value": now_str, "inline": True},
        ]

        text_telegram = (
            f"*Đã đóng cổng trên* `{target_host}`\n"
            f"Lúc {now_str}. Đánh giá: {posture_line}\n"
            f"Cổng vừa đóng: {closed_list_str}\n"
            f"Cổng còn mở: {open_list_str}\n"
            f"Chưa xác định: {uncertain_list_str}\n\n"
            "Chỉ xác nhận các cổng trên đã đóng. Không suy ra các dịch vụ còn lại đã an toàn."
        )
    elif event_type in ("SCAN_UNCERTAIN", "SCAN_RECOVERED"):
        title_text = "Kết quả quét chưa đầy đủ" if event_type == "SCAN_UNCERTAIN" else "Giám sát đã phục hồi"
        title_discord = f"{title_text} · {target_host}"
        color_discord = 0xF39C12 if event_type == "SCAN_UNCERTAIN" else 0x3498DB
        desc_discord = (
            "Có cổng timeout/filtered nên kết quả chưa đầy đủ. "
            "Không suy ra cổng đã đóng hay hệ thống đã an toàn; đối chiếu báo cáo và cấu hình mạng."
            if event_type == "SCAN_UNCERTAIN"
            else "Kết nối giám sát đã hoạt động lại. Không suy ra hệ thống đã an toàn; đối chiếu báo cáo và cấu hình mạng."
        )
        fields_discord = [
            {"name": "Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "Đánh giá", "value": posture_line, "inline": False},
            {"name": "Cổng chưa xác định", "value": uncertain_list_str, "inline": False},
            {"name": "Thời điểm", "value": now_str, "inline": True},
        ]
        text_telegram = (
            f"*{title_text}* · `{target_host}`\n"
            f"Lúc {now_str}. Đánh giá: {posture_line}\n"
            f"Chưa xác định: {uncertain_list_str}\n\n"
            f"{desc_discord}"
        )
    else:
        return {"discord": False, "telegram": False}

    if event_id:
        fields_discord.append({"name": "Mã sự kiện", "value": event_id, "inline": False})
        text_telegram += f"\nMã sự kiện: `{event_id}`"

    # 2. Gửi đồng thời tới cả 2 kênh
    results = {"discord": False, "telegram": False}

    if discord_url and (channels is None or "discord" in channels):
        results["discord"] = send_discord_alert(
            webhook_url=discord_url,
            title=title_discord,
            description=desc_discord,
            color=color_discord,
            fields=fields_discord,
        )

    tele_buttons = [
        [
            {"text": "Xem baseline", "callback_data": "status"},
            {"text": "Gửi báo cáo", "callback_data": "report"},
        ],
        [
            {"text": "Quét lại", "callback_data": "scan_default"},
            {"text": "Trợ giúp", "callback_data": "help"},
        ],
        [
            {
                "text": "AWS Security Group",
                "url": "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html",
            },
            {
                "text": "OWASP A05",
                "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
            },
        ],
    ]

    if tele_token and tele_chat_id and (channels is None or "telegram" in channels):
        results["telegram"] = send_telegram_alert(
            bot_token=tele_token,
            chat_id=tele_chat_id,
            markdown_text=text_telegram,
            buttons=tele_buttons,
        )

    return results


def main() -> int:
    """Hỗ trợ kiểm tra nhanh kết nối Webhook & Bot khi chạy trực tiếp script."""
    print("[*] Kiểm tra kết nối cấu hình Alert System (PBL4-517)...")
    discord_url, tele_token, tele_chat_id = get_credentials()

    print(f"[*] Discord Webhook : {'ĐÃ CẤU HÌNH' if discord_url else 'CHƯA CÓ'}")
    print(f"[*] Telegram Bot    : {'ĐÃ CẤU HÌNH' if tele_token and tele_chat_id else 'CHƯA CÓ'}")

    if not discord_url and not (tele_token and tele_chat_id):
        print("[-] Lỗi: Chưa tìm thấy cấu hình DISCORD_WEBHOOK_URL hoặc TELEGRAM_BOT_TOKEN trong .env!")
        return 1

    print("[*] Đang gửi tin nhắn thử nghiệm (Test Alert)...")
    res = notify_scan_event(
        event_type="INITIAL_SCAN",
        target_host="127.0.0.1 (Test Demo)",
        open_ports=[22, 80],
        scan_duration=0.5,
    )
    print(f"[+] Kết quả gửi Discord  : {'THÀNH CÔNG (200/204)' if res['discord'] else 'THẤT BẠI'}")
    print(f"[+] Kết quả gửi Telegram : {'THÀNH CÔNG (ok: true)' if res['telegram'] else 'THẤT BẠI'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
