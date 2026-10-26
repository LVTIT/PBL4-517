"""Bounded synthetic-fixture probes. Windows/Linux; Python standard library only."""
import argparse
import hashlib
import http.cookiejar
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, HTTPRedirectHandler, Request


class Inconclusive(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Inconclusive(message)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, url):
        parsed = urlsplit(url)
        require(parsed.scheme == 'https' or (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1', '::1')), 'Use HTTPS (HTTP allowed only on loopback).')
        require(not parsed.username and not parsed.password and parsed.path in ('', '/') and not parsed.query and not parsed.fragment, 'Use an origin URL without credentials/path/query.')
        self.url = url.rstrip('/')
        self.opener = build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()), NoRedirect())

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
        return status, result

    def login(self, account):
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


def sqli(client, fixture):
    path = '/api/products?'
    control = data(client, path + urlencode({'search': fixture['productName']}))
    require(isinstance(control, list) and any(row.get('id') == fixture['productId'] for row in control), 'Positive search control missing fixture.')
    missing = 'absent-' + fixture['run']
    require(data(client, path + urlencode({'search': missing})) == [], 'Negative search control not empty.')
    result = data(client, path + urlencode({'search': "' OR '1'='1"}))
    require(isinstance(result, list), 'Unexpected search result.')
    if any(row.get('id') == fixture['productId'] for row in result):
        return 'EXPLOIT_CONFIRMED'
    require(result == [], 'Unexpected rows: cannot establish defense.')
    return 'DEFENSE_VERIFIED'


def idor(client, fixture, scenario):
    owner = Client(client.url)
    owner.login(fixture['owner'])
    client.login(fixture['attacker'])
    require(fixture['owner']['id'] != fixture['attacker']['id'], 'Owner and attacker must differ.')
    path = '/api/orders/' + fixture['orderId']
    before = data(owner, path)
    require(before.get('userId') == fixture['owner']['id'], 'Order ownership precondition failed.')
    stock = data(owner, '/api/products/' + fixture['productId'])['stock']
    if scenario != 'idor':
        require(before.get('status') == 'PENDING', 'Mutation requires a fresh PENDING fixture order.')
    marker = 'Synthetic attacker ' + fixture['run']
    require(scenario != 'idor-update' or before.get('shippingAddress') != marker, 'Use a fresh run for repeated update tests.')
    if scenario == 'idor-update':
        status, body = client.request(path, 'PATCH', {'shippingAddress': marker})
    elif scenario == 'idor-cancel':
        status, body = client.request(path + '/cancel', 'POST', {})
    else:
        status, body = client.request(path)
    after = data(owner, path)
    after_stock = data(owner, '/api/products/' + fixture['productId'])['stock']
    if status == 403 and body.get('error', {}).get('code') == 'FORBIDDEN':
        require(before == after and stock == after_stock, 'Order/stock changed despite forbidden response.')
        return 'DEFENSE_VERIFIED'
    require(status == 200 and body.get('data', {}).get('id') == fixture['orderId'], f'Unexpected attack response HTTP {status}; not proof of defense.')
    if scenario == 'idor-update':
        require(after['shippingAddress'] == marker and after_stock == stock, 'Update not persisted as expected.')
    elif scenario == 'idor-cancel':
        quantity = sum(item['quantity'] for item in before['items'] if item['productId'] == fixture['productId'])
        require(quantity > 0 and after['status'] == 'CANCELLED' and after_stock == stock + quantity, 'Cancellation/stock restoration not persisted.')
    else:
        require(body['data'].get('userId') == fixture['owner']['id'], 'Response did not disclose fixture ownership.')
    return 'EXPLOIT_CONFIRMED'


