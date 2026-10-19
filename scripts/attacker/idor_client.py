"""Shared authenticated client for the three scoped IDOR demonstrations."""

import argparse
import getpass
import re
import sys
from urllib.parse import urlsplit
from uuid import UUID

import requests

DEFAULT_BASE_URL = "https://13.251.128.130"
TIMEOUT = 10


class DemoError(Exception):
    """A failed prerequisite is not evidence that access control works."""


def origin(value):
    parsed = urlsplit(value)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or parsed.path not in ("", "/") or parsed.query or parsed.fragment):
        raise argparse.ArgumentTypeError("Use an origin such as https://13.251.128.130 (no /api or credentials).")
    if parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise argparse.ArgumentTypeError("Remote targets require HTTPS; HTTP is allowed only for a local lab.")
    try:
        parsed.port
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Invalid port.") from exc
    return value.rstrip("/")


def order_id(value):
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("--id must be the UUID of a prepared test order.") from exc


def parser_for(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--url", type=origin, default=DEFAULT_BASE_URL,
                        help="Target origin (default: %(default)s); /api is added automatically")
    parser.add_argument("--id", type=order_id, required=True,
                        help="UUID of a synthetic order owned by customer A")
    parser.add_argument("--email", help="Existing customer B email; prompted when omitted")
    return parser


def request_json(session, method, url, **kwargs):
    response = session.request(method, url, timeout=TIMEOUT, allow_redirects=False, **kwargs)
    if 300 <= response.status_code < 400:
        raise DemoError("Redirect refused. Check --url and the deployed HTTPS configuration.")
    try:
        body = response.json()
    except ValueError as exc:
        raise DemoError(f"HTTP {response.status_code}: response is not JSON.") from exc
    if not isinstance(body, dict):
        raise DemoError("Unexpected API response shape.")
    return response.status_code, body


def csrf(session, base_url):
    status, body = request_json(session, "GET", base_url + "/api/auth/csrf")
    data = body.get("data")
    token = data.get("csrfToken") if isinstance(data, dict) else None
    if status != 200 or not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise DemoError(f"CSRF initialization failed (HTTP {status}).")
    return {"X-CSRF-Token": token}


def authenticate(session, base_url, email, password, target_order_id):
    status, body = request_json(
        session, "POST", base_url + "/api/auth/login",
        json={"email": email, "password": password}, headers=csrf(session, base_url))
    if status != 200:
        raise DemoError(f"Login failed (HTTP {status}). Use an existing test customer; no account was created.")
    data = body.get("data")
    user = data.get("user") if isinstance(data, dict) else None
    if not isinstance(user, dict) or user.get("role") != "CUSTOMER":
        raise DemoError("Use customer B, not an administrator, for the cross-user test.")
    status, body = request_json(session, "GET", base_url + "/api/orders")
    orders = body.get("data")
    if status != 200 or not isinstance(orders, list) or not all(isinstance(o, dict) for o in orders):
        raise DemoError("Cannot verify the current customer's order list.")
    if any(o.get("id") == target_order_id for o in orders):
        raise DemoError("This order belongs to the logged-in customer. Use customer B and an order from A.")


def report(status, body):
    error = body.get("error")
    code = error.get("code") if isinstance(error, dict) else None
    print(f"[*] Response Status: HTTP {status}")
    # Never dump order PII, cookies, tokens or server-provided arbitrary text.
    if status == 403 and code == "FORBIDDEN":
        print("[PASS] Access control denied this cross-user operation (403 FORBIDDEN).")
        return 0
    if status == 200 and isinstance(body.get("data"), dict):
        print("[FAIL] Cross-user request succeeded. Check the synthetic order and lab configuration.")
        return 1
    if status == 403 and code == "CSRF_INVALID":
        print("[INCONCLUSIVE] CSRF rejected the request; this does not verify IDOR protection.")
    else:
        print("[INCONCLUSIVE] Check authentication, order existence/status and server availability.")
    return 2


def run(args, method="GET", suffix="", payload=None):
    try:
        email = args.email or input("Existing customer B email: ").strip()
        password = getpass.getpass("Customer B password (hidden): ")
        if not email or not password:
            raise DemoError("Email and password are required.")
        with requests.Session() as session:
            authenticate(session, args.url, email, password, args.id)
            url = args.url + "/api/orders/" + args.id + suffix
            headers = csrf(session, args.url) if method != "GET" else {}
            print(f"[*] Target request: {method} {url}")
            status, body = request_json(session, method, url, headers=headers, json=payload)
            return report(status, body)
    except DemoError as exc:
        print(f"[INCONCLUSIVE] {exc}")
    except requests.RequestException:
        print("[INCONCLUSIVE] Network/TLS failure or timeout. HTTPS certificate validation remains enabled.")
    except (EOFError, KeyboardInterrupt):
        print("\n[INCONCLUSIVE] Input cancelled.")
    return 2


def configure_console():
    if sys.platform == "win32":
        for stream in (sys.stdout, sys.stderr):
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
