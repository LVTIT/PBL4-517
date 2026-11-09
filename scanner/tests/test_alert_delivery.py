"""Notifier failure/recovery regressions with synthetic credentials and no network."""
import io
import json
from pathlib import Path
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

from alerts import notifier
from scanner.scan import evaluate_diff_and_notify
from scanner.state_store import load_state


WEBHOOK = 'https://discord.invalid/delivery/synthetic-webhook'
TOKEN = 'synthetic-bot-token'
CHAT = 'synthetic-chat'
PRIVATE_DETAIL = 'synthetic-private-request-detail'


class Response(io.BytesIO):
    def __init__(self, status, payload=b''):
        super().__init__(payload)
        self.status = status


class AlertDeliveryTests(unittest.TestCase):
    def test_transport_errors_keep_diagnostics_without_private_details(self):
        for channel in ('Discord', 'Telegram'):
            for kind in ('http', 'network', 'unexpected'):
                with self.subTest(channel=channel, kind=kind):
                    detail = f'{WEBHOOK} {TOKEN} {CHAT} {PRIVATE_DETAIL}\nFORGED LOG ROW'
                    if kind == 'http':
                        error = urllib.error.HTTPError(WEBHOOK, 503, detail, {}, None)
                        diagnostic = 'HTTP 503'
                    elif kind == 'network':
                        error = urllib.error.URLError(detail)
                        diagnostic = 'URLError'
                    else:
                        error = ValueError(detail)
                        diagnostic = 'ValueError'
                    stderr = io.StringIO()
                    with patch('alerts.notifier.urllib.request.urlopen', side_effect=error), \
                         patch('sys.stderr', stderr):
                        if channel == 'Discord':
                            sent = notifier.send_discord_alert(WEBHOOK, 'test', 'test', 0)
                        else:
                            sent = notifier.send_telegram_alert(TOKEN, CHAT, 'test')
                    self.assertFalse(sent)
                    log = stderr.getvalue()
                    self.assertIn(channel, log)
                    self.assertIn(diagnostic, log)
                    self.assertEqual(len(log.splitlines()), 1)
                    for private in (WEBHOOK, TOKEN, CHAT, PRIVATE_DETAIL, 'FORGED LOG ROW'):
                        self.assertNotIn(private, log)

    def test_cli_returns_failure_if_any_enabled_channel_fails(self):
        cases = [
            ((WEBHOOK, TOKEN, CHAT), {'discord': False, 'telegram': False}),
            ((WEBHOOK, TOKEN, CHAT), {'discord': True, 'telegram': False}),
            ((WEBHOOK, TOKEN, CHAT), {'discord': False, 'telegram': True}),
            ((WEBHOOK, None, None), {'discord': False, 'telegram': False}),
            ((None, TOKEN, CHAT), {'discord': False, 'telegram': False}),
        ]
        for credentials, outcomes in cases:
            with self.subTest(credentials=credentials, outcomes=outcomes), \
                 patch('alerts.notifier.get_credentials', return_value=credentials), \
                 patch('alerts.notifier.notify_scan_event', return_value=outcomes), \
                 patch('sys.stdout', io.StringIO()):
                self.assertEqual(notifier.main(), 1)

    def test_cli_disabled_channel_is_not_a_delivery_failure(self):
        for credentials, outcomes in [
            ((WEBHOOK, None, None), {'discord': True, 'telegram': False}),
            ((None, TOKEN, CHAT), {'discord': False, 'telegram': True}),
        ]:
            with self.subTest(credentials=credentials):
                stdout = io.StringIO()
                with patch('alerts.notifier.get_credentials', return_value=credentials), \
                     patch('alerts.notifier.notify_scan_event', return_value=outcomes), \
                     patch('sys.stdout', stdout):
                    self.assertEqual(notifier.main(), 0)
                self.assertNotIn('THẤT BẠI', stdout.getvalue())
                self.assertIn('BỎ QUA', stdout.getvalue())

    def test_cli_incomplete_configuration_exits_before_delivery(self):
        for credentials in [(None, None, None), (None, TOKEN, None), (None, None, CHAT)]:
            with self.subTest(credentials=credentials), \
                 patch('alerts.notifier.get_credentials', return_value=credentials), \
                 patch('alerts.notifier.notify_scan_event') as notify, \
                 patch('sys.stdout', io.StringIO()):
                self.assertEqual(notifier.main(), 2)
                notify.assert_not_called()

    @patch('alerts.notifier.get_credentials', return_value=(WEBHOOK, TOKEN, CHAT))
    @patch('alerts.notifier.notify_scan_event', return_value={'discord': True, 'telegram': True})
    def test_cli_success_requires_all_enabled_channels(self, notify, credentials):
        with patch('sys.stdout', io.StringIO()):
            self.assertEqual(notifier.main(), 0)
        notify.assert_called_once()

    def test_transport_failure_retries_only_failed_channel_after_state_reload(self):
        requests = []

        def respond(request, timeout):
            requests.append(request)
            if request.full_url == WEBHOOK:
                return Response(204)
            if len(requests) == 2:
                raise urllib.error.URLError(f'{request.full_url} {PRIVATE_DETAIL}')
            return Response(200, b'{"ok": true}')

        with tempfile.TemporaryDirectory() as directory:
            state_file = Path(directory) / 'monitor.state.json'
            stderr = io.StringIO()
            with patch('alerts.notifier.get_credentials', return_value=(WEBHOOK, TOKEN, CHAT)), \
                 patch('alerts.notifier.urllib.request.urlopen', side_effect=respond), \
                 patch('scanner.scan.time.time', return_value=1000), \
                 patch('sys.stdout', io.StringIO()), patch('sys.stderr', stderr):
                self.assertEqual(evaluate_diff_and_notify(
                    '127.0.0.1', [80], 0.1, state_file, {}, port_results={80: 'open'}),
                    'INITIAL_SCAN')
                saved = load_state(state_file)['127.0.0.1']
                self.assertEqual(saved['baseline_open_ports'], [80])
                self.assertEqual(saved['pending_alerts'][0]['channels'], ['telegram'])
                self.assertEqual(saved['pending_alerts'][0]['attempts'], 1)
                self.assertEqual(saved['pending_alerts'][0]['next_attempt_at'], 1010)
                # A fresh call reloads the durable outbox, as after process restart.
                with patch('scanner.scan.time.time', return_value=1011):
                    self.assertEqual(evaluate_diff_and_notify(
                        '127.0.0.1', [80], 0.1, state_file, {}, port_results={80: 'open'}),
                        'NO_CHANGE')
                self.assertEqual(load_state(state_file)['127.0.0.1']['pending_alerts'], [])
            self.assertEqual([request.full_url == WEBHOOK for request in requests], [True, False, False])
            first_telegram = json.loads(requests[1].data)
            retry_telegram = json.loads(requests[2].data)
            self.assertEqual(first_telegram, retry_telegram)
            self.assertIn(saved['pending_alerts'][0]['id'], retry_telegram['text'])
            self.assertNotIn(TOKEN, stderr.getvalue())
            self.assertNotIn(PRIVATE_DETAIL, stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
