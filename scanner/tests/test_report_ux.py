"""Report/error-page and ChatOps UX regressions; no network or real credentials."""
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from alerts import bot_listener, notifier
from scanner import reporter


class ReportPageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.patch = patch.object(reporter, 'REPORTS_DIR', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_uncertain_scan_is_not_reported_as_no_open_ports(self):
        output = reporter.generate_html_report(
            target_host='127.0.0.1', target_ip='127.0.0.1',
            port_results={80: 'filtered', 443: 'closed'},
            banners={}, scan_duration=0.1, event_type='SCAN_UNCERTAIN',
        )
        html = output.read_text(encoding='utf-8')
        self.assertIn('Kết quả quét chưa đầy đủ', html)
        self.assertIn('timeout/filtered', html)
        self.assertIn('80', html)
        self.assertNotIn('Không quan sát thấy cổng mở', html)
        self.assertIn('Không kết luận', html)

    def test_clean_scan_keeps_a_limitations_section(self):
        output = reporter.generate_html_report(
            target_host='127.0.0.1', target_ip='127.0.0.1',
            port_results={80: 'closed'}, banners={}, scan_duration=0.1,
        )
        html = output.read_text(encoding='utf-8')
        self.assertIn('Cách đọc kết quả', html)
        self.assertIn('Không đưa báo cáo này lên Internet', html)
        self.assertIn('Không quan sát thấy cổng mở', html)
        self.assertIn('Đây không phải kiểm thử toàn diện', html)

    def test_error_report_replaces_latest_and_never_claims_safety(self):
        (self.root / 'latest.html').write_text('stale report', encoding='utf-8')
        output = reporter.generate_error_report(
            '127.0.0.1', 'ConnectionRefusedError: simulated',
            target_ip='127.0.0.1', event_type='SCAN_FAILED',
        )
        html = output.read_text(encoding='utf-8')
        self.assertIn('Không thể hoàn tất lần quét', html)
        self.assertIn('ConnectionRefusedError: simulated', html)
        self.assertIn('Không kết luận mục tiêu đã đóng cổng', html)
        self.assertNotIn('stale report', html)
        markdown = (self.root / 'latest.md').read_text(encoding='utf-8')
        self.assertIn('Báo cáo quét thất bại', markdown)
        self.assertIn('ConnectionRefusedError', markdown)

    def test_error_report_escapes_hostile_text(self):
        output = reporter.generate_error_report(
            '<script>alert(1)</script>', '<img src=x onerror=alert(1)>',
        )
        html = output.read_text(encoding='utf-8')
        self.assertNotIn('<script>alert(1)</script>', html)
        self.assertNotIn('<img src=x', html)
        self.assertIn('&lt;script&gt;', html)


class ChatOpsUxTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.allow = patch.multiple(
            bot_listener,
            _authorized_sender=lambda *_: True,
            _state_file=lambda: self.root / 'state.json',
            reports_dir=lambda: self.root / 'reports',
        )
        self.allow.start()
        self.addCleanup(self.allow.stop)

    def test_help_exposes_report_and_menu(self):
        text = bot_listener._help_text()
        self.assertIn('/report', text)
        self.assertIn('/status', text)
        self.assertIn('timeout/filtered', text)

    def test_keyboard_offers_status_and_report(self):
        callbacks = {button.get('callback_data') for row in bot_listener._keyboard() for button in row}
        self.assertIn('status', callbacks)
        self.assertIn('report', callbacks)
        self.assertIn('scan_default', callbacks)

    @patch('alerts.bot_listener.send_telegram_alert')
    def test_report_without_files_explains_next_step(self, send):
        bot_listener.handle_command('unused-token', 'trusted-chat', '/report', user_id=123)
        text = send.call_args.args[2]
        self.assertIn('Chưa có báo cáo', text)
        self.assertIn('/scan', text)

    @patch('alerts.bot_listener.send_telegram_document', return_value=True)
    def test_report_sends_both_latest_files(self, send_document):
        reports = self.root / 'reports'
        reports.mkdir()
        (reports / 'latest.html').write_text('<html></html>', encoding='utf-8')
        (reports / 'latest.md').write_text('# report', encoding='utf-8')
        bot_listener.handle_command('unused-token', 'trusted-chat', '/report', user_id=123)
        sent = [call.args[2].name for call in send_document.call_args_list]
        self.assertEqual(sent, ['latest.html', 'latest.md'])

    @patch('alerts.bot_listener.send_telegram_alert', return_value=False)
    @patch('alerts.bot_listener.send_telegram_document', return_value=False)
    def test_report_delivery_failure_points_at_local_file(self, send_document, send_alert):
        reports = self.root / 'reports'
        reports.mkdir()
        (reports / 'latest.html').write_text('<html></html>', encoding='utf-8')
        bot_listener.handle_command('unused-token', 'trusted-chat', '/report', user_id=123)
        text = send_alert.call_args.args[2]
        self.assertIn('Không gửi được file báo cáo', text)
        self.assertIn('latest.html', text)

    @patch('alerts.bot_listener.send_telegram_alert')
    def test_status_summarizes_risk_and_uncertain_ports(self, send):
        (self.root / 'state.json').write_text(json.dumps({
            '127.0.0.1': {
                'baseline_open_ports': [80],
                'uncertain_ports': [443],
                'pending_alerts': [],
                'last_scan_at': '2026-11-09T00:00:00Z',
            },
        }), encoding='utf-8')
        bot_listener.handle_command('unused-token', 'trusted-chat', '/status', user_id=123)
        text = send.call_args.args[2]
        self.assertIn('Đánh giá', text)
        self.assertIn('Cổng đang mở', text)
        self.assertIn('Timeout/filtered', text)
        self.assertIn('443', text)
        self.assertIn('Không thấy cổng mở không đồng nghĩa', text)

    @patch('alerts.bot_listener.answer_callback_query')
    @patch('alerts.bot_listener.handle_command')
    def test_report_callback_reuses_command_boundary(self, command, answer):
        bot_listener.handle_callback_query('unused-token', {
            'id': 'query', 'data': 'report', 'from': {'id': 123},
            'message': {'chat': {'id': 'trusted-chat'}},
        })
        command.assert_called_once_with('unused-token', 'trusted-chat', '/report', user_id=123)

    @patch('alerts.bot_listener.answer_callback_query')
    @patch('alerts.bot_listener.handle_command')
    def test_all_action_buttons_dispatch_to_existing_commands(self, command, answer):
        actions = {
            'scan_default': '/scan', 'scan_local': '/scan',
            'scan_web': '/scan 80,443,8080', 'scan_db': '/scan 5432,3306,6379',
            'status': '/status', 'report': '/report', 'ping': '/ping',
            'help': '/help', 'menu': '/help', 'start': '/help',
        }
        for action, text in actions.items():
            with self.subTest(action=action):
                command.reset_mock()
                bot_listener.handle_callback_query('unused-token', {
                    'id': 'query', 'data': action, 'from': {'id': 123},
                    'message': {'chat': {'id': 'trusted-chat'}},
                })
                command.assert_called_once_with('unused-token', 'trusted-chat', text, user_id=123)

    def _scan(self, stdout, *, returncode=0, stderr=''):
        with patch('alerts.bot_listener._scan_target', return_value='127.0.0.1'), \
             patch('alerts.bot_listener.subprocess.run', return_value=SimpleNamespace(
                 returncode=returncode, stdout=stdout, stderr=stderr,
             )), patch('alerts.bot_listener.send_telegram_alert') as send:
            bot_listener.handle_command('unused-token', 'trusted-chat', '/scan', user_id=123)
            return send.call_args.args[2]

    def test_scan_summary_parses_count_and_list_without_stray_brackets(self):
        text = self._scan(
            'Thời gian quét : 0.02s | Cổng đang mở (3): [3000, 5173, 55432]\n'
            'Đánh giá rủi ro : Xếp hạng [D] - RỦI RO ĐÁNG KỂ (HIGH) (Max Risk score: 7.5)\n'
            '[EVENT: NO_CHANGE] uncertain=[]; pending_alerts=0\n'
        )
        self.assertIn('Cổng đang mở: `3000, 5173, 55432`', text)
        self.assertNotIn('3):', text)
        self.assertNotIn('Max Risk score', text)
        self.assertIn('không phải kết luận hết lỗ hổng', text)
        self.assertNotIn('━', text)

    def test_scan_with_no_open_ports_displays_no_ports(self):
        text = self._scan('Thời gian quét : 0.02s | Cổng đang mở (0): Không có\n'
                          '[EVENT: NO_CHANGE] uncertain=[]; pending_alerts=0\n')
        self.assertIn('Cổng đang mở: `Không có`', text)

    def test_exit_one_with_filtered_ports_is_a_result_not_a_failure(self):
        text = self._scan('Thời gian quét : 1.02s | Cổng đang mở (1): [3000]\n'
                          '[EVENT: SCAN_UNCERTAIN] uncertain=[80, 443]; pending_alerts=0\n', returncode=1)
        self.assertIn('kết quả chưa đầy đủ', text)
        self.assertIn('80, 443', text)
        self.assertNotIn('Không quét được', text)

    def test_exit_one_with_pending_delivery_does_not_invent_filtered_ports(self):
        text = self._scan('[EVENT: NO_CHANGE] uncertain=[]; pending_alerts=1\n', returncode=1)
        self.assertIn('Cảnh báo chờ gửi: 1', text)
        self.assertNotIn('kết quả chưa đầy đủ', text)
        self.assertNotIn('có cổng timeout/filtered', text)

    @patch('alerts.bot_listener.register_bot_commands')
    @patch('alerts.bot_listener.get_credentials', return_value=(None, 'unused-token', 'trusted-chat'))
    @patch('alerts.bot_listener._setting', return_value='123')
    @patch('alerts.bot_listener.verify_bot_credentials', return_value='Telegram từ chối token (HTTP 401).')
    @patch('alerts.bot_listener.send_telegram_alert')
    def test_invalid_token_stops_before_menu_sync_or_ready_message(self, send, verify, setting, credentials, register):
        self.assertEqual(bot_listener.run_listener(), 2)
        register.assert_not_called()
        send.assert_not_called()

    def test_verify_bot_credentials_rejects_bad_json_without_raising(self):
        with patch('alerts.bot_listener.urllib.request.urlopen') as urlopen:
            response = urlopen.return_value.__enter__.return_value
            response.read.return_value = b'{\"ok\": false}'
            self.assertIn('không chấp nhận token', bot_listener.verify_bot_credentials('unused-token'))

    def test_failed_scan_sends_last_error_not_raw_stdout(self):
        text = self._scan('[>] Bắt đầu quét\nRAW PORT TABLE\n[-] Không ghi được báo cáo\n',
                          returncode=2, stderr='[-] Monitoring failure: state locked\n')
        self.assertIn('Monitoring failure: state locked', text)
        self.assertNotIn('RAW PORT TABLE', text)
        self.assertNotIn('Bắt đầu quét', text)


class DocumentDeliveryTests(unittest.TestCase):
    def test_missing_document_is_rejected_without_network(self):
        with patch('alerts.notifier.urllib.request.urlopen') as urlopen:
            self.assertFalse(notifier.send_telegram_document(
                'unused-token', 'unused-chat', Path('does-not-exist.html'),
            ))
        urlopen.assert_not_called()

    @patch('alerts.notifier.urllib.request.urlopen')
    def test_document_upload_uses_multipart_and_reports_ok(self, urlopen):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        document = Path(temporary.name) / 'latest.html'
        document.write_text('<html></html>', encoding='utf-8')
        response = urlopen.return_value.__enter__.return_value
        response.read.return_value = b'{"ok": true}'
        self.assertTrue(notifier.send_telegram_document(
            'unused-token', 'unused-chat', document, caption='report',
            buttons=[[{'text': 'Status', 'callback_data': 'status'}]],
        ))
        request = urlopen.call_args.args[0]
        self.assertIn('/sendDocument', request.full_url)
        self.assertIn('multipart/form-data', request.headers['Content-type'])
        self.assertIn(b'latest.html', request.data)
        self.assertIn(b'parse_mode', request.data)
        self.assertIn(b'callback_data', request.data)


class AlertPayloadTests(unittest.TestCase):
    @patch('alerts.notifier.get_credentials', return_value=(None, 'unused-token', 'unused-chat'))
    @patch('alerts.notifier.send_telegram_alert', return_value=True)
    def test_uncertain_alert_lists_filtered_ports_and_actions(self, send, credentials):
        notifier.notify_scan_event(
            'SCAN_UNCERTAIN', '127.0.0.1', [80], uncertain_ports=[443],
            channels=['telegram'],
        )
        text = send.call_args.kwargs['markdown_text']
        self.assertIn('443/tcp', text)
        self.assertIn('Không suy ra', text)
        callbacks = {
            button.get('callback_data')
            for row in send.call_args.kwargs['buttons'] for button in row
        }
        self.assertIn('report', callbacks)

    @patch('alerts.notifier.get_credentials', return_value=('https://example.invalid', None, None))
    @patch('alerts.notifier.send_discord_alert', return_value=True)
    def test_discord_embed_reports_uncertain_ports(self, send, credentials):
        notifier.notify_scan_event(
            'SCAN_UNCERTAIN', '127.0.0.1', [80], uncertain_ports=[443],
            channels=['discord'],
        )
        fields = {field['name']: field['value'] for field in send.call_args.kwargs['fields']}
        self.assertIn('443', fields['Cổng chưa xác định'])
        self.assertIn('Không suy ra', send.call_args.kwargs['description'])

    @patch('alerts.notifier.urllib.request.urlopen')
    def test_discord_enables_link_buttons_preserves_thread_and_disables_mentions(self, urlopen):
        from urllib.parse import parse_qs, urlsplit
        urlopen.return_value.__enter__.return_value.status = 200
        self.assertTrue(notifier.send_discord_alert(
            'https://example.invalid/api/webhooks/id/token?thread_id=123&wait=false',
            'Test', 'Test description', 0x3498DB,
        ))
        request = urlopen.call_args.args[0]
        query = parse_qs(urlsplit(request.full_url).query)
        self.assertEqual(query['with_components'], ['true'])
        self.assertEqual(query['wait'], ['true'])
        self.assertEqual(query['thread_id'], ['123'])
        payload = json.loads(request.data)
        self.assertEqual(payload['allowed_mentions'], {'parse': []})
        buttons = payload['components'][0]['components']
        self.assertEqual([button['label'] for button in buttons], ['AWS Security Group', 'OWASP A05'])
        self.assertTrue(all(button['style'] == 5 and 'url' in button for button in buttons))


if __name__ == '__main__':
    unittest.main()
