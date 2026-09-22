"""Inspect Git index blobs, never print matched contents or follow symlinks."""
import fnmatch
import json
from pathlib import PurePosixPath
import re
import subprocess
import sys

BLOCKED_DIRS = {'node_modules', 'dist', 'build', '__pycache__', '.venv', 'venv',
                '.local', '.aws', '.ssh', 'pgdata', 'pg_data'}
BLOCKED_GLOBS = ('*.pem', '*.key', '*.p12', '*.pfx', 'id_rsa*', 'id_ed25519*',
                 '*.log', '*.log.*', '*debug.log*', '*.dump', '*.backup', '*.bak',
                 '*.db', '*.db-*', '*.sqlite*', '*.sql.gz', '*.sql.zip', '*.pyc',
                 '*.tsbuildinfo', '.npmrc', '.pypirc', '.netrc', 'credentials',
                 'credentials.json', '*service-account*.json')
SIGNATURES = (
    rb'-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----',
    rb'\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b',
    rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    rb'\b(?:xox[baprs]-[A-Za-z0-9-]{20,}|sk-proj-[A-Za-z0-9_-]{40,})\b',
    rb'(?i)["\'](?:private_key|aws_secret_access_key)["\']\s*[:=]\s*["\'][^"\'\r\n]{20,}',
)


def path_reason(path):
    p = PurePosixPath(path.lower())
    name = p.name
    if (name == '.env' or name.startswith('.env.')) and name != '.env.example':
        return 'environment file'
    if any(part in BLOCKED_DIRS for part in p.parts[:-1]):
        return 'dependency, build or local data directory'
    if path.lower().startswith('website/backend/src/generated/'):
        return 'generated Prisma client'
    if any(fnmatch.fnmatchcase(name, pattern) for pattern in BLOCKED_GLOBS):
        return 'key, credential, log or generated/local data file'
    # SQL source is allowed only as committed Prisma migrations, never dumps.
    if name.endswith('.sql') and not (
        len(p.parts) == 6 and p.parts[:4] == ('website', 'backend', 'prisma', 'migrations')
        and name == 'migration.sql'
    ):
        return 'SQL outside canonical migration directory'
    return None


def content_reason(data):
    if any(re.search(pattern, data) for pattern in SIGNATURES):
        return 'credential/private key signature'
    return None


def check_repository():
    entries = subprocess.check_output(['git', 'ls-files', '--stage', '-z']).split(b'\0')
    failures = []
    count = 0
    for entry in filter(None, entries):
        meta, raw_path = entry.split(b'\t', 1)
        mode, oid, stage = meta.split()
        path = raw_path.decode('utf-8', errors='replace')
        count += 1
        reason = path_reason(path)
        if stage != b'0' or mode not in (b'100644', b'100755'):
            reason = 'unmerged entry, symlink or submodule requires explicit policy review'
        if not reason:
            data = subprocess.check_output(['git', 'cat-file', 'blob', oid.decode('ascii')])
            reason = content_reason(data)
        if reason:
            failures.append((path, reason))
    for path, reason in failures:
        print(f'FAIL {json.dumps(path)}: {reason}')
    print(f'Repository policy: {count} index entries, {len(failures)} violation(s).')
    return bool(failures)


if __name__ == '__main__':
    sys.exit(check_repository())
