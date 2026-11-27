import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from scanner.nmap_backend import parse_nmap_xml, scan_tcp_ports
from scanner.scan import main
from scanner.state_store import load_state


def scan_xml(ports: str, target: str = '127.0.0.1', exit_status: str = 'success') -> bytes:
    return (
        f'<nmaprun><host><address addr="{target}" addrtype="ipv4"/>'
        f'<ports>{ports}</ports></host>'
        f'<runstats><finished exit="{exit_status}"/></runstats></nmaprun>'
    ).encode()


class NmapBackendTests(unittest.TestCase):
    def test_single_aggregate_identifies_all_omitted_ports(self):
        xml = scan_xml('''
            <extraports state="closed" count="2"/>
            <port protocol="tcp" portid="443"><state state="open"/></port>
        ''')
        self.assertEqual(parse_nmap_xml(xml, '127.0.0.1', [80, 443, 8080]),
                         {80: 'closed', 443: 'open', 8080: 'closed'})

    def test_incomplete_or_ambiguous_results_remain_uncertain(self):
        for groups in ('', '<extraports state="closed" count="1"/>',
                       '<extraports state="closed" count="1"/><extraports state="filtered" count="1"/>'):
            with self.subTest(groups=groups):
                xml = scan_xml(groups + '<port protocol="tcp" portid="443"><state state="open|filtered"/></port>')
                self.assertEqual(parse_nmap_xml(xml, '127.0.0.1', [80, 443, 8080]),
                                 {80: 'filtered', 443: 'filtered', 8080: 'filtered'})

    def test_invalid_output_cannot_be_applied_to_baseline(self):
        for xml in (b'<unfinished', scan_xml('', target='192.0.2.1'), scan_xml('', exit_status='error'),
                    scan_xml('<port protocol="tcp" portid="81"><state state="closed"/></port>')):
            with self.subTest(xml=xml), self.assertRaises(RuntimeError):
                parse_nmap_xml(xml, '127.0.0.1', [80])

    @patch('scanner.nmap_backend.nmap_executable', return_value='nmap')
    @patch('scanner.nmap_backend.subprocess.run')
    def test_runner_uses_one_tcp_target_compact_ports_and_bounded_timeout(self, run, executable):
        run.return_value = subprocess.CompletedProcess([], 0, scan_xml(''))
        scan_tcp_ports('127.0.0.1', [80, 81, 82, 443], 1)
        args = run.call_args.args[0]
        self.assertIn('-sT', args)
        self.assertEqual(args[args.index('-p') + 1], '80-82,443')
        self.assertEqual(args[-3:], ['-oX', '-', '127.0.0.1'])
        self.assertEqual(run.call_args.kwargs['timeout'], 30)

    def test_failed_nmap_preserves_state_and_records_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / 'baseline.json'
            state.write_text('{"127.0.0.1":{"baseline_open_ports":[80]}}', encoding='utf-8')
            previous = state.read_bytes()
            with patch('scanner.nmap_backend.nmap_executable', return_value='nmap'), \
                 patch('scanner.nmap_backend.subprocess.run', side_effect=subprocess.TimeoutExpired('nmap', 30)):
                result = main(['127.0.0.1', '--ports', '80', '--state-file', str(state), '--no-alert', '--no-banner'])
            self.assertEqual(result, 2)
            self.assertEqual(state.read_bytes(), previous)
            record = json.loads(Path(f'{state}.audit.log').read_text(encoding='utf-8'))
            self.assertEqual((record['event'], record['exit_status']), ('SCAN_FAILED', 2))

    @patch('alerts.notifier.get_credentials', return_value=('unused-webhook', 'unused-token', 'unused-chat'))
    @patch('alerts.notifier.send_discord_alert', return_value=True)
    @patch('alerts.notifier.send_telegram_alert', return_value=True)
    def test_real_nmap_cli_detects_lower_new_port_and_feeds_both_channels(self, telegram, discord, credentials):
        with tempfile.TemporaryDirectory() as directory, socket.socket() as first, socket.socket() as second:
            state = Path(directory) / 'baseline.json'
            for listener in (first, second):
                listener.bind(('127.0.0.1', 0))
            low, high = sorted((first, second), key=lambda listener: listener.getsockname()[1])
            lower, higher = low.getsockname()[1], high.getsockname()[1]
            args = ['127.0.0.1', '--ports', f'{lower},{higher}', '--state-file', str(state), '--no-banner']

            with patch.dict(os.environ, {'PBL517_REPORTS_DIR': directory}):
                high.listen()
                self.assertEqual(main(args), 0)
                self.assertEqual(load_state(state)['127.0.0.1']['baseline_open_ports'], [higher])
                self.assertEqual(main(args), 0)
                self.assertEqual((discord.call_count, telegram.call_count), (1, 1))
                low.listen()
                self.assertEqual(main(args), 0)
                self.assertEqual(main(args), 0)

            audit = [json.loads(line) for line in Path(f'{state}.audit.log').read_text(encoding='utf-8').splitlines()]
            self.assertEqual([row['event'] for row in audit],
                             ['INITIAL_SCAN', 'NO_CHANGE', 'NEW_PORT_DETECTED', 'NO_CHANGE'])
            self.assertTrue(all(row['scanner'] == 'nmap' for row in audit))
            self.assertEqual((discord.call_count, telegram.call_count), (2, 2))
            embed_fields = {field['name']: field['value'] for field in discord.call_args.kwargs['fields']}
            telegram_text = telegram.call_args.kwargs['markdown_text']
            telegram_new = telegram_text.split('Cổng mới:\n', 1)[1].split('\nĐang mở:', 1)[0]
            for new_ports in (embed_fields['Cổng mới mở'], telegram_new):
                self.assertIn(str(lower), new_ports)
                self.assertNotIn(str(higher), new_ports)
            self.assertIn(embed_fields['Mã sự kiện'], telegram_text)
            report = Path(directory) / 'latest.md'
            self.assertIn(str(lower), report.read_text(encoding='utf-8'))
            self.assertEqual(load_state(state)['127.0.0.1']['baseline_open_ports'], [lower, higher])
