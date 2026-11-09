"""Pending alerts must keep progressing during DNS outages; no real network I/O."""
import copy
import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

from scanner.scan import main
from scanner.state_store import load_state, save_state, state_lock


class DnsAlertRecoveryTests(unittest.TestCase):
    target = 'owned-test.invalid'

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.state = Path(temporary.name) / 'monitor.state.json'

    def event(self, event_id, *, channels=None, next_attempt_at=0):
        return {
            'id': event_id,
            'channels': channels or ['discord', 'telegram'],
            'attempts': 0,
            'next_attempt_at': next_attempt_at,
            'payload': {
                'event_type': 'NEW_PORT_DETECTED', 'target_host': self.target,
                'open_ports': [80, 5432], 'new_ports': [5432], 'closed_ports': [],
                'scan_duration': 0.1, 'banners': {}, 'event_id': event_id,
                'detected_at': '2026-11-09T00:00:00+00:00',
            },
        }

    def seed(self, events):
        record = {
            'baseline_open_ports': [80, 5432], 'baseline_initialized': True,
            'uncertain_ports': [8080], 'last_scan_at': '2026-11-09T00:00:00+00:00',
            'pending_alerts': events,
        }
        state = {self.target: record, '127.0.0.1': {'baseline_open_ports': [22]}}
        save_state(self.state, state)
        return copy.deepcopy(state)

    def run_dns_failure(self, *extra):
        with patch('scanner.scan.socket.gethostbyname', side_effect=socket.gaierror('simulated DNS outage')), \
             patch('scanner.scan.scan_ports_parallel') as probe, \
             patch('scanner.scan.generate_html_report') as report:
            status = main([self.target, '--ports', '80', '--state-file', str(self.state),
                           '--no-banner', *extra])
        self.assertEqual(status, 2, 'DNS failure must remain a failed scan even after delivery succeeds')
        probe.assert_not_called()
        report.assert_not_called()

    def audit(self):
        return [json.loads(line) for line in Path(str(self.state) + '.audit.log').read_text().splitlines()]

    @patch('scanner.scan.notify_scan_event', return_value={'discord': True, 'telegram': True})
    def test_due_alert_is_delivered_without_advancing_observations(self, notify):
        event = self.event('due-event')
        expected = self.seed([event])
        expected[self.target]['pending_alerts'] = []
        self.run_dns_failure()
        notify.assert_called_once_with(**event['payload'], channels=['discord', 'telegram'])
        self.assertEqual(load_state(self.state), expected)
        row = self.audit()[0]
        self.assertEqual((row['target'], row['event'], row['exit_status']), (self.target, 'DNS_FAILED', 2))
        self.assertEqual((row['retried_alerts'], row['pending_alerts']), (1, 0))

    @patch('scanner.scan.notify_scan_event')
    def test_failed_channel_obeys_backoff_then_recovers_after_reload(self, notify):
        event = self.event('partial-event')
        expected = self.seed([event])
        notify.side_effect = [{'discord': True, 'telegram': False}, {'telegram': True}]
        for now in (100, 109, 110):
            with patch('scanner.scan.time.time', return_value=now):
                self.run_dns_failure()
            if now == 100:
                expected[self.target]['pending_alerts'][0].update(
                    channels=['telegram'], attempts=1, next_attempt_at=110)
                self.assertEqual(load_state(self.state), expected)
        self.assertEqual(notify.call_count, 2, 'Backoff must suppress the middle invocation')
        self.assertEqual(notify.call_args.kwargs, {**event['payload'], 'channels': ['telegram']})
        expected[self.target]['pending_alerts'] = []
        self.assertEqual(load_state(self.state), expected)
        self.assertEqual([row['retried_alerts'] for row in self.audit()], [1, 0, 1])
        self.assertEqual([row['pending_alerts'] for row in self.audit()], [1, 1, 0])

    @patch('scanner.scan.notify_scan_event', return_value={'discord': True, 'telegram': True})
    def test_two_event_budget_skips_events_still_in_backoff(self, notify):
        events = [self.event('backoff', next_attempt_at=200)] + [self.event(f'due-{i}') for i in range(3)]
        expected = self.seed(events)
        expected[self.target]['pending_alerts'] = [events[0], events[3]]
        with patch('scanner.scan.time.time', return_value=100):
            self.run_dns_failure()
        self.assertEqual([call.kwargs['event_id'] for call in notify.call_args_list], ['due-0', 'due-1'])
        self.assertEqual(load_state(self.state), expected)
        self.assertEqual((self.audit()[0]['retried_alerts'], self.audit()[0]['pending_alerts']), (2, 2))

    @patch('scanner.scan.notify_scan_event')
    def test_no_alert_preserves_pending_state_byte_for_byte(self, notify):
        self.seed([self.event('pending')])
        before = self.state.read_bytes()
        self.run_dns_failure('--no-alert')
        notify.assert_not_called()
        self.assertEqual(self.state.read_bytes(), before)

    @patch('scanner.scan.notify_scan_event')
    def test_unknown_host_does_not_create_baseline_or_retry_another_host(self, notify):
        other_event = self.event('another-host')
        other_event['payload']['target_host'] = '127.0.0.1'
        save_state(self.state, {'127.0.0.1': {'baseline_open_ports': [22], 'pending_alerts': [other_event]}})
        before = self.state.read_bytes()
        self.run_dns_failure()
        notify.assert_not_called()
        self.assertEqual(self.state.read_bytes(), before)

    @patch('scanner.scan.notify_scan_event', side_effect=OSError('simulated channel outage'))
    def test_transport_exception_is_persisted_for_later_retry(self, notify):
        expected = self.seed([self.event('failed-event')])
        expected[self.target]['pending_alerts'][0].update(attempts=1, next_attempt_at=110)
        with patch('scanner.scan.time.time', return_value=100):
            self.run_dns_failure()
        notify.assert_called_once()
        self.assertEqual(load_state(self.state), expected)

    @patch('scanner.scan.notify_scan_event')
    def test_invalid_state_or_busy_writer_does_not_deliver_or_overwrite(self, notify):
        self.state.write_text('{broken', encoding='utf-8')
        self.run_dns_failure()
        self.assertEqual(self.state.read_text(), '{broken')
        self.seed([self.event('pending')])
        before = self.state.read_bytes()
        with state_lock(self.state):
            self.run_dns_failure()
        notify.assert_not_called()
        self.assertEqual(self.state.read_bytes(), before)

    @patch('scanner.scan.notify_scan_event', return_value={'discord': True, 'telegram': True})
    def test_watch_drains_pending_during_dns_failure_then_resumes_scanning(self, notify):
        expected = self.seed([self.event('watch-event')])
        # Keep the same observed ports so this scenario isolates DNS recovery.
        expected[self.target]['uncertain_ports'] = []
        save_state(self.state, expected)

        def recovered_probe(**kwargs):
            notify.assert_called_once()
            self.assertEqual(load_state(self.state)[self.target]['pending_alerts'], [],
                             'Delivery must finish during DNS failure, before the recovered probe')
            return {80: 'open', 5432: 'open'}

        with patch('scanner.scan.socket.gethostbyname', side_effect=[socket.gaierror('simulated'), '127.0.0.1']), \
             patch('scanner.scan.scan_ports_parallel', side_effect=recovered_probe) as probe, \
             patch('scanner.scan.generate_html_report', return_value=self.state.parent / 'latest.html'), \
             patch('scanner.scan.configured_alert_channels', return_value=['discord', 'telegram']), \
             patch('scanner.scan.time.sleep', side_effect=[None, KeyboardInterrupt]):
            self.assertEqual(main([self.target, '--ports', '80,5432', '--state-file', str(self.state),
                                   '--no-banner', '--watch', '1']), 0)
        notify.assert_called_once()
        probe.assert_called_once()
        self.assertEqual(load_state(self.state)[self.target]['pending_alerts'], [])
        self.assertEqual(load_state(self.state)[self.target]['baseline_open_ports'], [80, 5432])
        self.assertEqual([row['event'] for row in self.audit()], ['DNS_FAILED', 'NO_CHANGE'])
        self.assertEqual([row['exit_status'] for row in self.audit()], [2, 0])


if __name__ == '__main__':
    unittest.main()
