"""PBL4-517: Interactive Telegram Bot Listener (Issue #10).

Cho phép tương tác hai chiều (ChatOps) trực tiếp từ nhóm Telegram:
- Tự động đồng bộ danh sách lệnh (setMyCommands) và nút Menu với Telegram API.
- Tự động gợi ý danh sách lệnh (Autocomplete Menu) khi người dùng gõ ký tự '/'.
- Nhận lệnh từ tin nhắn (/scan, /status, /help, /ping) hoặc nút bấm Inline (Callback Queries).
- Tự động kích hoạt module scanner/scan.py và phản hồi tức thì về nhóm chat.
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


def register_bot_commands(bot_token: str, chat_id: str | None = None) -> None:
    """Tự động đăng ký danh sách lệnh và nút Menu với Telegram API để hiển thị Menu và gợi ý khi gõ '/'."""
    commands = [
        {"command": "scan", "description": "Dò quét an ninh mục tiêu (VD: /scan 127.0.0.1)"},
        {"command": "status", "description": "Xem trạng thái Baseline & các cổng đang mở"},
        {"command": "ping", "description": "Kiểm tra kết nối và độ trễ của Bot"},
        {"command": "help", "description": "Xem danh sách lệnh và menu tương tác"},
    ]

    scopes = [
        {"type": "default"},
        {"type": "all_group_chats"},
    ]
    if chat_id:
        scopes.append({"type": "chat", "chat_id": chat_id})

    for scope in scopes:
        try:
            payload = {"commands": commands, "scope": scope}
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{bot_token}/setMyCommands",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json; charset=utf-8"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                pass
        except Exception as exc:
            print(f"[-] Không thể đăng ký lệnh với scope {scope}: {exc}", file=sys.stderr)

    # Đăng ký nút Menu mở danh sách lệnh
    try:
        req_menu = urllib.request.Request(
            f"https://api.telegram.org/bot{bot_token}/setChatMenuButton",
            data=json.dumps({"menu_button": {"type": "commands"}}).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req_menu, timeout=10) as resp:
            pass
    except Exception as exc:
        print(f"[-] Không thể thiết lập ChatMenuButton: {exc}", file=sys.stderr)


def answer_callback_query(bot_token: str, query_id: str, text: str = "") -> None:
    """Phản hồi Telegram callback query để tắt biểu tượng đang tải trên client."""
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery",
            data=json.dumps({"callback_query_id": query_id, "text": text}).encode("utf-8"),
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            pass
    except Exception:
        pass


def handle_command(bot_token: str, chat_id: str, command_text: str) -> None:
    """Xử lý các câu lệnh nhận được từ người dùng trên Telegram."""
    parts = command_text.strip().split()
    cmd = parts[0].lower().split("@")[0]  # Bỏ @bot_username nếu có
    args = parts[1:]

    interactive_buttons = [
        [
            {"text": "🔍 Quét Mặc Định", "callback_data": "scan_default"},
            {"text": "🎯 Quét Web (80,443,8080)", "callback_data": "scan_web"},
        ],
        [
            {"text": "🗄️ Quét DB (5432,3306,6379)", "callback_data": "scan_db"},
            {"text": "📊 Xem Baseline", "callback_data": "status"},
        ],
        [
            {"text": "🏓 Ping Bot", "callback_data": "ping"},
            {"text": "🛡️ Chuẩn OWASP A05", "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/"},
        ],
    ]

    if cmd in ("/start", "/help"):
        help_msg = (
            "🤖 *[PBL4-517 SECURITY SCANNER BOT]* 🤖\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "Danh sách các lệnh điều khiển từ xa:\n\n"
            "🔍 `/scan [host] [ports]` — Quét an ninh mạng:\n"
            "   • `/scan` : Quét các cổng mặc định trên `127.0.0.1`\n"
            "   • `/scan 8080` : Quét cổng cụ thể `8080`\n"
            "   • `/scan 80,443,8080` : Quét nhóm cổng Web\n"
            "   • `/scan 127.0.0.1 5432` : Quét cổng DB trên máy chủ chỉ định\n"
            "📊 `/status` — Xem trạng thái Baseline và các cổng đang mở\n"
            "🏓 `/ping` — Kiểm tra trạng thái hoạt động của Bot\n"
            "❓ `/help` — Hiển thị menu hướng dẫn này\n"
            "━━━━━━━━━━━━━━━━━━━━\n"
            "💡 *Mẹo:* Bạn có thể bấm trực tiếp các nút chọn nhanh bên dưới hoặc gõ `/` để chọn lệnh từ menu gợi ý!"
        )
        send_telegram_alert(bot_token, chat_id, help_msg, buttons=interactive_buttons)

    elif cmd == "/ping":
        send_telegram_alert(
            bot_token,
            chat_id,
            "🏓 *Pong!* Bot giám sát an ninh PBL4-517 đang hoạt động bình thường.",
            buttons=interactive_buttons,
        )

    elif cmd == "/status":
        state_file = ROOT_DIR / "scanner" / "scanner_state.json"
        if not state_file.is_file():
            send_telegram_alert(
                bot_token,
                chat_id,
                "ℹ️ *Chưa có dữ liệu Baseline.* Vui lòng chạy lệnh `/scan` để khởi tạo.",
                buttons=interactive_buttons,
            )
            return

        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state_data = json.load(f)
            if not state_data:
                send_telegram_alert(bot_token, chat_id, "ℹ️ File trạng thái rỗng.", buttons=interactive_buttons)
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

            send_telegram_alert(bot_token, chat_id, "\n".join(msg_lines), buttons=interactive_buttons)
        except Exception as exc:
            send_telegram_alert(bot_token, chat_id, f"[-] Lỗi đọc trạng thái: `{exc}`")

    elif cmd == "/scan":
        target = "127.0.0.1"
        ports_arg = None

        if len(args) == 1:
            first = args[0].strip()
            # Nếu người dùng truyền số hoặc chuỗi port (VD: 8080 hoặc 80,443)
            if all(c.isdigit() or c in ",-" for c in first):
                ports_arg = first
                target = "127.0.0.1"
            else:
                target = first
        elif len(args) >= 2:
            target = args[0].strip()
            ports_arg = args[1].strip()

        ports_desc = f" (Cổng: `{ports_arg}`)" if ports_arg else " (Mặc định 6 cổng)"
        ack_msg = f"⏳ *Đang tiến hành dò quét an ninh cho mục tiêu:* `{target}`{ports_desc}...\n*Vui lòng đợi vài giây!*"
        send_telegram_alert(bot_token, chat_id, ack_msg)

        # Chạy scanner/scan.py dưới dạng subprocess
        cmd_run = [sys.executable, str(ROOT_DIR / "scanner" / "scan.py"), target]
        if ports_arg:
            cmd_run.extend(["--ports", ports_arg])

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
            print(f"[+] Hoàn tất lệnh /scan {target} {ports_arg or ''} (Exit code: {proc.returncode})")

            if proc.returncode == 0:
                duration_str = "1.0s"
                posture_str = "An toàn"
                open_ports_str = "Không có cổng nào mở"

                for line in proc.stdout.splitlines():
                    if "Thời gian quét" in line:
                        parts_dur = line.split("|")
                        duration_str = parts_dur[0].replace("Thời gian quét :", "").strip()
                        if len(parts_dur) > 1:
                            raw_open = parts_dur[1].replace("Cổng đang mở", "").strip(" :()")
                            if raw_open and raw_open != "0":
                                open_ports_str = raw_open
                    elif "Đánh giá rủi ro" in line:
                        posture_str = line.replace("Đánh giá rủi ro :", "").strip()

                is_no_change = "EVENT: NO_CHANGE" in proc.stdout
                is_initial = "EVENT: INITIAL_SCAN" in proc.stdout

                summary_lines = [
                    "✅ *[HOÀN TẤT DÒ QUÉT AN NINH]*",
                    "━━━━━━━━━━━━━━━━━━━━",
                    f"🎯 *Mục tiêu:* `{target}`" + (f" (Cổng: `{ports_arg}`)" if ports_arg else ""),
                    f"⏱️ *Thời gian:* `{duration_str}`",
                    f"🛡️ *Đánh giá rủi ro:* `{posture_str}`",
                    f"🔓 *Cổng đang mở:* `{open_ports_str}`",
                    "━━━━━━━━━━━━━━━━━━━━",
                ]

                if is_no_change:
                    summary_lines.append("ℹ️ *Trạng thái:* An toàn, không có cổng mới mở so với Baseline.")
                elif is_initial:
                    summary_lines.append("ℹ️ *Trạng thái:* Đã khởi tạo mốc Baseline ban đầu thành công.")
                else:
                    summary_lines.append("⚠️ *Trạng thái:* Đã phát hiện thay đổi cổng và gửi thông báo chi tiết!")

                send_telegram_alert(
                    bot_token,
                    chat_id,
                    "\n".join(summary_lines),
                    buttons=interactive_buttons,
                )
            else:
                err_text = proc.stderr.strip() or proc.stdout.strip() or f"Mã lỗi: {proc.returncode}"
                send_telegram_alert(
                    bot_token,
                    chat_id,
                    f"❌ *Lỗi khi quét mục tiêu:* `{err_text}`",
                    buttons=interactive_buttons,
                )
        except Exception as exc:
            send_telegram_alert(
                bot_token,
                chat_id,
                f"[-] Lỗi khi thực thi scanner: `{exc}`",
                buttons=interactive_buttons,
            )


def handle_callback_query(bot_token: str, callback: dict) -> None:
    """Xử lý tương tác khi người dùng bấm vào các nút Inline Keyboard."""
    query_id = callback.get("id", "")
    data = callback.get("data", "")
    message = callback.get("message", {})
    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))

    if not chat_id:
        return

    answer_callback_query(bot_token, query_id, f"Đang thực hiện: {data}")

    if data in ("scan_local", "scan_default"):
        handle_command(bot_token, chat_id, "/scan 127.0.0.1")
    elif data == "scan_web":
        handle_command(bot_token, chat_id, "/scan 127.0.0.1 80,443,3000,8080")
    elif data == "scan_db":
        handle_command(bot_token, chat_id, "/scan 127.0.0.1 5432,3306,6379")
    elif data == "status":
        handle_command(bot_token, chat_id, "/status")
    elif data == "ping":
        handle_command(bot_token, chat_id, "/ping")
    elif data == "help":
        handle_command(bot_token, chat_id, "/help")


def run_listener() -> None:
    """Vòng lặp lắng nghe lệnh từ Telegram (Long Polling)."""
    _, tele_token, tele_chat_id = get_credentials()

    if not tele_token:
        print("[-] Lỗi: Không tìm thấy TELEGRAM_BOT_TOKEN trong file .env!", file=sys.stderr)
        return

    print("[*] Đang đồng bộ danh sách lệnh và nút Menu với Telegram API...")
    register_bot_commands(tele_token, tele_chat_id)
    print("[+] Đã đăng ký lệnh gợi ý (Autocomplete Menu) thành công!")

    # Gửi tin nhắn thông báo sẵn sàng vào nhóm
    if tele_chat_id:
        ready_buttons = [
            [
                {"text": "🔍 Quét Cổng 127.0.0.1", "callback_data": "scan_local"},
                {"text": "📊 Xem Baseline", "callback_data": "status"},
            ],
            [
                {"text": "🏓 Ping Bot", "callback_data": "ping"},
                {"text": "🛡️ Chuẩn OWASP A05", "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/"},
            ],
        ]
        send_telegram_alert(
            tele_token,
            tele_chat_id,
            "🤖 *[PBL4 CHATOPS BOT ĐÃ SẴN SÀNG]* 🤖\n\n"
            "Hệ thống điều khiển từ xa đã kết nối. Quản trị viên có thể:\n"
            "• Gõ `/` để xem menu danh sách lệnh tự động gợi ý.\n"
            "• Bấm trực tiếp các nút chọn nhanh bên dưới để thao tác tức thì!",
            buttons=ready_buttons,
        )

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

                # 1. Xử lý Callback Query (khi bấm nút inline)
                callback = update.get("callback_query")
                if callback:
                    print(f"[+] Nhận nút bấm tương tác: '{callback.get('data')}'")
                    handle_callback_query(tele_token, callback)
                    continue

                # 2. Xử lý tin nhắn văn bản thường (/scan, /status, v.v.)
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

