"""Loopback and simulated-delivery checks; never sends real chat messages."""
import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

from scanner.scan import evaluate_diff_and_notify, scan_ports_parallel
from scanner.state_store import load_state, save_state, state_lock
from alerts.notifier import notify_scan_event


class ReliabilityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.state = Path(self.temporary.name) / 'monitor.state.json'

    def scan(self, results, no_alert=True):
        return evaluate_diff_and_notify('127.0.0.1', [p for p, status in results.items() if status == 'open'],
            0.1, self.state, {}, no_alert=no_alert, scanned_ports=list(results), port_results=results)

    def test_real_listener_lifecycle(self):
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            listener.listen()
            port = listener.getsockname()[1]
            self.assertEqual(self.scan(scan_ports_parallel('127.0.0.1', [port], 0.2)), 'INITIAL_SCAN')
            self.assertEqual(self.scan(scan_ports_parallel('127.0.0.1', [port], 0.2)), 'NO_CHANGE')
        result = scan_ports_parallel('127.0.0.1', [port], 0.3)
        self.assertNotEqual(result[port], 'open')
        # Some host firewalls drop probes after listener shutdown. Do not call
        # that a confirmed close just to make a test pass.
        self.assertEqual(self.scan(result), 'PORT_CLOSED' if result[port] == 'closed' else 'SCAN_UNCERTAIN')

    def test_confirmed_refusal_removes_port(self):
        self.scan({80: 'open'})
        self.assertEqual(self.scan({80: 'closed'}), 'PORT_CLOSED')
        self.assertEqual(load_state(self.state)['127.0.0.1']['baseline_open_ports'], [])

    def test_new_port_and_unscanned_ports(self):
        self.scan({80: 'open'})
        self.assertEqual(self.scan({8080: 'open'}), 'NEW_PORT_DETECTED')
        self.assertEqual(load_state(self.state)['127.0.0.1']['baseline_open_ports'], [80, 8080])

    def test_timeout_is_uncertain_not_closed_and_recovery_is_not_new_port(self):
        self.scan({80: 'open'})
        self.assertEqual(self.scan({80: 'filtered'}), 'SCAN_UNCERTAIN')
        self.assertEqual(load_state(self.state)['127.0.0.1']['baseline_open_ports'], [80])
        self.assertEqual(self.scan({80: 'filtered'}), 'NO_CHANGE')
        self.assertEqual(self.scan({80: 'open'}), 'SCAN_RECOVERED')

    def test_initial_outage_does_not_establish_false_empty_baseline(self):
        self.assertEqual(self.scan({80: 'filtered'}), 'SCAN_UNCERTAIN')
        self.assertFalse(load_state(self.state)['127.0.0.1']['baseline_initialized'])
        self.assertEqual(self.scan({80: 'open'}), 'INITIAL_SCAN')

    @patch('scanner.scan.configured_alert_channels', return_value=['discord', 'telegram'])
    @patch('scanner.scan.notify_scan_event')
    def test_failed_channel_persists_across_restart_without_resending_success(self, notify, channels):
        notify.return_value = {'discord': True, 'telegram': False}
        self.scan({80: 'open'}, no_alert=False)
        saved = load_state(self.state)
        pending = saved['127.0.0.1']['pending_alerts']
        self.assertEqual(pending[0]['channels'], ['telegram'])
        self.scan({80: 'open'}, no_alert=False)
        self.assertEqual(notify.call_count, 1, 'Backoff must suppress immediate retry')
        pending[0]['next_attempt_at'] = 0
        save_state(self.state, saved)
        notify.return_value = {'telegram': True}
        self.scan({80: 'open'}, no_alert=False)
        self.assertEqual(notify.call_args.kwargs['channels'], ['telegram'])
        self.assertEqual(load_state(self.state)['127.0.0.1']['pending_alerts'], [])

    @patch('scanner.scan.configured_alert_channels', return_value=['telegram'])
    @patch('scanner.scan.notify_scan_event', return_value={'telegram': True})
    def test_simultaneous_open_close_delivers_both_events(self, notify, channels):
        self.scan({80: 'open'})
        self.scan({80: 'closed', 8080: 'open'}, no_alert=False)
        self.assertEqual([call.kwargs['event_type'] for call in notify.call_args_list], ['NEW_PORT_DETECTED', 'PORT_CLOSED'])

    def test_corrupt_state_is_preserved_and_rejected(self):
        self.state.write_text('{broken', encoding='utf-8')
        with self.assertRaises(json.JSONDecodeError):
            self.scan({80: 'open'})
        self.assertEqual(self.state.read_text(), '{broken')

    def test_atomic_replace_failure_preserves_previous_baseline(self):
        self.scan({80: 'open'})
        before = self.state.read_bytes()
        with patch('scanner.state_store.os.replace', side_effect=OSError('simulated disk failure')):
            with self.assertRaises(OSError):
                self.scan({80: 'closed'})
        self.assertEqual(self.state.read_bytes(), before)

    def test_single_writer_lock_releases_after_failure(self):
        with state_lock(self.state):
            with self.assertRaises(OSError):
                with state_lock(self.state):
                    self.fail('A second writer must not enter')
        with state_lock(self.state):
            pass

    @patch('scanner.scan.configured_alert_channels', return_value=['telegram'])
    @patch('scanner.scan.notify_scan_event', return_value={'telegram': False})
    def test_full_outbox_does_not_advance_baseline(self, notify, channels):
        self.scan({80: 'open'})
        state = load_state(self.state)
        state['127.0.0.1']['pending_alerts'] = [{
            'id': str(i), 'channels': ['telegram'], 'attempts': 0, 'next_attempt_at': 0,
            'payload': {'event_type': 'INITIAL_SCAN', 'target_host': '127.0.0.1', 'open_ports': [80]},
        } for i in range(100)]
        save_state(self.state, state)
        with self.assertRaises(RuntimeError):
            self.scan({80: 'open', 8080: 'open'}, no_alert=False)
        saved = load_state(self.state)['127.0.0.1']
        self.assertEqual(saved['baseline_open_ports'], [80])
        self.assertEqual(len(saved['pending_alerts']), 100)
        self.assertEqual(notify.call_count, 2)
        self.assertEqual(saved['pending_alerts'][0]['attempts'], 1)

    @patch('scanner.scan.configured_alert_channels', return_value=['telegram'])
    @patch('scanner.scan.notify_scan_event', return_value={'telegram': True})
    def test_full_outbox_recovers_without_losing_new_change(self, notify, channels):
        self.scan({80: 'open'})
        state = load_state(self.state)
        state['127.0.0.1']['pending_alerts'] = [{
            'id': str(i), 'channels': ['telegram'], 'attempts': 0, 'next_attempt_at': 0,
            'payload': {'event_type': 'INITIAL_SCAN', 'target_host': '127.0.0.1', 'open_ports': [80]},
        } for i in range(100)]
        save_state(self.state, state)
        self.assertEqual(self.scan({80: 'open', 8080: 'open'}, no_alert=False), 'NEW_PORT_DETECTED')
        saved = load_state(self.state)['127.0.0.1']
        self.assertEqual(notify.call_count, 2, 'Recovery must share the two-event scan budget')
        self.assertEqual(saved['baseline_open_ports'], [80, 8080])
        self.assertEqual(len(saved['pending_alerts']), 99)
        self.assertEqual(saved['pending_alerts'][-1]['payload']['new_ports'], [8080])

    @patch('alerts.notifier.get_credentials', return_value=('unused-discord', 'unused-token', 'unused-chat'))
    @patch('alerts.notifier.send_discord_alert')
    @patch('alerts.notifier.send_telegram_alert', return_value=True)
    def test_retry_format_preserves_discovery_time_and_sends_only_selected_channel(self, telegram, discord, credentials):
        result = notify_scan_event('SCAN_UNCERTAIN', '127.0.0.1', [80], channels=['telegram'],
                                   event_id='test-event-id', detected_at='2026-10-25T00:00:00+00:00')
        self.assertTrue(result['telegram'])
        discord.assert_not_called()
        self.assertIn('test-event-id', telegram.call_args.kwargs['markdown_text'])
        self.assertIn('2026-10-25T00:00:00+00:00', telegram.call_args.kwargs['markdown_text'])


if __name__ == '__main__':
    unittest.main()