def auth(client, fixture):
    # A correct login first distinguishes rate-limit behavior from broken auth.
    client.login(fixture['owner'])
    outcomes = []
    for _ in range(12):
        status, body = client.request('/api/auth/login', 'POST', {'email': fixture['owner']['email'], 'password': 'WrongSynthetic517!'})
        outcomes.append((status, body.get('error', {}).get('code')))
    require(all(status == 401 and code == 'INVALID_CREDENTIALS' for status, code in outcomes[:10]), 'Login counter was not fresh or auth preconditions failed; wait 15 minutes or restart lab backend.')
    if all(status == 401 and code == 'INVALID_CREDENTIALS' for status, code in outcomes[10:]):
        client.login(fixture['owner'])
        return 'EXPLOIT_CONFIRMED'
    require(outcomes[10:] == [(429, 'TOO_MANY_ATTEMPTS')] * 2, 'Unexpected limiter response.')
    return 'DEFENSE_VERIFIED'


def verify_release(client, revision):
    require(len(revision) == 40 and all(c in '0123456789abcdef' for c in revision), 'Supply exact 40-character tested revision.')
    health = data(client, '/api/health')
    require(health.get('database') == 'connected', 'Database health failed.')
    backend = data(client, '/api/version')
    status, raw = client.raw('/release.json')
    require(status == 200, 'Frontend release manifest unavailable.')
    frontend = json.loads(raw)
    for component, metadata in [('backend', backend), ('frontend', frontend)]:
        require(metadata.get('component') == component and metadata.get('revision') == revision and metadata.get('dirty') is False, f'{component} is not the clean expected release.')
    files = frontend.get('files', {})
    require('index.html' in files and any(name.endswith('.js') for name in files), 'Incomplete frontend release manifest.')
    for name, expected in files.items():
        require(not name.startswith('/') and all(part not in ('', '.', '..') for part in name.split('/')) and '\\' not in name and '?' not in name and '#' not in name, 'Invalid artifact path.')
        status, raw = client.raw('/' + name)
        require(status == 200 and hashlib.sha256(raw).hexdigest() == expected, f'Frontend artifact mismatch: {name}')
    return 'RELEASE_VERIFIED'


def main(fixed_scenario=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True, help='Deployed origin, e.g. https://13.251.128.130')
    parser.add_argument('--fixture', type=Path)
    parser.add_argument('--expect', choices=['vulnerable', 'secure'])
    parser.add_argument('--revision', help='Exact reviewed revision (required by release check)')
    parser.add_argument('--scenario', choices=['release', 'sqli', 'idor', 'idor-update', 'idor-cancel', 'auth'], default=fixed_scenario, required=fixed_scenario is None)
    args = parser.parse_args()
    report = {'scenario': args.scenario, 'target': args.url, 'at': datetime.now(timezone.utc).isoformat()}
    try:
        client = Client(args.url)
        if args.scenario == 'release':
            result = verify_release(client, args.revision or '')
        else:
            require(args.fixture is not None and args.expect is not None, 'Supply --fixture and --expect.')
            fixture = json.loads(args.fixture.read_text(encoding='utf-8'))
            require(fixture.get('schema') == 1, 'Unsupported fixture manifest.')
            version = data(client, '/api/version')
            report['revision'] = version.get('revision')
            report['run'] = fixture['run']
            report['expected'] = args.expect
            if args.revision:
                require(version.get('revision') == args.revision and version.get('dirty') is False, 'Backend revision mismatch or dirty build.')
            result = sqli(client, fixture) if args.scenario == 'sqli' else auth(client, fixture) if args.scenario == 'auth' else idor(client, fixture, args.scenario)
        report['result'] = result
        expected = 'RELEASE_VERIFIED' if args.scenario == 'release' else 'EXPLOIT_CONFIRMED' if args.expect == 'vulnerable' else 'DEFENSE_VERIFIED'
        report['passed'] = result == expected
        code = 0 if report['passed'] else 1
    except (Inconclusive, URLError, OSError, ValueError, KeyError, TypeError, AttributeError, IndexError) as error:
        # Do not print exception payloads, cookies, fixture credentials or response bodies.
        report.update(result='INCONCLUSIVE', passed=False, detail=str(error) if isinstance(error, Inconclusive) else type(error).__name__)
        code = 2
    print(json.dumps(report, ensure_ascii=True))
    return code


if __name__ == '__main__':
    sys.exit(main())
