import importlib.util
import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('demo', Path(__file__).parents[1] / 'demo.py')
demo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(demo)


class Results(unittest.TestCase):
    def test_http_failures_never_count_as_sqli_defense(self):
        fixture = {'productName': 'fixture', 'productId': 'p', 'run': 'test'}
        for status in (403, 429, 500, 502, 503):
            client = Mock()
            client.request.side_effect = [(200, {'data': [{'id': 'p'}]}), (200, {'data': []}), (status, {'error': {'code': 'CSRF_INVALID'}})]
            with self.assertRaises(demo.Inconclusive):
                demo.sqli(client, fixture)

    def test_empty_catalog_is_not_proof_of_defense(self):
        client = Mock()
        client.request.return_value = (200, {'data': []})
        with self.assertRaises(demo.Inconclusive):
            demo.sqli(client, {'productName': 'fixture', 'productId': 'p'})

    def test_literal_and_disclosure_results(self):
        for rows, expected in [([], 'DEFENSE_VERIFIED'), ([{'id': 'p'}], 'EXPLOIT_CONFIRMED')]:
            client = Mock()
            client.request.side_effect = [(200, {'data': [{'id': 'p'}]}), (200, {'data': []}), (200, {'data': rows})]
            self.assertEqual(demo.sqli(client, {'productName': 'fixture', 'productId': 'p', 'run': 'r'}), expected)

    def test_idor_wrong_403_is_inconclusive(self):
        for code in ('CSRF_INVALID', 'UNAUTHORIZED'):
            client = Mock(url='https://example.invalid')
            client.request.return_value = (403, {'error': {'code': code}})
            owner = Mock()
            order = {'id': 'o', 'userId': 'a', 'status': 'PENDING', 'shippingAddress': 'owner'}
            owner.request.side_effect = [(200, {'data': order}), (200, {'data': {'stock': 48}})] * 2
            with patch.object(demo, 'Client', return_value=owner), self.assertRaises(demo.Inconclusive):
                demo.idor(client, {'owner': {'id': 'a'}, 'attacker': {'id': 'b'}, 'orderId': 'o', 'productId': 'p', 'run': 'r'}, 'idor-update')

    def test_failed_login_stops_before_attack(self):
        client = demo.Client('https://example.invalid')
        client.request = Mock(return_value=(503, {'error': {'code': 'DATABASE_UNAVAILABLE'}}))
        with self.assertRaises(demo.Inconclusive):
            client.login({'id': 'b', 'email': 'fake@example.invalid', 'password': 'synthetic'})
        self.assertEqual(client.request.call_count, 1)

    def test_reject_remote_http_and_embedded_credentials(self):
        for url in ('http://13.251.128.130', 'https://user:pass@example.invalid', 'https://example.invalid/api'):
            with self.assertRaises(demo.Inconclusive):
                demo.Client(url)

    def test_redirects_are_not_followed_with_credentials(self):
        self.assertIsNone(demo.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://elsewhere.invalid'))

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
                with self.assertRaises(demo.Inconclusive):
                    demo.verify_release(client, revision)
            else:
                self.assertEqual(demo.verify_release(client, revision), 'RELEASE_VERIFIED')


if __name__ == '__main__':
    unittest.main()
