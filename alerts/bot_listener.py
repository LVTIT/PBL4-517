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
import ipaddress
import os
import re
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

from alerts.notifier import get_credentials, send_telegram_alert, send_telegram_document
from scanner.config import setting, state_file, reports_dir


def _setting(name: str, default: str = "") -> str:
    return setting(name, default)


def _authorized_sender(chat_id: str, user_id: str | int | None) -> bool:
    _, _, allowed_chat = get_credentials()
    allowed_users = {value.strip() for value in _setting("TELEGRAM_ALLOWED_USER_IDS").split(",")
                     if value.strip().isascii() and value.strip().isdigit()}
    return bool(allowed_chat and str(chat_id) == allowed_chat and user_id is not None
                and str(user_id) in allowed_users)


def _scan_target(target: str) -> str:
    # Only explicit IPv4 literals: no arbitrary hostnames or DNS rebinding.
    address = str(ipaddress.IPv4Address(target))
    allowed = {str(ipaddress.IPv4Address(value.strip()))
               for value in _setting("SCANNER_ALLOWED_TARGETS", "127.0.0.1").split(",") if value.strip()}
    if address not in allowed:
        raise ValueError("Target is outside SCANNER_ALLOWED_TARGETS.")
    return address


def _state_file() -> Path:
    return state_file()


