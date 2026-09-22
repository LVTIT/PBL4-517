"""Negative cases verify the gate fails without exposing fixture secrets."""
import contextlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from repo_policy import check_repository, content_reason, path_reason
from sanitize_log import sanitize


class PolicyTests(unittest.TestCase):
    def test_dangerous_paths(self):
        for path in ['.env', 'a/.env.production', 'a/.env.example.bak', 'A/KEY.PEM',
                     'a/id_rsa.pub', 'a/id_ed25519', 'a/node_modules/x.js',
                     'a/dist/x.js', 'a/error.log.1', 'a/test.sqlite-wal',
                     'backup.sql', 'a/db.sql.gz', '.aws/credentials',
                     'website/backend/src/generated/client.ts', 'a/.npmrc']:
            with self.subTest(path=path):
                self.assertIsNotNone(path_reason(path))

    def test_source_and_sanitized_evidence_allowed(self):
        for path in ['website/backend/.env.example', 'evidence/AWS-03/00-environment.txt',
                     'website/backend/prisma/migrations/20260914000000_initial/migration.sql',
                     'website/backend/package-lock.json', 'scanner/scan.py']:
            self.assertIsNone(path_reason(path), path)

    def test_content_signatures(self):
        for data in [b'-----BEGIN ' + b'OPENSSH PRIVATE KEY-----',
                     b'ghp_' + b'A' * 36, b'AKIA' + b'A' * 16,
                     b'{"private_key": "' + b'x' * 30 + b'"}']:
            self.assertIsNotNone(content_reason(data))

    def test_git_index_is_checked_even_if_worktree_is_cleaned(self):
        with tempfile.TemporaryDirectory() as directory:
            old_cwd = os.getcwd()
            try:
                os.chdir(directory)
                subprocess.run(['git', 'init', '-q'], check=True)
                secret = 'ghp_' + 'Z' * 36
                Path('notes.txt').write_text(secret)
                subprocess.run(['git', 'add', 'notes.txt'], check=True)
                Path('notes.txt').write_text('clean worktree but unsafe index')
                out = io.StringIO()
                with contextlib.redirect_stdout(out):
                    self.assertTrue(check_repository())
                self.assertNotIn(secret, out.getvalue())
                self.assertIn('notes.txt', out.getvalue())
                subprocess.run(['git', 'add', 'notes.txt'], check=True)
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertFalse(check_repository())
            finally:
                os.chdir(old_cwd)

    def test_log_redaction_and_command_escape(self):
        with patch.dict(os.environ, {'SESSION_SECRET': 'test-secret-value'}):
            result = sanitize('::warning::test-secret-value\npbl517.sid=secret-cookie;\n'
                              'postgresql://user:password@localhost/db\n' + 'a' * 64)
        for secret in ['test-secret-value', 'secret-cookie', 'user:password', 'a' * 64]:
            self.assertNotIn(secret, result)
        self.assertTrue(result.startswith('| ::warning::'))


if __name__ == '__main__':
    unittest.main()
