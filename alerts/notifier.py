#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PBL4-517: Dual-Channel Alert Notifier (Issue #10)

Module gửi cảnh báo an ninh hạ tầng song song tới cả Discord Webhook và Telegram Bot.
Chỉ sử dụng thư viện chuẩn Python (urllib.request, json, os), không cần cài thêm package.
"""

from __future__ import annotations

import datetime
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ánh xạ tên dịch vụ thông dụng phục vụ cảnh báo trực quan
KNOWN_SERVICES: dict[int, str] = {
    21: "FTP (File Transfer)",
    22: "SSH (Quản trị từ xa)",
    23: "Telnet (Không mã hóa)",
    25: "SMTP (Mail Server)",
    53: "DNS (Domain Name System)",
    80: "HTTP (Nginx Web Server)",
    110: "POP3 (Mail)",
    143: "IMAP (Mail)",
    443: "HTTPS (Web bảo mật TLS)",
    3000: "Node.js Express API (Backend thô)",
    3306: "MySQL Database",
    5432: "PostgreSQL Database",
    6379: "Redis In-Memory Cache",
    8000: "Dev Web Server (FastAPI/Django)",
    8080: "HTTP Alt / Proxy",
    8443: "HTTPS Alt",
    27017: "MongoDB Database",
}


def load_env() -> dict[str, str]:
    """Tự động đọc các biến cấu hình từ file .env ở thư mục gốc (không cần python-dotenv)."""
    env_vars: dict[str, str] = {}
    current = Path(__file__).resolve().parent
    root = current.parent
    candidates = [root / ".env", current / ".env", Path(".env")]

    for env_path in candidates:
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#") or "=" not in line:
                            continue
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip().strip("'\"")
                        env_vars[key] = val
                break
            except Exception:
                pass
    return env_vars


def get_credentials() -> tuple[str | None, str | None, str | None]:
    """Lấy thông tin cấu hình từ os.environ hoặc file .env."""
    env = load_env()
    discord_url = os.environ.get("DISCORD_WEBHOOK_URL") or env.get("DISCORD_WEBHOOK_URL")
    tele_token = os.environ.get("TELEGRAM_BOT_TOKEN") or env.get("TELEGRAM_BOT_TOKEN")
    tele_chat_id = os.environ.get("TELEGRAM_CHAT_ID") or env.get("TELEGRAM_CHAT_ID")
    return discord_url, tele_token, tele_chat_id


def format_port_label(port: int, banner: str | None = None) -> str:
    """Trả về mô tả port kèm tên dịch vụ, banner phiên bản và mức độ rủi ro."""
    service = KNOWN_SERVICES.get(port, "Dịch vụ mạng khác")
    badge = ""
    try:
        from scanner.risk_matrix import assess_port
        profile = assess_port(port, banner)
        if profile.severity == "CRITICAL":
            badge = " [🔴 CRITICAL]"
        elif profile.severity == "HIGH":
            badge = " [🟠 HIGH]"
        elif profile.severity == "MEDIUM":
            badge = " [🟡 MEDIUM]"
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
        "footer": {"text": "PBL4-517 Security Monitoring • External Scanner"},
        "timestamp": now_iso,
    }
    payload: dict = {
        "username": "PBL4 Security Monitor",
        "avatar_url": "https://cdn-icons-png.flaticon.com/512/1067/1067555.png",
        "embeds": [embed],
    }

    # Đính kèm Action Row Buttons trên Discord (Link Buttons)
    payload["components"] = [
        {
            "type": 1,
            "components": [
                {
                    "type": 2,
                    "style": 5,
                    "label": "📖 Hướng Dẫn AWS SG",
                    "url": "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html",
                },
                {
                    "type": 2,
                    "style": 5,
                    "label": "🛡️ Tiêu Chuẩn OWASP A05",
                    "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
                },
            ],
        }
    ]

    try:
        req = urllib.request.Request(
            webhook_url,
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


def notify_scan_event(
    event_type: str,
    target_host: str,
    open_ports: list[int],
    new_ports: list[int] | None = None,
    closed_ports: list[int] | None = None,
    scan_duration: float | None = None,
    banners: dict[int, str | None] | None = None,
) -> dict[str, bool]:
    """Hàm điều phối gửi cảnh báo song song tới cả Discord và Telegram."""
    discord_url, tele_token, tele_chat_id = get_credentials()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    duration_str = f"{scan_duration:.2f}s" if scan_duration is not None else "N/A"
    b_map = banners or {}
    open_list_str = ", ".join(format_port_label(p, b_map.get(p)) for p in open_ports) if open_ports else "Không có port nào mở"

    # 1. Chuẩn bị nội dung theo sự kiện
    if event_type == "INITIAL_SCAN":
        title_discord = "📢 [PBL4 SCANNER] Khởi tạo Baseline thành công"
        color_discord = 0x3498DB  # Xanh dương
        desc_discord = f"Hệ thống đã hoàn tất lần quét đầu tiên cho mục tiêu **`{target_host}`** và thiết lập mốc so sánh (Baseline)."
        fields_discord = [
            {"name": "🎯 Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "⏱️ Thời gian quét", "value": duration_str, "inline": True},
            {"name": "🕒 Thời điểm", "value": now_str, "inline": True},
            {"name": "🔓 Các cổng đang mở (Baseline)", "value": open_list_str, "inline": False},
        ]

        text_telegram = (
            f"📢 *[PBL4 SCANNER - KHỞI TẠO BASELINE]*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯 *Mục tiêu:* `{target_host}`\n"
            f"🕒 *Thời gian:* `{now_str}` (quét trong {duration_str})\n"
            f"🔓 *Các cổng đang mở:* \n"
            + "\n".join(f"  • {format_port_label(p, b_map.get(p))}" for p in open_ports)
            + f"\n━━━━━━━━━━━━━━━━━━━━\n"
            f"✅ *Đã lưu làm mốc Baseline đối chiếu cho các lần sau.*"
        )

    elif event_type == "NEW_PORT_DETECTED":
        new_list_str = ", ".join(format_port_label(p, b_map.get(p)) for p in (new_ports or []))
        title_discord = "🚨 [CẢNH BÁO AN NINH] Phát hiện cổng mới mở ngoài ý muốn!"
        color_discord = 0xE74C3C  # Đỏ khẩn cấp
        desc_discord = f"⚠️ **CẢNH BÁO:** Phát hiện cổng mới vừa được mở trên máy chủ **`{target_host}`**! Nguy cơ phát sinh điểm yếu cấu hình (**OWASP Top 10 - A05: Security Misconfiguration**)."
        fields_discord = [
            {"name": "🎯 Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "⚠️ Cổng MỚI mở thêm", "value": f"🔥 **{new_list_str}**", "inline": False},
            {"name": "🔓 Toàn bộ cổng đang mở", "value": open_list_str, "inline": False},
            {"name": "🕒 Thời điểm phát hiện", "value": now_str, "inline": True},
            {"name": "💡 Khuyến nghị", "value": "Kiểm tra ngay AWS Security Group Inbound Rules và đóng các cổng nhạy cảm!", "inline": False},
        ]

        text_telegram = (
            f"🚨 *[CẢNH BÁO AN NINH HẠ TẦNG]* 🚨\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"⚠️ *PHÁT HIỆN CỔNG MỚI MỞ THÊM!*\n"
            f"🎯 *Mục tiêu:* `{target_host}`\n"
            f"🕒 *Thời điểm:* `{now_str}`\n\n"
            f"🔥 *Cổng mới vừa xuất hiện:*\n"
            + "\n".join(f"  ➜ ⚠️ {format_port_label(p, b_map.get(p))}" for p in (new_ports or []))
            + f"\n\n🔓 *Tổng số cổng đang mở:* {', '.join(str(p) for p in open_ports)}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🛑 *Hành động ngay:* Kiểm tra lại AWS Security Group hoặc tiến trình vừa bật trên host!"
        )

    elif event_type == "PORT_CLOSED":
        closed_list_str = ", ".join(format_port_label(p) for p in (closed_ports or []))
        title_discord = "🛡️ [AN TOÀN TRỞ LẠI] Cổng nhạy cảm đã được đóng"
        color_discord = 0x2ECC71  # Xanh lá an toàn
        desc_discord = f"Hệ thống ghi nhận cổng bất thường trên **`{target_host}`** đã được đóng lại/chặn thành công."
        fields_discord = [
            {"name": "🎯 Mục tiêu", "value": f"`{target_host}`", "inline": True},
            {"name": "🔒 Cổng vừa được đóng", "value": closed_list_str, "inline": False},
            {"name": "🔓 Các cổng còn lại", "value": open_list_str, "inline": False},
            {"name": "🕒 Thời điểm", "value": now_str, "inline": True},
        ]

        text_telegram = (
            f"🛡️ *[THÔNG BÁO - ĐÃ BỊT ĐIỂM YẾU]*\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯 *Mục tiêu:* `{target_host}`\n"
            f"🕒 *Thời gian:* `{now_str}`\n"
            f"🔒 *Cổng đã được đóng lại:* {closed_list_str}\n"
            f"🔓 *Cổng còn mở an toàn:* {open_list_str}\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"✅ *Hạ tầng mạng đã trở về trạng thái an toàn.*"
        )
    else:
        return {"discord": False, "telegram": False}

    # 2. Gửi đồng thời tới cả 2 kênh
    results = {"discord": False, "telegram": False}

    if discord_url:
        results["discord"] = send_discord_alert(
            webhook_url=discord_url,
            title=title_discord,
            description=desc_discord,
            color=color_discord,
            fields=fields_discord,
        )

    tele_buttons = [
        [
            {
                "text": "📖 Hướng Dẫn Fix AWS Security Group",
                "url": "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/authorizing-access-to-an-instance.html",
            }
        ],
        [
            {
                "text": "🛡️ Tiêu Chuẩn Lỗ Hổng OWASP A05",
                "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
            }
        ],
    ]

    if tele_token and tele_chat_id:
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
