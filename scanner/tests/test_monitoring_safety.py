"""Regression cases for monitoring failures; all delivery is simulated."""
import io
import json
import os
import socket
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scanner.scan import evaluate_diff_and_notify, main
from scanner.state_store import load_state, save_state, write_audit
from alerts import bot_listener
from alerts.notifier import notify_scan_event
from scanner.risk_matrix import calculate_system_posture


class FailedAuditStream(io.StringIO):
    def write(self, value):
        raise OSError('simulated audit disk failure')


class MonitoringSafetyTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.state = Path(temporary.name) / 'monitor.state.json'

    def observe(self, ports, no_alert=True):
        return evaluate_diff_and_notify('127.0.0.1', ports, 0.1, self.state, {},
            no_alert=no_alert, scanned_ports=ports, port_results={p: 'open' for p in ports})

    @patch('scanner.scan.configured_alert_channels', return_value=['telegram'])
    @patch('scanner.scan.notify_scan_event', return_value={'telegram': True})
    def test_backoff_events_do_not_block_a_new_due_alert(self, notify, channels):
        self.observe([80])
        state = load_state(self.state)
        state['127.0.0.1']['pending_alerts'] = [{
            'id': f'old-{i}', 'channels': ['telegram'], 'attempts': 1,
            'next_attempt_at': 9999999999,
            'payload': {'event_type': 'INITIAL_SCAN', 'target_host': '127.0.0.1',
                        'open_ports': [80], 'new_ports': [], 'closed_ports': [],
                        'scan_duration': 0.1, 'banners': {}},
        } for i in range(2)]
        save_state(self.state, state)
        self.observe([80, 8080], no_alert=False)
        notify.assert_called_once()
        self.assertEqual(notify.call_args.kwargs['event_type'], 'NEW_PORT_DETECTED')
        self.assertEqual(len(load_state(self.state)['127.0.0.1']['pending_alerts']), 2)

    def test_audit_write_failure_is_not_silently_successful(self):
        with patch('scanner.state_store.RotatingFileHandler._open', side_effect=FailedAuditStream):
            with self.assertRaises(OSError):
                write_audit(self.state, target='127.0.0.1', event='NO_CHANGE', exit_status=0)

    def test_malformed_pending_state_is_rejected_without_advancing_baseline(self):
        for pending in [None, 'broken', [{'id': 'missing-fields'}]]:
            with self.subTest(pending=pending):
                self.state.write_text(json.dumps({'127.0.0.1': {
                    'baseline_open_ports': [80], 'pending_alerts': pending,
                }}), encoding='utf-8')
                before = self.state.read_bytes()
                with self.assertRaises(ValueError):
                    self.observe([80, 8080])
                self.assertEqual(self.state.read_bytes(), before)

    @patch('alerts.bot_listener.send_telegram_alert')
    @patch('alerts.bot_listener.subprocess.run')
    def test_command_without_authenticated_sender_is_rejected(self, run, send):
        bot_listener.handle_command('unused-token', 'untrusted-chat', '/scan 127.0.0.1')
        run.assert_not_called()
        send.assert_not_called()

    @patch.dict(os.environ, {'TELEGRAM_ALLOWED_USER_IDS': '123', 'SCANNER_ALLOWED_TARGETS': '127.0.0.1',
                             'SCANNER_TARGET': '127.0.0.1'}, clear=True)
    @patch('alerts.bot_listener.get_credentials', return_value=(None, 'unused-token', 'trusted-chat'))
    @patch('alerts.bot_listener.send_telegram_alert')
    @patch('alerts.bot_listener.subprocess.run')
    def test_only_allowed_chat_and_sender_can_scan(self, run, send, credentials):
        for chat, sender in [('wrong-chat', 123), ('trusted-chat', 456), ('trusted-chat', None)]:
            bot_listener.handle_command('unused-token', chat, '/scan 127.0.0.1', user_id=sender)
        run.assert_not_called()
        send.assert_not_called()
        run.return_value.returncode = 0
        run.return_value.stdout = '[EVENT: NO_CHANGE]'
        bot_listener.handle_command('unused-token', 'trusted-chat', '/scan 127.0.0.1 80,443', user_id=123)
        self.assertEqual(run.call_count, 1)
        command = run.call_args.args[0]
        self.assertEqual(command[2], '127.0.0.1')
        self.assertEqual(command[-2:], ['--ports', '80,443'])

    @patch.dict(os.environ, {'TELEGRAM_ALLOWED_USER_IDS': '123', 'SCANNER_ALLOWED_TARGETS': '127.0.0.1'}, clear=True)
    @patch('alerts.bot_listener.get_credentials', return_value=(None, 'unused-token', 'trusted-chat'))
    @patch('alerts.bot_listener.send_telegram_alert')
    @patch('alerts.bot_listener.subprocess.run')
    def test_remote_targets_hostnames_and_large_scans_are_rejected(self, run, send, credentials):
        for command in ['/scan 192.0.2.1', '/scan localhost', '/scan 127.0.0.1 1-65535',
                        '/scan 127.0.0.1 0', '/scan 127.0.0.1 80 ignored']:
            bot_listener.handle_command('unused-token', 'trusted-chat', command, user_id=123)
        run.assert_not_called()
        self.assertEqual(send.call_count, 5)

    @patch.dict(os.environ, {'TELEGRAM_ALLOWED_USER_IDS': '123'}, clear=True)
    @patch('alerts.bot_listener.get_credentials', return_value=(None, 'unused-token', 'trusted-chat'))
    @patch('alerts.bot_listener.answer_callback_query')
    @patch('alerts.bot_listener.handle_command')
    def test_callbacks_use_the_same_sender_boundary(self, command, answer, credentials):
        for chat, sender in [('wrong-chat', 123), ('trusted-chat', 456), ('trusted-chat', None)]:
            bot_listener.handle_callback_query('unused-token', {
                'id': 'query', 'data': 'scan_default', 'from': {'id': sender},
                'message': {'chat': {'id': chat}},
            })
        command.assert_not_called()
        answer.assert_not_called()
        bot_listener.handle_callback_query('unused-token', {
            'id': 'query', 'data': 'scan_default', 'from': {'id': 123},
            'message': {'chat': {'id': 'trusted-chat'}},
        })
        command.assert_called_once_with('unused-token', 'trusted-chat', '/scan', user_id=123)

    def test_invalid_retry_metadata_preserves_entire_state(self):
        payload = {'event_type': 'INITIAL_SCAN', 'target_host': '127.0.0.1', 'open_ports': [80]}
        valid = {'id': 'test', 'channels': ['telegram'], 'attempts': 0, 'next_attempt_at': 0, 'payload': payload}
        for fields in [{'next_attempt_at': float('nan')}, {'attempts': -1}, {'channels': ['unknown']},
                       {'payload': {**payload, 'event_type': []}}, {'payload': {**payload, 'open_ports': [True]}}]:
            self.state.write_text(json.dumps({'127.0.0.1': {
                'baseline_open_ports': [80], 'pending_alerts': [{**valid, **fields}],
            }}), encoding='utf-8')
            before = self.state.read_bytes()
            with self.assertRaises(ValueError):
                self.observe([80, 8080])
            self.assertEqual(self.state.read_bytes(), before)

    def test_legacy_baseline_without_outbox_still_loads(self):
        self.state.write_text(json.dumps({'127.0.0.1': {'baseline_open_ports': [80]}}), encoding='utf-8')
        self.assertEqual(self.observe([80]), 'NO_CHANGE')

    def test_watch_recovers_after_dns_failure_and_audits_both_runs(self):
        with patch('scanner.scan.socket.gethostbyname', side_effect=[socket.gaierror('simulated'), '127.0.0.1']), \
             patch('scanner.scan.scan_ports_parallel', return_value={80: 'open'}), \
             patch('scanner.scan.generate_html_report', return_value=self.state.parent / 'latest.html'), \
             patch('scanner.scan.time.sleep', side_effect=[None, KeyboardInterrupt]):
            status = main(['owned-test.invalid', '--ports', '80', '--state-file', str(self.state),
                           '--no-alert', '--no-banner', '--watch', '1'])
        self.assertEqual(status, 0)
        self.assertEqual(load_state(self.state)['owned-test.invalid']['baseline_open_ports'], [80])
        rows = [json.loads(line) for line in Path(str(self.state) + '.audit.log').read_text().splitlines()]
        self.assertEqual([row['event'] for row in rows], ['DNS_FAILED', 'INITIAL_SCAN'])
        self.assertEqual([row['exit_status'] for row in rows], [2, 0])

    def test_scan_returns_failure_when_audit_disk_write_fails(self):
        with patch('scanner.scan.socket.gethostbyname', return_value='127.0.0.1'), \
             patch('scanner.scan.scan_ports_parallel', return_value={80: 'closed'}), \
             patch('scanner.scan.generate_html_report', return_value=self.state.parent / 'latest.html'), \
             patch('scanner.state_store.RotatingFileHandler._open', side_effect=FailedAuditStream):
            self.assertEqual(main(['127.0.0.1', '--ports', '80', '--state-file', str(self.state),
                                   '--no-alert', '--no-banner']), 2)

    def test_unknown_port_is_not_reported_as_only_public_web_ports(self):
        posture = calculate_system_posture([80, 23456])
        self.assertEqual(posture['highest_severity'], 'LOW')
        self.assertNotIn('80/443', posture['summary'])
        self.assertNotIn('AN TOÀN', calculate_system_posture([])['status'])

    @patch('alerts.notifier.get_credentials', return_value=(None, 'unused-token', 'unused-chat'))
    @patch('alerts.notifier.send_telegram_alert', return_value=True)
    def test_closed_port_alert_does_not_claim_remaining_database_is_safe(self, send, credentials):
        notify_scan_event('PORT_CLOSED', '127.0.0.1', [5432], closed_ports=[8080], channels=['telegram'])
        message = send.call_args.kwargs['markdown_text']
        self.assertIn('5432', message)
        self.assertNotIn('trở về trạng thái an toàn', message)
        self.assertNotIn('Cổng còn mở an toàn', message)

    @patch('alerts.bot_listener._setting', return_value='')
    @patch('alerts.bot_listener.get_credentials', return_value=(None, 'unused-token', 'trusted-chat'))
    @patch('alerts.bot_listener.register_bot_commands')
    @patch('alerts.bot_listener.send_telegram_alert')
    def test_listener_missing_sender_allowlist_fails_before_any_network_call(self, send, register, credentials, setting):
        self.assertEqual(bot_listener.run_listener(), 2)
        register.assert_not_called()
        send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
