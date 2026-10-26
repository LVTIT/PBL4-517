"""Atomic baseline persistence and a single-writer lock for scheduled scans."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import tempfile
import datetime
import logging
from logging.handlers import RotatingFileHandler


def load_state(path: Path) -> dict:
    if not path.exists():
        return {}
    # A corrupt baseline must fail visibly, never silently become INITIAL_SCAN.
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Invalid scanner state: expected an object; restore its backup.")
    for record in value.values():
        if not isinstance(record, dict) or not isinstance(record.get("baseline_open_ports"), list):
            raise ValueError("Invalid scanner host record; restore its backup.")
        if any(type(port) is not int or not 1 <= port <= 65535 for port in record["baseline_open_ports"]):
            raise ValueError("Invalid scanner baseline port.")
    return value


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as file:
            temporary = file.name
            json.dump(state, file, indent=2, ensure_ascii=False)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def state_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(str(path) + ".lock", "a+b") as lock:
        if os.name == "nt":
            import msvcrt
            if lock.tell() == 0:
                lock.write(b"0")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            if os.name == "nt":
                lock.seek(0)
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(lock, fcntl.LOCK_UN)


def write_audit(path: Path, **fields) -> None:
    """Bounded JSON-lines audit: current 1 MiB file plus two rotated backups."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(str(path) + ".audit.log", maxBytes=1024 * 1024, backupCount=2, encoding="utf-8")
    try:
        data = {"time": datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields}
        handler.emit(logging.LogRecord("monitor", logging.INFO, __file__, 0, json.dumps(data), (), None))
    finally:
        handler.close()
