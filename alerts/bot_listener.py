"""PBL4-517: Interactive Telegram Bot Listener (Issue #10).

Cho phép tương tác hai chiều (ChatOps) trực tiếp từ nhóm Telegram:
- Nhận lệnh từ người dùng (/scan, /status, /help, /ping).
- Tự động kích hoạt module scanner/scan.py và trả kết quả về nhóm chat.
- Sử dụng phương pháp Long Polling thuần của Python standard library (không cần cài thêm thư viện ngoài).
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

# Đảm bảo UTF-8 trên Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Thêm thư mục gốc vào sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from alerts.notifier import get_credentials, send_telegram_alert


def handle_command(bot_token: str, chat_id: str, command_text: str) -> None:
    """Xử lý các câu lệnh nhận được từ người dùng trên Telegram."""
    parts = command_text.strip().split()
    cmd = parts[0].lower().split("@")[0]  # Bỏ @bot_username nếu có
    args = parts[1:]

    if cmd in ("/start", "/help"):
        help_msg = (
            "🤖 *[PBL4-517 SECURITY SCANNER BOT]* 🤖\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "Danh sách các lệnh điều khiển từ xa:\n\n"
            "🔍 `/scan [host]` — Chạy dò quét an ninh mạng cho mục tiêu (Mặc định: `127.0.0.1`)\n"
            "📊 `/status` — Kiểm tra trạng thái Baseline và các cổng đang mở gần nhất\n"
            "🏓 `/ping` — Kiểm tra trạng thái hoạt động của Bot\n"
            "❓ `/help` — Hiển thị hướng dẫn này\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "💡 *Ví dụ:* Gõ `/scan 127.0.0.1` để bắt đầu quét ngay lập tức!"
        )
        send_telegram_alert(bot_token, chat_id, help_msg)

    elif cmd == "/ping":
        send_telegram_alert(bot_token, chat_id, "🏓 *Pong!* Bot giám sát an ninh PBL4-517 đang hoạt động bình thường.")

    elif cmd == "/status":
        state_file = ROOT_DIR / "scanner" / "scanner_state.json"
        if not state_file.is_file():
            send_telegram_alert(bot_token, chat_id, "ℹ️ *Chưa có dữ liệu Baseline.* Vui lòng chạy lệnh `/scan` để khởi tạo.")
            return

        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state_data = json.load(f)
            if not state_data:
                send_telegram_alert(bot_token, chat_id, "ℹ️ File trạng thái rỗng.")
                return

            msg_lines = [
                "📊 *[BÁO CÁO TRẠNG THÁI BASELINE HIỆN TẠI]*",
                "━━━━━━━━━━━━━━━━━━━━",
            ]
            for host, info in state_data.items():
                ports = info.get("baseline_open_ports", [])
                last_time = info.get("last_scan_at", "N/A")
                ports_str = ", ".join(str(p) for p in ports) if ports else "Không có cổng nào mở"
                msg_lines.append(f"🎯 *Mục tiêu:* `{host}`")
                msg_lines.append(f"🕒 *Quét lần cuối:* `{last_time}`")
                msg_lines.append(f"🔓 *Cổng đang mở:* `{ports_str}`")
                msg_lines.append("────────────────────")

            send_telegram_alert(bot_token, chat_id, "\n".join(msg_lines))
        except Exception as exc:
            send_telegram_alert(bot_token, chat_id, f"[-] Lỗi đọc trạng thái: `{exc}`")

    elif cmd == "/scan":
        target = args[0] if args else "127.0.0.1"
        ack_msg = f"⏳ *Đang tiến hành dò quét an ninh cho mục tiêu:* `{target}`...\n*Vui lòng đợi vài giây!*"
        send_telegram_alert(bot_token, chat_id, ack_msg)

        # Chạy scanner/scan.py dưới dạng subprocess
        cmd_run = [sys.executable, str(ROOT_DIR / "scanner" / "scan.py"), target]
        try:
            proc = subprocess.run(
                cmd_run,
                cwd=str(ROOT_DIR),
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=30,
            )
            print(f"[+] Hoàn tất lệnh /scan {target} (Exit code: {proc.returncode})")
        except Exception as exc:
            send_telegram_alert(bot_token, chat_id, f"[-] Lỗi khi thực thi scanner: `{exc}`")


def run_listener() -> None:
    """Vòng lặp lắng nghe lệnh từ Telegram (Long Polling)."""
    _, tele_token, tele_chat_id = get_credentials()

    if not tele_token:
        print("[-] Lỗi: Không tìm thấy TELEGRAM_BOT_TOKEN trong file .env!", file=sys.stderr)
        return

    print("[*] Đang khởi động Telegram Bot Interactive Listener (ChatOps PBL4-517)...")
    print(f"[*] Đang lắng nghe tin nhắn trên kênh/nhóm chat... (Nhấn Ctrl + C để dừng)\n")

    offset = 0
    while True:
        try:
            api_url = f"https://api.telegram.org/bot{tele_token}/getUpdates?offset={offset}&timeout=20"
            req = urllib.request.Request(api_url, headers={"User-Agent": "PBL4-517-BotListener/1.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            if not data.get("ok"):
                time.sleep(2)
                continue

            for update in data.get("result", []):
                offset = max(offset, update["update_id"] + 1)
                msg = update.get("message") or update.get("channel_post")
                if not msg:
                    continue

                text = msg.get("text", "").strip()
                chat = msg.get("chat", {})
                chat_id = str(chat.get("id", ""))

                if text.startswith("/"):
                    print(f"[+] Nhận lệnh: '{text}' từ Chat ID: {chat_id}")
                    handle_command(tele_token, chat_id, text)

        except urllib.error.URLError:
            time.sleep(3)
        except KeyboardInterrupt:
            print("\n[*] Đã dừng Telegram Bot Listener.")
            break
        except Exception as exc:
            print(f"[-] Lỗi polling: {exc}", file=sys.stderr)
            time.sleep(3)


if __name__ == "__main__":
    run_listener()
