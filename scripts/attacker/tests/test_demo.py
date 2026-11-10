import contextlib
import importlib.util
import io
import hashlib
import json
import sys
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

ATTACKER_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(ATTACKER_DIR))

spec = importlib.util.spec_from_file_location('demo', ATTACKER_DIR / 'demo.py')
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)

import core  # noqa: E402
from probes import auth, idor, release, sqli  # noqa: E402

ORDER = {
    'id': 'o',
    'userId': 'owner',
    'user': {'id': 'owner', 'name': 'Lab owner', 'email': 'owner@local.test'},
    'customerName': 'Lab owner',
    'customerEmail': 'owner@local.test',
    'customerPhone': None,
    'shippingAddress': 'Synthetic owner address',
    'status': 'PENDING',
    'totalPrice': '2000.00',
    'items': [{'productId': 'p', 'quantity': 2, 'unitPrice': '1000.00', 'product': {'id': 'p', 'name': 'KEVILO lab r'}}],
}
FIXTURE = {'schema': 1, 'run': 'r', 'owner': {'id': 'owner', 'email': 'owner@local.test', 'password': 'Owner517!demo'},
           'attacker': {'id': 'attacker', 'email': 'attacker@local.test'},
           'orderId': 'o', 'productId': 'p', 'productName': 'KEVILO lab r', 'reviewId': 'v'}


class QueueClient:
    """Deterministic client: each request pops one (status, body) envelope."""

    def __init__(self, responses, url='http://127.0.0.1:3000'):
        self._responses = list(responses)
        self.url = url
        self.logins = []

    def spawn(self):
        return self

    def login(self, account):
        self.logins.append(account['id'])

    def request(self, path, method='GET', body=None):
        return self._responses.pop(0)


