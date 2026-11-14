import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

DEMO_DIR = Path(__file__).parents[1]
sys.path.insert(0, str(DEMO_DIR))

spec = importlib.util.spec_from_file_location('demo_cli', DEMO_DIR / 'cli.py')
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)

ORDER = '11111111-1111-4111-8111-111111111111'
EVIDENCE = {
    'observedTitle': 'Dữ liệu attacker đọc được (HTTP 200)',
    'observed': [{'label': 'Đơn hàng', 'value': ORDER}, {'label': 'Địa chỉ', 'value': 'Synthetic owner address'}],
    'controlsTitle': 'Đối chứng',
    'controls': [{'label': 'Owner GET', 'value': '200 OK'}],
    'limits': ['Chỉ chứng minh đơn fixture bị lộ.'],
}


def write_manifest(folder):
    manifest = Path(folder) / '.local/private/lab-fixtures.json'
    manifest.parent.mkdir(parents=True)
    manifest.write_text(json.dumps({
        'schema': 1,
        'localAccounts': True,
        'run': 'synthetic-run',
        'owner': {'email': 'owner@local.test', 'password': 'Owner517!demo'},
        'attacker': {'email': 'attacker@local.test', 'password': 'Attacker517!demo'},
        'orderId': ORDER,
        'productId': '22222222-2222-4222-8222-222222222222',
        'productName': 'KEVILO lab synthetic-run',
        'reviewId': '33333333-3333-4333-8333-333333333333',
    }))


