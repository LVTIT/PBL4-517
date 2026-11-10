"""Copy legacy local monitoring data to canonical paths; never delete sources.

Stop scanners/listeners first. --apply --stopped writes verified copies plus a
private .env backup. Default invocation is an inventory/dry run.
"""
import argparse
from datetime import datetime, timezone
import hashlib
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scanner.config import reports_dir, state_file
from scanner.state_store import load_state, state_lock


def local(path):
    resolved = path.resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError('Local migration refuses paths outside this checkout.')
    if path.is_symlink():
        raise ValueError('Local migration refuses symlinks.')
    return resolved


def copy_verified(source, target):
    local(source); local(target)
    if target.exists():
        if source.read_bytes() != target.read_bytes():
            raise ValueError('Destination differs; refusing to overwrite existing data.')
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive destination creation; retain source for rollback.
    with target.open('xb') as output:
        output.write(source.read_bytes())
    if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
        raise ValueError('Migration hash verification failed.')
    shutil.copystat(source, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--stopped', action='store_true', help='Confirm all scanners/listeners using this checkout are stopped.')
    args = parser.parse_args()
    source = local(state_file())
    target = ROOT / '.local/runtime/scanner.state.json'
    directories = list(dict.fromkeys(local(p) for p in [reports_dir(), ROOT / 'scanner/reports', ROOT / '.local/demo/scanner-reports']))
    print(f'State: {source.relative_to(ROOT)} -> {target.relative_to(ROOT)}')
    print('Reports: .local/reports/scanner; originals are retained and archived.')
    if not args.apply:
        print('Dry run. Stop scanners/listeners, then pass --apply --stopped.')
        return
    if not args.stopped:
        raise ValueError('Stop scanners/listeners and acknowledge with --stopped before applying.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    archive = ROOT / '.local/archive' / ('runtime-' + stamp)
    private = ROOT / '.local/private' / ('migration-' + stamp)
    config = ROOT / '.env'
    if config.exists():
        copy_verified(config, private / 'root.env')
    with state_lock(source):
        if source.exists() and source != target:
            load_state(source)  # Validate pending alerts as well as baseline.
            with state_lock(target):
                copy_verified(source, target)
                copy_verified(source, archive / 'scanner.state.json')
                for suffix in ['.audit.log', '.audit.log.1', '.audit.log.2']:
                    audit = Path(str(source) + suffix)
                    if audit.exists():
                        copy_verified(audit, Path(str(target) + suffix))
    canonical = ROOT / '.local/reports/scanner'
    candidates = []
    for index, directory in enumerate(directories):
        if not directory.exists() or directory == canonical:
            continue
        for report in directory.iterdir():
            if report.is_file() and report.suffix in ('.html', '.md'):
                copy_verified(report, archive / f'reports-{index}' / report.name)
        if (directory / 'latest.html').exists():
            candidates.append(directory)
    if candidates and not (canonical / 'latest.html').exists():
        newest = max(candidates, key=lambda d: (d / 'latest.html').stat().st_mtime_ns)
        for report in newest.iterdir():
            if report.is_file() and report.suffix in ('.html', '.md'):
                copy_verified(report, canonical / report.name)
    # Update only path settings, preserving credential values and all other lines.
    original = config.read_text(encoding='utf-8-sig') if config.exists() else ''
    kept = [line for line in original.splitlines() if not re.match(r'^\s*(SCANNER_STATE_FILE|PBL517_REPORTS_DIR)\s*=', line)]
    kept += ['SCANNER_STATE_FILE=.local/runtime/scanner.state.json', 'PBL517_REPORTS_DIR=.local/reports/scanner']
    config.write_text('\n'.join(kept) + '\n', encoding='utf-8')
    print('Migration verified. Remove stale process environment path overrides before restarting. Private rollback backup: ' + str(private.relative_to(ROOT)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Migration stopped: {type(error).__name__}. Inspect local paths/locks; no source files were deleted.', file=sys.stderr)
        sys.exit(1)