class Results(unittest.TestCase):
    def test_observe_does_not_infer_phase_and_accepts_either_conclusive_result(self):
        fixture = {'schema': 1, 'run': 'r', 'owner': {'email': 'owner@local.test'}, 'attacker': {'email': 'attacker@local.test'}}
        for result_name in ('EXPLOIT_CONFIRMED', 'DEFENSE_VERIFIED'):
            evidence = {'observedTitle': 'x', 'observed': [{'label': 'a', 'value': 'b'}], 'controls': [], 'limits': []}
            with self.subTest(result=result_name), patch.object(demo.sys, 'argv', ['demo.py', '--scenario', 'sqli', '--observe']), patch.object(demo.Path, 'read_text', return_value=json.dumps(fixture)), patch.object(demo.core, 'Client'), patch.object(demo, 'data', return_value={}), patch.object(demo.sqli, 'run', return_value=(result_name, evidence)):
                output = io.StringIO()
                with contextlib.redirect_stdout(output):
                    self.assertEqual(demo.main(), 0)
                report = json.loads(output.getvalue())
                self.assertEqual(report['result'], result_name)
                self.assertEqual(report['evidence'], evidence)
                self.assertTrue(report['completed'])
                self.assertNotIn('passed', report)
                self.assertNotIn('expected', report)
        self.assertFalse(hasattr(demo, 'infer_expect'))

    def test_observe_precondition_failure_is_still_inconclusive(self):
        fixture = {'schema': 1, 'run': 'r', 'owner': {'email': 'owner@local.test'}, 'attacker': {'email': 'attacker@local.test'}}
        with patch.object(demo.sys, 'argv', ['demo.py', '--scenario', 'sqli', '--observe']), patch.object(demo.Path, 'read_text', return_value=json.dumps(fixture)), patch.object(demo.core, 'Client'), patch.object(demo, 'data', return_value={}), patch.object(demo.sqli, 'run', side_effect=core.Inconclusive('Missing control')):
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(demo.main(), 2)
            report = json.loads(output.getvalue())
            self.assertEqual(report['result'], 'INCONCLUSIVE')
            self.assertFalse(report['completed'])

    def test_trace_streams_real_error_but_not_login_body_or_token(self):
        client = core.Client('http://127.0.0.1:3000')
        client.raw = Mock(side_effect=[(200, json.dumps({'data': {'csrfToken': 'a' * 64}}).encode()), (401, json.dumps({'error': {'code': 'INVALID_CREDENTIALS', 'message': 'Login rejected'}}).encode())])
        output = io.StringIO()
        with patch.object(core, 'TRACE_ENABLED', True), patch.object(core, 'TRACE', []), contextlib.redirect_stderr(output):
            status, _ = client.request('/api/auth/login', 'POST', {'email': 'owner@local.test', 'password': 'secret-do-not-log'})
        self.assertEqual(status, 401)
        self.assertIn('[01] [client] GET /api/auth/csrf -> 200', output.getvalue())
        self.assertIn('POST /api/auth/login -> 401 INVALID_CREDENTIALS', output.getvalue())
        self.assertIn('Login rejected', output.getvalue())
        self.assertNotIn('secret-do-not-log', output.getvalue())
        self.assertNotIn('a' * 64, output.getvalue())

    def test_http_failures_never_count_as_sqli_defense(self):
        fixture = {'productName': 'fixture', 'productId': 'p', 'run': 'test'}
        for status in (403, 429, 500, 502, 503):
            client = Mock()
            client.request.side_effect = [(200, {'data': [{'id': 'p'}]}), (200, {'data': []}), (status, {'error': {'code': 'CSRF_INVALID'}})]
            with self.assertRaises(core.Inconclusive):
                sqli.run(client, fixture)

    def test_empty_catalog_is_not_proof_of_defense(self):
        client = Mock()
        client.request.return_value = (200, {'data': []})
        with self.assertRaises(core.Inconclusive):
            sqli.run(client, {'productName': 'fixture', 'productId': 'p'})

    def test_literal_and_disclosure_results(self):
        for rows, expected in [([], 'DEFENSE_VERIFIED'), ([{'id': 'p', 'name': 'KEVILO lab r'}], 'EXPLOIT_CONFIRMED')]:
            client = Mock()
            client.request.side_effect = [(200, {'data': [{'id': 'p'}]}), (200, {'data': []}), (200, {'data': rows})]
            result, evidence = sqli.run(client, {'productName': 'fixture', 'productId': 'p', 'run': 'r'})
            self.assertEqual(result, expected)
            observed = {item['label']: item['value'] for item in evidence['observed']}
            self.assertEqual(observed['Số dòng'], str(len(rows)))
            if rows:
                self.assertIn('KEVILO lab r', observed['Sản phẩm lộ'])
            else:
                self.assertNotIn('Sản phẩm lộ', observed)
                self.assertIn('dữ liệu tìm kiếm', observed['Kết luận'])

    def test_idor_wrong_403_is_inconclusive(self):
        for code in ('CSRF_INVALID', 'UNAUTHORIZED'):
            client = QueueClient([(403, {'error': {'code': code}})])
            owner = QueueClient([(200, {'data': ORDER}), (200, {'data': {'stock': 48}})] * 2)
            client.spawn = lambda: owner
            with self.assertRaises(core.Inconclusive):
                idor.run(client, FIXTURE, 'idor-update')

    def test_idor_read_evidence_shows_only_disclosed_order_not_stock(self):
        order = dict(ORDER, shippingAddress='Synthetic owner address')
        client = QueueClient([(200, {'data': order}), (200, {'data': {'stock': 48}}),
                              (200, {'data': order}), (200, {'data': order}), (200, {'data': {'stock': 48}})])
        result, evidence = idor.run(client, FIXTURE, 'idor')
        self.assertEqual(result, 'EXPLOIT_CONFIRMED')
        observed = {item['label']: item['value'] for item in evidence['observed']}
        self.assertEqual(observed['Chủ đơn'], 'owner@local.test')
        self.assertEqual(observed['Địa chỉ'], 'Synthetic owner address')
        self.assertIn('KEVILO lab r', observed['Sản phẩm'])
        self.assertNotIn('48', json.dumps(evidence))

    def test_idor_secure_evidence_does_not_disclose_the_order(self):
        client = QueueClient([(200, {'data': ORDER}), (200, {'data': {'stock': 48}}),
                              (403, {'error': {'code': 'FORBIDDEN'}}),
                              (200, {'data': ORDER}), (200, {'data': {'stock': 48}})])
        result, evidence = idor.run(client, FIXTURE, 'idor')
        self.assertEqual(result, 'DEFENSE_VERIFIED')
        text = json.dumps(evidence, ensure_ascii=False)
        self.assertIn('403 FORBIDDEN', text)
        self.assertNotIn('Synthetic owner address', text)
        self.assertNotIn('KEVILO lab r', text)
        self.assertNotIn('password', text)
        self.assertTrue(evidence['limits'])

    def test_idor_cancel_evidence_reports_status_and_stock_restoration(self):
        cancelled = dict(ORDER, status='CANCELLED')
        client = QueueClient([(200, {'data': ORDER}), (200, {'data': {'stock': 46}}),
                              (200, {'data': cancelled}), (200, {'data': cancelled}), (200, {'data': {'stock': 48}})])
        result, evidence = idor.run(client, FIXTURE, 'idor-cancel')
        self.assertEqual(result, 'EXPLOIT_CONFIRMED')
        observed = {item['label']: item['value'] for item in evidence['observed']}
        self.assertEqual(observed['Trạng thái'], 'PENDING → CANCELLED')
        self.assertEqual(observed['KEVILO lab r'], '46 → 48 (+2)')

    def test_auth_evidence_distinguishes_open_and_rate_limited_logins(self):
        for outcomes, expected in [([(401, 'INVALID_CREDENTIALS')] * 12, 'EXPLOIT_CONFIRMED'),
                                   ([(401, 'INVALID_CREDENTIALS')] * 10 + [(429, 'TOO_MANY_ATTEMPTS')] * 2, 'DEFENSE_VERIFIED')]:
            client = QueueClient([(status, {'error': {'code': code}}) for status, code in outcomes])
            result, evidence = auth.run(client, FIXTURE, 'WrongSynthetic517!')
            self.assertEqual(result, expected)
            observed = {item['label']: item['value'] for item in evidence['observed']}
            self.assertIn('INVALID_CREDENTIALS', observed['12 lần sai'])
            self.assertEqual(observed['429 đầu tiên'], 'lần 11' if expected == 'DEFENSE_VERIFIED' else 'không có')
            self.assertNotIn('WrongSynthetic517!', json.dumps(evidence))

    def test_failed_login_stops_before_attack(self):
        client = core.Client('https://example.invalid')
        client.request = Mock(return_value=(503, {'error': {'code': 'DATABASE_UNAVAILABLE'}}))
        with self.assertRaises(core.Inconclusive):
            client.login({'id': 'b', 'email': 'fake@example.invalid', 'password': 'synthetic'})
        self.assertEqual(client.request.call_count, 1)

    def test_reject_remote_http_and_embedded_credentials(self):
        for url in ('http://13.251.128.130', 'https://user:pass@example.invalid', 'https://example.invalid/api'):
            with self.assertRaises(core.Inconclusive):
                core.Client(url)

    def test_redirects_are_not_followed_with_credentials(self):
        self.assertIsNone(core.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://elsewhere.invalid'))

    def test_release_requires_clean_matching_components_and_real_assets(self):
        revision = 'a' * 40
        for dirty, other_revision, tamper in [(False, revision, False), (True, revision, False), (False, 'b' * 40, False), (False, revision, True)]:
            client = Mock()
            client.request.side_effect = [(200, {'data': {'database': 'connected'}}),
                (200, {'data': {'component': 'backend', 'revision': other_revision, 'dirty': dirty}})]
            files = {'index.html': b'<html>app</html>', 'assets/app.js': b'/* compiled */'}
            manifest = {'component': 'frontend', 'revision': revision, 'dirty': False,
                        'files': {name: hashlib.sha256(raw).hexdigest() for name, raw in files.items()}}
            client.raw.side_effect = [(200, json.dumps(manifest).encode()), (200, b'wrong' if tamper else files['index.html']), (200, files['assets/app.js'])]
            if dirty or other_revision != revision or tamper:
                with self.assertRaises(core.Inconclusive):
                    release.run(client, revision)
            else:
                result, evidence = release.run(client, revision)
                self.assertEqual(result, 'RELEASE_VERIFIED')
                self.assertEqual(len(evidence['observed']), 3)

    def test_remote_evidence_is_redacted_unless_explicitly_allowed(self):
        evidence = {'observedTitle': 'x', 'observed': [{'label': 'Địa chỉ', 'value': 'secret data'}],
                    'controls': [], 'limits': ['base']}
        hidden = core.redact_evidence(evidence, local=False)
        self.assertTrue(hidden['redacted'])
        self.assertNotIn('secret data', json.dumps(hidden))
        self.assertIn('--show-evidence', hidden['limits'][-1])
        self.assertEqual(core.redact_evidence(evidence, local=False, show_evidence=True), evidence)
        self.assertEqual(core.redact_evidence(evidence, local=True), evidence)


if __name__ == '__main__':
    unittest.main()