def register_bot_commands(bot_token: str, chat_id: str | None = None) -> None:
    """Tự động đăng ký danh sách lệnh và nút Menu với Telegram API để hiển thị Menu và gợi ý khi gõ '/'."""
    commands = [
        {"command": "scan", "description": "Quét cổng mục tiêu (VD: /scan 127.0.0.1)"},
        {"command": "status", "description": "Xem baseline và cổng đang mở"},
        {"command": "report", "description": "Nhận báo cáo HTML/Markdown mới nhất"},
        {"command": "ping", "description": "Kiểm tra bot còn chạy"},
        {"command": "help", "description": "Xem hướng dẫn và menu"},
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


def _keyboard() -> list[list[dict[str, str]]]:
    """Bàn phím ChatOps dùng chung cho mọi phản hồi."""
    return [
        [
            {"text": "Quét lại", "callback_data": "scan_default"},
            {"text": "Quét web", "callback_data": "scan_web"},
            {"text": "Quét DB", "callback_data": "scan_db"},
        ],
        [
            {"text": "Baseline", "callback_data": "status"},
            {"text": "Báo cáo", "callback_data": "report"},
            {"text": "Ping", "callback_data": "ping"},
        ],
        [
            {"text": "Trợ giúp", "callback_data": "help"},
            {
                "text": "OWASP A05",
                "url": "https://owasp.org/Top10/A05_2021-Security_Misconfiguration/",
            },
        ],
    ]


def _help_text() -> str:
    return (
        "*PBL4-517 ChatOps*\n\n"
        "*Quét cổng*\n"
        "`/scan` — target mặc định, 6 cổng thường gặp\n"
        "`/scan 80,443` — chọn cổng trên target mặc định\n"
        "`/scan 127.0.0.1 5432` — IPv4 trong allowlist\n\n"
        "*Xem kết quả*\n"
        "`/status` — baseline, cổng mở, cổng timeout/filtered\n"
        "`/report` — nhận `latest.html` và `latest.md`\n"
        "`/ping` — kiểm tra bot\n"
        "`/help` — menu này\n\n"
        "Chỉ nhận IPv4 trong allowlist, tối đa 32 cổng mỗi lần, không nhận hostname/CIDR. "
        "`/scan` bỏ qua banner để trả lời nhanh."
    )


def _short(value: object, limit: int = 80) -> str:
    text = str(value).replace("`", "'").replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _format_status(state_data: dict) -> str:
    from alerts.notifier import format_port_label
    from scanner.risk_matrix import calculate_system_posture

    lines = ["*Baseline hiện tại*"]
    hosts = list(state_data.items())
    for index, (host, info) in enumerate(hosts[:8]):
        if index:
            lines.append("")
        ports = info.get("baseline_open_ports", [])
        uncertain = info.get("uncertain_ports", [])
        pending = info.get("pending_alerts", [])
        last_time = info.get("last_scan_at", "chưa có")
        posture = calculate_system_posture(ports)
        lines.append(f"\n*Mục tiêu:* `{_short(host)}`")
        lines.append(f"Quét lần cuối: `{_short(last_time, 40)}`")
        lines.append(f"Đánh giá: {posture['grade']} · {posture['status'].capitalize()}")
        if ports:
            lines.append("Cổng đang mở trong baseline:")
            lines.extend(f"  • {format_port_label(p)}" for p in ports)
        else:
            lines.append("Cổng đang mở trong baseline: Không có")
        if uncertain:
            lines.append(f"Timeout/filtered lần quét gần nhất: `{', '.join(str(p) for p in uncertain)}`")
        if pending:
            lines.append(f"Cảnh báo chờ gửi: {len(pending)}")
    if len(hosts) > 8:
        lines.append(f"… còn {len(hosts) - 8} mục tiêu khác trong state.")
    lines.append("\nKhông thấy cổng mở không đồng nghĩa ứng dụng đã an toàn.")
    return "\n".join(lines)


def _send_report(bot_token: str, chat_id: str) -> None:
    """Gửi báo cáo HTML/Markdown mới nhất vào chat."""
    latest_html = reports_dir() / "latest.html"
    latest_md = reports_dir() / "latest.md"
    if not latest_html.is_file() and not latest_md.is_file():
        send_telegram_alert(
            bot_token,
            chat_id,
            "Chưa có báo cáo. Chạy `/scan` trước nhé.",
            buttons=_keyboard(),
        )
        return
    existing = [path.name for path in (latest_html, latest_md) if path.is_file()]
    caption = (
        "*Báo cáo quét mới nhất*\n"
        f"Kèm {', '.join(existing)}. Mở HTML để xem chi tiết hoặc in PDF; Markdown để trích vào báo cáo."
    )
    sent = False
    if latest_html.is_file():
        sent = send_telegram_document(
            bot_token, chat_id, latest_html,
            caption=caption if not sent else "",
            buttons=_keyboard() if not sent else None,
        ) or sent
    if latest_md.is_file():
        sent = send_telegram_document(
            bot_token, chat_id, latest_md,
            caption="" if sent else caption,
            buttons=None if sent else _keyboard(),
        ) or sent
    if not sent:
        send_telegram_alert(
            bot_token,
            chat_id,
            f"Không gửi được file báo cáo. File đang ở máy scanner:\n`{_short(latest_html if latest_html.is_file() else latest_md)}`",
            buttons=_keyboard(),
        )


def handle_command(bot_token: str, chat_id: str, command_text: str, *, user_id: str | int | None = None) -> None:
    """Xử lý các câu lệnh nhận được từ người dùng trên Telegram."""
    if not _authorized_sender(chat_id, user_id):
        return
    parts = command_text.strip().split()
    if not parts:
        return
    cmd = parts[0].lower().split("@")[0]  # Bỏ @bot_username nếu có
    args = parts[1:]

    if cmd in ("/start", "/help", "/menu"):
        send_telegram_alert(bot_token, chat_id, _help_text(), buttons=_keyboard())

    elif cmd == "/ping":
        send_telegram_alert(
            bot_token,
            chat_id,
            "Bot vẫn đang chạy. Dùng `/scan` để quét hoặc `/status` để xem baseline.",
            buttons=_keyboard(),
        )

    elif cmd == "/report":
        _send_report(bot_token, chat_id)

    elif cmd == "/status":
        state_file = _state_file()
        if not state_file.is_file():
            send_telegram_alert(
                bot_token,
                chat_id,
                "Chưa có baseline. Chạy `/scan` để tạo mốc so sánh.",
                buttons=_keyboard(),
            )
            return
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                state_data = json.load(f)
            if not state_data:
                send_telegram_alert(bot_token, chat_id, "Chưa có baseline. Chạy `/scan` trước nhé.", buttons=_keyboard())
                return
            message = _format_status(state_data)
            if len(message) > 4000:
                message = message[:3990] + "\n… (đã rút gọn)"
            send_telegram_alert(bot_token, chat_id, message, buttons=_keyboard())
        except Exception as exc:
            send_telegram_alert(
                bot_token,
                chat_id,
                f"Không đọc được trạng thái: `{_short(exc)}`\n"
                "Kiểm tra quyền đọc file state và chạy lại `/status`.",
                buttons=_keyboard(),
            )

    elif cmd == "/scan":
        target = _setting("SCANNER_TARGET", "127.0.0.1")
        ports_arg = None

        if len(args) == 1:
            first = args[0].strip()
            # Nếu người dùng truyền số hoặc chuỗi port (VD: 8080 hoặc 80,443)
            if all(c.isdigit() or c in ",-" for c in first):
                ports_arg = first
            else:
                target = first
        elif len(args) >= 2:
            target = args[0].strip()
            ports_arg = args[1].strip()

        try:
            from scanner.scan import parse_ports
            target = _scan_target(target)
            if len(args) > 2:
                raise ValueError("Use /scan [IPv4] [ports].")
            if ports_arg:
                requested_ports = parse_ports(ports_arg)
                if len(requested_ports) > 32:
                    raise ValueError("ChatOps scans are limited to 32 ports.")
                ports_arg = ",".join(map(str, requested_ports))
        except ValueError:
            send_telegram_alert(
                bot_token,
                chat_id,
                "*Mục tiêu hoặc cổng không hợp lệ.*\n"
                "• Chỉ nhận IPv4 nằm trong `SCANNER_ALLOWED_TARGETS`.\n"
                "• Tối đa 32 cổng/lần, ví dụ `/scan 80,443,8080`.\n"
                "• Không nhận hostname, CIDR hoặc tham số thừa.",
                buttons=_keyboard(),
            )
            return

        ports_desc = f"cổng `{ports_arg}`" if ports_arg else "6 cổng mặc định"
        send_telegram_alert(
            bot_token,
            chat_id,
            f"Đang quét `{target}` ({ports_desc})…",
        )

        # Chạy scanner/scan.py dưới dạng subprocess
        cmd_run = [sys.executable, str(ROOT_DIR / "scanner" / "scan.py"), target,
                   "--state-file", str(_state_file()), "--no-banner"]
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
                timeout=60,
            )
            print(f"[+] Hoàn tất lệnh /scan {target} {ports_arg or ''} (Exit code: {proc.returncode})")

            if proc.returncode in (0, 1):
                duration_str = "N/A"
                posture_str = "Chưa có dữ liệu đánh giá"
                open_ports_str = "Không có"
                uncertain_str = "Không có"
                pending_str = "0"

                for line in proc.stdout.splitlines():
                    if "Thời gian quét" in line:
                        parts_dur = line.split("|")
                        duration_str = parts_dur[0].replace("Thời gian quét :", "").strip()
                        if len(parts_dur) > 1:
                            match = re.search(r"Cổng đang mở\s*\(\d+\):\s*(.*)", parts_dur[1])
                            if match:
                                open_ports_str = match.group(1).strip(" []") or "Không có"
                    elif "Đánh giá rủi ro" in line:
                        posture_str = line.replace("Đánh giá rủi ro :", "").strip()
                        match = re.search(r"Xếp hạng (\[[^]]+\]) - (.*?) \(Max Risk score:", posture_str)
                        if match:
                            posture_str = f"{match.group(1).strip('[]')} · {match.group(2).capitalize()}"
                    elif line.startswith("[EVENT:"):
                        try:
                            tail = line.split("uncertain=", 1)[1]
                            uncertain_str = tail.split(";", 1)[0].strip(" []") or "Không có"
                            pending_str = tail.split("pending_alerts=", 1)[1].strip()
                        except (IndexError, ValueError):
                            pass

                is_no_change = "EVENT: NO_CHANGE" in proc.stdout
                is_initial = "EVENT: INITIAL_SCAN" in proc.stdout
                # Exit 1 can also mean pending alert delivery, not uncertain ports.
                is_uncertain = uncertain_str != "Không có" or "EVENT: SCAN_UNCERTAIN" in proc.stdout

                summary_lines = [
                    "*Quét xong*" if not is_uncertain else "*Quét xong, kết quả chưa đầy đủ*",
                    f"Mục tiêu: `{target}`" + (f" (cổng `{ports_arg}`)" if ports_arg else ""),
                    f"Thời gian: {duration_str}",
                    f"Đánh giá: {posture_str}",
                    f"Cổng đang mở: `{open_ports_str}`",
                ]
                if uncertain_str != "Không có":
                    summary_lines.append(f"Timeout/filtered: `{uncertain_str}`")
                if pending_str != "0":
                    summary_lines.append(f"Cảnh báo chờ gửi: {pending_str}")

                if is_uncertain:
                    summary_lines.append(
                        "\nCó cổng timeout/filtered, chưa thể coi là đã đóng. Xem báo cáo để biết chi tiết."
                    )
                elif is_no_change:
                    summary_lines.append("\nKhông có thay đổi cổng đã xác nhận; không phải kết luận hết lỗ hổng.")
                elif is_initial:
                    summary_lines.append("\nĐã lưu baseline làm mốc so sánh.")
                else:
                    summary_lines.append("\nCó thay đổi cổng. Xem cảnh báo chi tiết; tin chưa gửi được sẽ được giữ để thử lại.")

                summary_lines.append("Bấm Báo cáo hoặc dùng `/report` để nhận file.")
                send_telegram_alert(
                    bot_token,
                    chat_id,
                    "\n".join(summary_lines),
                    buttons=_keyboard(),
                )
            else:
                output_lines = (proc.stderr or proc.stdout).splitlines()
                errors = [line for line in output_lines if line.strip().startswith("[-]")]
                err_text = errors[-1].removeprefix("[-]").strip() if errors else f"Mã lỗi: {proc.returncode}"
                send_telegram_alert(
                    bot_token,
                    chat_id,
                    "*Không quét được mục tiêu*\n"
                    f"`{_short(err_text, 300)}`\n\n"
                    "Kiểm tra mạng, allowlist và quyền ghi báo cáo. "
                    "Nếu có trang lỗi, dùng `/report` để xem chi tiết.",
                    buttons=_keyboard(),
                )
        except Exception as exc:
            send_telegram_alert(
                bot_token,
                chat_id,
                f"Không chạy được scanner: `{_short(exc, 300)}`\n"
                "Kiểm tra Python, quyền thư mục `.local/` và chạy `/scan` lại.",
                buttons=_keyboard(),
            )