class Commands(unittest.TestCase):
    def test_custom_address_order_and_expect_are_forwarded_without_shell_or_credentials(self):
        with TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)), patch.object(cli.subprocess, 'run') as run:
            write_manifest(folder)
            report = {'result': 'DEFENSE_VERIFIED', 'passed': True, 'requests': [], 'target': 'http://127.0.0.1:3000', 'evidence': EVIDENCE}
            run.return_value.stdout = json.dumps(report)
            run.return_value.returncode = 0
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(cli.main(['idor-update', '--address', 'Address with spaces & literal $(text)', '--order', ORDER, '--expect', 'secure', '--non-interactive']), 0)
            call = run.call_args
            command = call.args[0]
            self.assertEqual(command[command.index('--address') + 1], 'Address with spaces & literal $(text)')
            self.assertEqual(command[command.index('--order') + 1], ORDER)
            self.assertEqual(command[command.index('--expect') + 1], 'secure')
            self.assertNotIn('shell', call.kwargs)

    def test_xss_dispatches_to_node_and_timeout_is_inconclusive(self):
        with TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)), patch.object(cli.subprocess, 'run', side_effect=cli.subprocess.TimeoutExpired('node', 120)) as run, contextlib.redirect_stdout(io.StringIO()):
            write_manifest(folder)
            self.assertEqual(cli.main(['xss', '--expect', 'secure', '--non-interactive']), 2)
            self.assertEqual(run.call_args.args[0][0], 'node')

    def test_wrong_scenario_options_fail_before_any_network(self):
        with patch.object(cli.subprocess, 'run') as run, contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                cli.main(['sqli', '--address', 'not an address scenario'])
            run.assert_not_called()

    def test_phase_positional_is_gone(self):
        with patch.object(cli.subprocess, 'run') as run, contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                cli.main(['idor', 'secure'])
            run.assert_not_called()

    def test_interactive_update_asks_and_forwards_typed_address(self):
        with TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)):
            write_manifest(folder)
            with patch.object(cli.sys.stdin, 'isatty', return_value=True), patch('builtins.input', side_effect=['', '', 'Typed demo address', 'y']), patch.object(cli.subprocess, 'run') as run, contextlib.redirect_stdout(io.StringIO()):
                run.return_value.stdout = json.dumps({'result': 'DEFENSE_VERIFIED', 'passed': True})
                run.return_value.returncode = 0
                self.assertEqual(cli.main(['idor-update']), 0)
                args = run.call_args.args[0]
                self.assertEqual(args[args.index('--address') + 1], 'Typed demo address')
                self.assertIn('--observe', args)
                self.assertIn('--trace', args)
                self.assertNotIn('--expect', args)

    def test_cancel_declined_in_terminal_never_sends_a_request(self):
        with TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)):
            write_manifest(folder)
            with patch.object(cli.sys.stdin, 'isatty', return_value=True), patch('builtins.input', side_effect=['', '', 'n']), patch.object(cli.subprocess, 'run') as run, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(cli.main(['idor-cancel']), 0)
                run.assert_not_called()

    def test_plain_idor_only_asks_target_and_order_and_prints_evidence_and_reports(self):
        for result_name in ('EXPLOIT_CONFIRMED', 'DEFENSE_VERIFIED'):
            with self.subTest(result=result_name), TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)):
                write_manifest(folder)
                output = io.StringIO()
                report = {'result': result_name, 'completed': True, 'evidence': EVIDENCE,
                          'run': 'synthetic-run', 'orderId': ORDER, 'target': 'http://127.0.0.1:3000'}
                with patch.object(cli.sys.stdin, 'isatty', return_value=True), patch('builtins.input', side_effect=['', '']) as ask, patch.object(cli.subprocess, 'run') as run, contextlib.redirect_stdout(output):
                    run.return_value.stdout = json.dumps(report)
                    run.return_value.returncode = 0
                    self.assertEqual(cli.main(['idor']), 0)
                self.assertEqual(ask.call_count, 2)
                self.assertIn('--observe', run.call_args.args[0])
                self.assertNotIn('--expect', run.call_args.args[0])
                self.assertNotIn('stderr', run.call_args.kwargs)  # Progress goes straight to terminal.
                text = output.getvalue()
                self.assertIn(result_name, text)
                self.assertIn('Fixture: run=synthetic-run | order=' + ORDER, text)
                self.assertIn('Dữ liệu attacker đọc được (HTTP 200):', text)
                self.assertIn('Địa chỉ', text)
                self.assertIn('Synthetic owner address', text)
                self.assertIn('Đối chứng:', text)
                self.assertIn('Giới hạn:', text)
                self.assertIn('Chỉ chứng minh đơn fixture bị lộ.', text)
                self.assertIn('Báo cáo đọc được: .local/reports/security/idor.md', text)
                for unwanted in ('GIẢI THÍCH', 'Vá ở đâu', 'Code liên quan', 'Owner517!', 'Attacker517!', 'passed:', 'pha:'):
                    self.assertNotIn(unwanted, text)
                saved = Path(folder) / '.local/reports/security/idor.json'
                self.assertEqual(json.loads(saved.read_text())['result'], result_name)
                markdown = (Path(folder) / '.local/reports/security/idor.md').read_text(encoding='utf-8')
                self.assertIn('| Địa chỉ | Synthetic owner address |', markdown)
                self.assertIn('## Giới hạn', markdown)
                for secret in ('Owner517!', 'Attacker517!'):
                    self.assertNotIn(secret, markdown)

    def test_show_evidence_is_forwarded_only_when_requested(self):
        with TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)), patch.object(cli.subprocess, 'run') as run:
            write_manifest(folder)
            run.return_value.stdout = json.dumps({'result': 'EXPLOIT_CONFIRMED', 'evidence': {}})
            run.return_value.returncode = 0
            with contextlib.redirect_stdout(io.StringIO()):
                cli.main(['idor', '--non-interactive'])
                self.assertNotIn('--show-evidence', run.call_args.args[0])
                cli.main(['idor', '--non-interactive', '--show-evidence'])
                self.assertIn('--show-evidence', run.call_args.args[0])

    def test_legacy_secure_is_optional_expectation_and_does_not_change_env(self):
        with TemporaryDirectory() as folder, patch.object(cli, 'ROOT', Path(folder)), patch.object(cli.subprocess, 'run') as run:
            write_manifest(folder)
            env = Path(folder) / 'website/backend/.env'
            env.parent.mkdir(parents=True)
            env.write_text('VULN_IDOR_ENABLED=true\n')
            run.return_value.stdout = json.dumps({'result': 'EXPLOIT_CONFIRMED', 'passed': False})
            run.return_value.returncode = 1
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(cli.main(['idor', '--expect', 'secure', '--non-interactive']), 1)
            args = run.call_args.args[0]
            self.assertEqual(args[args.index('--expect') + 1], 'secure')
            self.assertNotIn('--observe', args)
            self.assertEqual(env.read_text(), 'VULN_IDOR_ENABLED=true\n')


if __name__ == '__main__':
    unittest.main()
