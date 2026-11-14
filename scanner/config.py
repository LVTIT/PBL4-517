"""Shared monitoring settings: process environment > repository .env > defaults.

Relative configured paths always resolve from the repository, never the caller's
working directory. Reading settings does not export credentials into os.environ.
"""
import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_env() -> dict[str, str]:
    path = ROOT_DIR / '.env'
    if not path.is_file():
        return {}
    values = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = value.split(' #', 1)[0].rstrip()
        values[key.strip()] = value
    return values


def setting(name: str, default: str = '') -> str:
    return os.environ.get(name, load_env().get(name, default))


def resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (ROOT_DIR / path).resolve()


def reports_dir() -> Path:
    return resolve_path(setting('PBL517_REPORTS_DIR') or '.local/reports/scanner')


def state_file() -> Path:
    configured = setting('SCANNER_STATE_FILE')
    if configured:
        return resolve_path(configured)
    canonical = ROOT_DIR / '.local/runtime/scanner.state.json'
    legacy = ROOT_DIR / 'scanner/scanner_state.json'
    # Preserve baseline/outbox for existing installations until explicit migration.
    if not canonical.exists() and legacy.exists():
        return legacy
    return canonical
