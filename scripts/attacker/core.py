"""Shared HTTP, trace, fixture and evidence helpers for synthetic-fixture probes."""
import http.cookiejar
import json
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler, Request

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FIXTURE = ROOT / '.local/private/lab-fixtures.json'
SQLI_PAYLOADS = ("' OR '1'='1", "' OR TRUE OR '1'='1")
DEFAULT_WRONG_PASSWORD = 'WrongSynthetic517!'
TRACE = []
TRACE_ENABLED = False


class Inconclusive(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Inconclusive(message)


def is_loopback(url):
    return urlsplit(url).hostname in ('127.0.0.1', 'localhost', '::1')


def truncate(value, limit=180):
    text = '' if value is None else str(value)
    return text if len(text) <= limit else text[:limit - 3] + '...'


def summarize_order(order):
    """Bounded order fields that prove what an attacker could read."""
    if not isinstance(order, dict):
        return []
    user = order.get('user') if isinstance(order.get('user'), dict) else {}
    items = order.get('items') if isinstance(order.get('items'), list) else []
    product_lines = []
    for item in items[:5]:
        if not isinstance(item, dict):
            continue
        product = item.get('product') if isinstance(item.get('product'), dict) else {}
        product_lines.append(
            f"{product.get('name') or item.get('productId')} × {item.get('quantity')} — {item.get('unitPrice')}/sp"
        )
    if len(items) > 5:
        product_lines.append(f'+{len(items) - 5} sản phẩm')
    recipient = ' | '.join(str(value) for value in (order.get('customerName'), order.get('customerEmail')) if value)
    return [
        {'label': 'Đơn hàng', 'value': truncate(order.get('id'))},
        {'label': 'Chủ đơn', 'value': truncate(user.get('email') or order.get('userId'))},
        {'label': 'Người nhận', 'value': truncate(recipient or '(trống)')},
        {'label': 'Điện thoại', 'value': truncate(order.get('customerPhone') or '(trống)')},
        {'label': 'Địa chỉ', 'value': truncate(order.get('shippingAddress') or '(trống)')},
        {'label': 'Trạng thái', 'value': truncate(order.get('status'))},
        {'label': 'Tổng tiền', 'value': truncate(order.get('totalPrice'))},
        {'label': 'Sản phẩm', 'value': truncate('; '.join(product_lines) or '(không có)')},
    ]


def redact_evidence(evidence, local, show_evidence=False):
    """Remote targets keep status/count controls but hide observed values by default."""
    if local or show_evidence:
        return evidence
    redacted = dict(evidence)
    redacted['redacted'] = True
    observed = redacted.get('observed')
    if isinstance(observed, list):
        redacted['observed'] = [
            {'label': item.get('label', ''), 'value': '<redacted: non-loopback target>'}
            for item in observed if isinstance(item, dict)
        ]
    limits = list(redacted.get('limits') or [])
    limits.append('Chi tiết observed bị che vì target ngoài loopback; dùng --show-evidence nếu được phép.')
    redacted['limits'] = limits
    return redacted


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, url):
        parsed = urlsplit(url)
        require(parsed.scheme == 'https' or (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')), 'Use HTTPS (HTTP allowed only on loopback).')
        require(not parsed.username and not parsed.password and parsed.path in ('', '/') and not parsed.query and not parsed.fragment, 'Use an origin URL without credentials/path/query.')
        self.url = url.rstrip('/')
        self.label = 'client'
        self.opener = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()), NoRedirect())

    def spawn(self):
        """A separate cookie jar, for owner controls next to the attacker session."""
        return type(self)(self.url)

    def raw(self, path, method='GET', body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(self.url + path, data=data, method=method,
                          headers={'Cache-Control': 'no-cache', **({'Content-Type': 'application/json'} if data else {}), **(headers or {})})
        try:
            response = self.opener.open(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.read()

    def request(self, path, method='GET', body=None):
        headers = {}
        if method != 'GET':
            status, csrf = self.request('/api/auth/csrf')
            require(status == 200 and isinstance(csrf.get('data', {}).get('csrfToken'), str), 'CSRF precondition failed.')
            headers['X-CSRF-Token'] = csrf['data']['csrfToken']
        status, raw = self.raw(path, method, body, headers)
        try:
            result = json.loads(raw)
        except (ValueError, UnicodeError):
            raise Inconclusive(f'Expected JSON, received HTTP {status}.') from None
        require(isinstance(result, dict), 'Invalid API envelope.')
        entry = {'actor': self.label, 'method': method, 'path': path, 'status': status}
        if result.get('error', {}).get('code'):
            entry['error'] = result['error']['code']
            entry['message'] = result['error'].get('message', '')
        # Only synthetic mutation input is shown; never credentials/CSRF/cookies.
        if method == 'PATCH' and path.startswith('/api/orders/') and body:
            entry['body'] = body
        TRACE.append(entry)
        if TRACE_ENABLED:
            print(f"[{len(TRACE):02d}] [{self.label}] {method} {path} -> {status} {entry.get('error', '')}".rstrip(), file=sys.stderr, flush=True)
            if entry.get('message'):
                print('     ' + entry['message'], file=sys.stderr, flush=True)
            if 'body' in entry:
                print('     Body: ' + json.dumps(entry['body'], ensure_ascii=False), file=sys.stderr, flush=True)
        return status, result

    def login(self, account):
        self.label = account['email']
        status, body = self.request('/api/auth/login', 'POST', {k: account[k] for k in ('email', 'password')})
        require(status == 200 and body.get('data', {}).get('user', {}).get('id') == account['id'], f'Login precondition failed (HTTP {status}); check fixtures/cooldown.')
        status, body = self.request('/api/auth/me')
        user = body.get('data', {}).get('user', {})
        require(status == 200 and user.get('id') == account['id'], 'Session cookie not retained.')
        require(user.get('role') == 'CUSTOMER', 'Attack/control accounts must be customers, not admins.')


def data(client, path):
    status, body = client.request(path)
    require(status == 200 and 'data' in body, f'Control request failed (HTTP {status}).')
    return body['data']