def handle_callback_query(bot_token: str, callback: dict) -> None:
    """Xử lý tương tác khi người dùng bấm vào các nút Inline Keyboard."""
    query_id = callback.get("id", "")
    data = callback.get("data", "")
    message = callback.get("message", {})
    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    sender = callback.get("from", {})
    user_id = sender.get("id")

    if sender.get("is_bot") or not _authorized_sender(chat_id, user_id):
        return

    answer_callback_query(bot_token, query_id)

    if data in ("scan_local", "scan_default"):
        handle_command(bot_token, chat_id, "/scan", user_id=user_id)
    elif data == "scan_web":
        handle_command(bot_token, chat_id, "/scan 80,443,8080", user_id=user_id)
    elif data == "scan_db":
        handle_command(bot_token, chat_id, "/scan 5432,3306,6379", user_id=user_id)
    elif data == "status":
        handle_command(bot_token, chat_id, "/status", user_id=user_id)
    elif data == "report":
        handle_command(bot_token, chat_id, "/report", user_id=user_id)
    elif data in ("menu", "start"):
        handle_command(bot_token, chat_id, "/help", user_id=user_id)
    elif data == "ping":
        handle_command(bot_token, chat_id, "/ping", user_id=user_id)
    elif data == "help":
        handle_command(bot_token, chat_id, "/help", user_id=user_id)


