"""Path/precedence regressions; no network or real credentials."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scanner import config, reporter
from scanner.scan import main
from alerts import bot_listener, notifier


class ConfigurationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.patch = patch('scanner.config.ROOT_DIR', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        env = patch.dict(os.environ, {}, clear=True)
        env.start()
        self.addCleanup(env.stop)

    def test_env_precedence_empty_disable_bom_quotes_and_no_export(self):
        (self.root / '.env').write_text('\ufeffTELEGRAM_BOT_TOKEN="fixture-value"\nPBL517_REPORTS_DIR="folder with spaces"\n', encoding='utf-8')
        self.assertEqual(notifier.get_credentials()[1], 'fixture-value')
        self.assertNotIn('TELEGRAM_BOT_TOKEN', os.environ)
        with patch.dict(os.environ, {'TELEGRAM_BOT_TOKEN': ''}):
            self.assertEqual(notifier.get_credentials()[1], '')
        self.assertEqual(config.reports_dir(), self.root / 'folder with spaces')

    def test_cli_and_bot_use_dotenv_paths_outside_repository_cwd(self):
        (self.root / '.env').write_text('SCANNER_STATE_FILE=.local/runtime/monitor.state.json\nPBL517_REPORTS_DIR=.local/reports/demo\n')
        previous = Path.cwd()
        try:
            os.chdir(self.root.parent)
            expected = self.root / '.local/runtime/monitor.state.json'
            self.assertEqual(bot_listener._state_file(), expected)
            with patch('scanner.scan.socket.gethostbyname', return_value='127.0.0.1'), \
                 patch('scanner.scan.scan_ports_parallel', return_value={80: 'closed'}):
                self.assertEqual(main(['127.0.0.1', '--ports', '80', '--no-alert', '--no-banner']), 0)
            self.assertTrue(expected.exists())
            self.assertTrue((self.root / '.local/reports/demo/latest.html').exists())
        finally:
            os.chdir(previous)

    def test_existing_legacy_baseline_is_selected_without_reset(self):
        legacy = self.root / 'scanner/scanner_state.json'
        legacy.parent.mkdir()
        legacy.write_text('{"old": "preserve"}')
        self.assertEqual(config.state_file(), legacy)
        self.assertEqual(legacy.read_text(), '{"old": "preserve"}')
        with patch.dict(os.environ, {'SCANNER_STATE_FILE': 'explicit.state.json'}):
            self.assertEqual(config.state_file(), self.root / 'explicit.state.json')

    @patch('alerts.bot_listener._authorized_sender', return_value=True)
    @patch('alerts.bot_listener.send_telegram_alert')
    @patch('alerts.bot_listener.subprocess.run')
    def test_uncertain_scan_still_reports_output_without_claiming_failure(self, run, send, allowed):
        run.return_value.returncode = 1
        run.return_value.stdout = '[EVENT: SCAN_UNCERTAIN]'
        bot_listener.handle_command('unused', 'unused', '/scan 127.0.0.1 80', user_id=1)
        text = send.call_args.args[2]
        self.assertIn('timeout/filtered', text)
        self.assertIn('/report', text)
        self.assertNotIn('Lỗi khi quét', text)
