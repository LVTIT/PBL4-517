import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('migration', Path(__file__).resolve().parents[1] / 'migrate-runtime.py')
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.source = self.root / 'old.state.json'
        self.target = self.root / '.local/runtime/scanner.state.json'
        self.pending = {'id': 'event-1', 'channels': ['telegram'], 'attempts': 2,
                        'next_attempt_at': 42, 'payload': {'event_type': 'INITIAL_SCAN',
                        'target_host': '127.0.0.1', 'open_ports': [80]}}
        self.source.write_text(json.dumps({'127.0.0.1': {'baseline_open_ports': [80], 'pending_alerts': [self.pending]}}))
        Path(str(self.source) + '.audit.log').write_text('audit fixture\n')
        (self.root / '.env').write_text('TELEGRAM_BOT_TOKEN=synthetic\nSCANNER_STATE_FILE=old.state.json\n')
        reports = self.root / 'scanner/reports'
        reports.mkdir(parents=True)
        (reports / 'latest.html').write_text('fixture report')
        for p in [patch.object(migration, 'ROOT', self.root), patch('scanner.config.ROOT_DIR', self.root), patch.dict(os.environ, {}, clear=True)]:
            p.start()
            self.addCleanup(p.stop)

    def run_migration(self, *args):
        with patch('sys.argv', ['migration', *args]):
            migration.main()

    def test_dry_run_does_not_change_data(self):
        before = (self.root / '.env').read_bytes()
        self.run_migration()
        self.assertFalse(self.target.exists())
        self.assertEqual((self.root / '.env').read_bytes(), before)

    def test_apply_preserves_pending_audit_credentials_and_sources(self):
        original = self.source.read_bytes()
        self.run_migration('--apply', '--stopped')
        self.assertEqual(self.target.read_bytes(), original)
        self.assertEqual(self.source.read_bytes(), original)
        self.assertEqual(migration.load_state(self.target)['127.0.0.1']['pending_alerts'], [self.pending])
        self.assertEqual(Path(str(self.target) + '.audit.log').read_text(), 'audit fixture\n')
        self.assertIn('TELEGRAM_BOT_TOKEN=synthetic', (self.root / '.env').read_text())
        self.assertEqual((self.root / '.local/reports/scanner/latest.html').read_text(), 'fixture report')
        self.assertEqual(len(list((self.root / '.local/private').glob('*/root.env'))), 1)

    def test_conflict_does_not_overwrite_target_or_config(self):
        self.target.parent.mkdir(parents=True)
        self.target.write_text('different data')
        before = (self.root / '.env').read_bytes()
        with self.assertRaises(ValueError):
            self.run_migration('--apply', '--stopped')
        self.assertEqual(self.target.read_text(), 'different data')
        self.assertEqual((self.root / '.env').read_bytes(), before)

    def test_apply_requires_stopped_acknowledgement(self):
        with self.assertRaises(ValueError):
            self.run_migration('--apply')
        self.assertFalse(self.target.exists())

    def test_refuses_paths_outside_checkout(self):
        with self.assertRaises(ValueError):
            migration.local(self.root.parent / 'outside.state.json')