def verify_bot_credentials(bot_token: str) -> str | None:
    """Kiểm tra token thật trước khi coi tiến trình bot là đã sẵn sàng."""
    try:
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{bot_token}/getMe",
            headers={"User-Agent": "PBL4-517-BotListener/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        if not data.get("ok"):
            return "Telegram không chấp nhận token."
        return None
    except urllib.error.HTTPError as exc:
        return f"Telegram từ chối token (HTTP {exc.code})."
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return f"Không kết nối được Telegram: {exc}"


def run_listener() -> int:
    """Vòng lặp lắng nghe lệnh từ Telegram (Long Polling)."""
    _, tele_token, tele_chat_id = get_credentials()

    if not tele_token:
        print("[-] Lỗi: Không tìm thấy TELEGRAM_BOT_TOKEN trong file .env!", file=sys.stderr)
        return 2

    if not tele_chat_id or not any(value.strip().isascii() and value.strip().isdigit()
                                 for value in _setting("TELEGRAM_ALLOWED_USER_IDS").split(",")):
        print("[-] ChatOps requires TELEGRAM_CHAT_ID and TELEGRAM_ALLOWED_USER_IDS.", file=sys.stderr)
        return 2

    credential_error = verify_bot_credentials(tele_token)
    if credential_error:
        print(f"[-] {credential_error}", file=sys.stderr)
        return 2

    print("[*] Đang đồng bộ danh sách lệnh và nút Menu với Telegram API...")
    register_bot_commands(tele_token, tele_chat_id)
    print("[+] Đã đăng ký lệnh gợi ý (Autocomplete Menu) thành công!")

    # Gửi tin nhắn thông báo sẵn sàng vào nhóm
    if tele_chat_id:
        send_telegram_alert(
            tele_token,
            tele_chat_id,
            "Bot đã chạy. Chọn thao tác bên dưới hoặc dùng `/help` để xem lệnh.",
            buttons=_keyboard(),
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
                sender = msg.get("from", {})

                if text.startswith("/") and not sender.get("is_bot") and _authorized_sender(chat_id, sender.get("id")):
                    handle_command(tele_token, chat_id, text, user_id=sender.get("id"))

        except urllib.error.HTTPError as exc:
            if exc.code == 409:
                print("[-] Một bot khác đang polling cùng token; dừng tiến trình cũ trước.", file=sys.stderr)
                return 2
            print(f"[-] Telegram HTTP {exc.code}; thử lại sau 3 giây.", file=sys.stderr)
            time.sleep(3)
        except urllib.error.URLError:
            time.sleep(3)
        except KeyboardInterrupt:
            print("\n[*] Đã dừng Telegram Bot Listener.")
            break
        except Exception as exc:
            print(f"[-] Lỗi polling: {exc}", file=sys.stderr)
            time.sleep(3)
    return 0


if __name__ == "__main__":
    raise SystemExit(run_listener())

