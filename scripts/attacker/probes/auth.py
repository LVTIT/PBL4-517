"""Bounded login-attempt probe; never prints the synthetic wrong password."""
from collections import Counter

from core import require, redact_evidence


def _summarize(outcomes):
    counts = Counter(f'{status} {code}' for status, code in outcomes)
    return '; '.join(f'{label} × {count}' for label, count in counts.items())


def run(client, fixture, wrong_password, local=True, show_evidence=False):
    # A correct login first distinguishes rate-limit behavior from broken auth.
    client.login(fixture['owner'])
    require(8 <= len(wrong_password) <= 72 and wrong_password != fixture['owner']['password'], 'Use a different synthetic wrong password (8..72 characters).')
    outcomes = []
    for _ in range(12):
        status, body = client.request('/api/auth/login', 'POST', {'email': fixture['owner']['email'], 'password': wrong_password})
        outcomes.append((status, body.get('error', {}).get('code')))
    require(all(status == 401 and code == 'INVALID_CREDENTIALS' for status, code in outcomes[:10]), 'Login counter was not fresh or auth preconditions failed; wait 15 minutes or restart lab backend.')
    first_429 = next((index for index, (status, _) in enumerate(outcomes, start=1) if status == 429), None)
    if all(status == 401 and code == 'INVALID_CREDENTIALS' for status, code in outcomes[10:]):
        client.login(fixture['owner'])
        controls = [
            {'label': 'Login đúng', 'value': '200 OK (trước khi thử)'},
            {'label': 'Login đúng sau 12 lần', 'value': '200 OK'},
        ]
        result = 'EXPLOIT_CONFIRMED'
    else:
        require(outcomes[10:] == [(429, 'TOO_MANY_ATTEMPTS')] * 2, 'Unexpected limiter response.')
        controls = [{'label': 'Login đúng', 'value': '200 OK (trước khi thử)'}]
        result = 'DEFENSE_VERIFIED'
    evidence = {
        'observedTitle': 'Kết quả 12 lần đăng nhập sai',
        'observed': [
            {'label': 'Control login', 'value': '200 OK'},
            {'label': '12 lần sai', 'value': _summarize(outcomes)},
            {'label': '429 đầu tiên', 'value': f'lần {first_429}' if first_429 else 'không có'},
        ],
        'controlsTitle': 'Đối chứng',
        'controls': controls,
        'limits': ['Không tìm ra mật khẩu; không chiếm tài khoản.'],
    }
    return result, redact_evidence(evidence, local, show_evidence)
