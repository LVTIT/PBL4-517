"""Partial-scan uncertainty regressions; no external probes or real alerts."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scanner.scan import evaluate_diff_and_notify, main
from scanner.state_store import load_state


class PartialScanTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.state = Path(temporary.name) / 'monitor.state.json'

    def observe(self, results, *, no_alert=True, reset_baseline=False):
        return evaluate_diff_and_notify(
            '127.0.0.1', [port for port, status in results.items() if status == 'open'],
            0.1, self.state, {}, no_alert=no_alert, reset_baseline=reset_baseline,
            scanned_ports=list(results), port_results=results,
        )

    @patch('scanner.scan.configured_alert_channels', return_value=['telegram'])
    @patch('scanner.scan.notify_scan_event', return_value={'telegram': True})
    def test_repeated_web_only_scans_do_not_send_false_recovery(self, notify, channels):
        self.observe({80: 'open', 5432: 'open'})
        self.observe({80: 'open', 5432: 'filtered'}, no_alert=False)
        self.assertEqual(notify.call_args.kwargs['event_type'], 'SCAN_UNCERTAIN')
        notify.reset_mock()

        for _ in range(3):
            self.assertEqual(self.observe({80: 'open'}, no_alert=False), 'NO_CHANGE')
            record = load_state(self.state)['127.0.0.1']
            self.assertEqual(record['uncertain_ports'], [5432])
            self.assertEqual(record['baseline_open_ports'], [80, 5432])
        notify.assert_not_called()

        self.assertEqual(self.observe({5432: 'open'}, no_alert=False), 'SCAN_RECOVERED')
        notify.assert_called_once()
        self.assertEqual(notify.call_args.kwargs['event_type'], 'SCAN_RECOVERED')
        self.assertEqual(load_state(self.state)['127.0.0.1']['uncertain_ports'], [])

    def test_disjoint_timeouts_need_individual_conclusive_rechecks(self):
        self.observe({80: 'open', 5432: 'filtered'})
        self.assertEqual(self.observe({8080: 'filtered'}), 'SCAN_UNCERTAIN')
        self.assertEqual(load_state(self.state)['127.0.0.1']['uncertain_ports'], [5432, 8080])

        self.observe({5432: 'closed'})
        self.assertEqual(load_state(self.state)['127.0.0.1']['uncertain_ports'], [8080])
        self.assertEqual(self.observe({8080: 'filtered'}), 'NO_CHANGE')
        self.assertEqual(self.observe({8080: 'closed'}), 'SCAN_RECOVERED')
        record = load_state(self.state)['127.0.0.1']
        self.assertEqual(record['uncertain_ports'], [])
        self.assertEqual(record['baseline_open_ports'], [80])

    def test_subset_baseline_reset_does_not_prove_unscanned_port_recovery(self):
        self.observe({80: 'open', 5432: 'filtered'})
        self.assertEqual(self.observe({80: 'closed'}, reset_baseline=True), 'INITIAL_SCAN')
        record = load_state(self.state)['127.0.0.1']
        self.assertEqual(record['baseline_open_ports'], [])
        self.assertEqual(record['uncertain_ports'], [5432])
        self.assertEqual(self.observe({5432: 'closed'}), 'SCAN_RECOVERED')

    def test_cli_exit_and_audit_stay_degraded_until_timed_out_port_is_rechecked(self):
        common = ['127.0.0.1', '--state-file', str(self.state), '--no-alert', '--no-banner']
        with patch('scanner.scan.socket.gethostbyname', return_value='127.0.0.1'), \
             patch('scanner.scan.scan_ports_parallel', side_effect=[
                 {80: 'open', 5432: 'filtered'}, {80: 'open'}, {5432: 'closed'},
             ]), \
             patch('scanner.scan.generate_html_report', return_value=self.state.parent / 'latest.html'):
            statuses = [main([*common, '--ports', ports]) for ports in ['80,5432', '80', '5432']]

        self.assertEqual(statuses, [1, 1, 0])
        rows = [json.loads(line) for line in Path(str(self.state) + '.audit.log').read_text().splitlines()]
        self.assertEqual([row['exit_status'] for row in rows], [1, 1, 0])
        self.assertEqual([row['event'] for row in rows], ['INITIAL_SCAN', 'NO_CHANGE', 'SCAN_RECOVERED'])
        self.assertEqual([row['uncertain_ports'] for row in rows], [[5432], [5432], []])
        self.assertEqual(rows[1]['results'], {'80': 'open'})
        self.assertEqual(load_state(self.state)['127.0.0.1']['uncertain_ports'], [])


if __name__ == '__main__':
    unittest.main()
