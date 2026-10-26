"""Atomic baseline persistence and a single-writer lock for scheduled scans."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import tempfile
import datetime
import logging
import math
from logging.handlers import RotatingFileHandler


def _valid_ports(value) -> bool:
    return isinstance(value, list) and all(type(port) is int and 1 <= port <= 65535 for port in value)


def _valid_number(value) -> bool:
    return ((type(value) is int and value >= 0)
            or (type(value) is float and math.isfinite(value) and value >= 0))


def _validate_pending(pending, host: str) -> None:
    if not isinstance(pending, list) or len(pending) > 100:
        raise ValueError("Invalid scanner alert outbox; restore its backup.")
    event_types = {"INITIAL_SCAN", "NEW_PORT_DETECTED", "PORT_CLOSED", "SCAN_UNCERTAIN", "SCAN_RECOVERED"}
    payload_fields = {"event_type", "target_host", "open_ports", "new_ports", "closed_ports",
                      "scan_duration", "banners", "event_id", "detected_at"}
    for event in pending:
        if not isinstance(event, dict):
            raise ValueError("Invalid scanner pending event.")
        channels = event.get("channels")
        if (not isinstance(event.get("id"), str) or not event["id"]
                or not isinstance(channels, list) or not channels
                or any(channel not in ("discord", "telegram") for channel in channels)
                or len(set(channels)) != len(channels)
                or type(event.get("attempts")) is not int or event["attempts"] < 0
                or not _valid_number(event.get("next_attempt_at"))):
            raise ValueError("Invalid scanner pending event metadata.")
        payload = event.get("payload")
        if (not isinstance(payload, dict) or set(payload) - payload_fields
                or not isinstance(payload.get("event_type"), str) or payload["event_type"] not in event_types
                or payload.get("target_host") != host
                or not _valid_ports(payload.get("open_ports"))):
            raise ValueError("Invalid scanner pending event payload.")
        for field in ("new_ports", "closed_ports"):
            if field in payload and not _valid_ports(payload[field]):
                raise ValueError("Invalid scanner pending event ports.")
        if "scan_duration" in payload and not _valid_number(payload["scan_duration"]):
            raise ValueError("Invalid scanner pending event duration.")
        for field in ("event_id", "detected_at"):
            if field in payload and not isinstance(payload[field], str):
                raise ValueError("Invalid scanner pending event identity.")
        if "banners" in payload and (not isinstance(payload["banners"], dict)
                or any(not str(port).isdigit() or not 1 <= int(port) <= 65535
                       or (banner is not None and not isinstance(banner, str))
                       for port, banner in payload["banners"].items())):
            raise ValueError("Invalid scanner pending event banners.")


def load_state(path: Path) -> dict:
    if not path.exists():
        return {}
    # A corrupt baseline must fail visibly, never silently become INITIAL_SCAN.
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("Invalid scanner state: expected an object; restore its backup.")
    for host, record in value.items():
        if not isinstance(record, dict) or not isinstance(record.get("baseline_open_ports"), list):
            raise ValueError("Invalid scanner host record; restore its backup.")
        if not _valid_ports(record["baseline_open_ports"]):
            raise ValueError("Invalid scanner baseline port.")
        if "baseline_initialized" in record and type(record["baseline_initialized"]) is not bool:
            raise ValueError("Invalid scanner baseline initialization flag.")
        if not _valid_ports(record.get("uncertain_ports", [])):
            raise ValueError("Invalid scanner uncertain ports.")
        _validate_pending(record.get("pending_alerts", []), host)
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


class _StrictRotatingFileHandler(RotatingFileHandler):
    def handleError(self, record):
        # Logging normally swallows disk/rotation errors. Monitoring must fail.
        raise


def write_audit(path: Path, **fields) -> None:
    """Bounded JSON-lines audit: current 1 MiB file plus two rotated backups."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handler = _StrictRotatingFileHandler(str(path) + ".audit.log", maxBytes=1024 * 1024, backupCount=2, encoding="utf-8")
    try:
        data = {"time": datetime.datetime.now(datetime.timezone.utc).isoformat(), **fields}
        handler.emit(logging.LogRecord("monitor", logging.INFO, __file__, 0, json.dumps(data), (), None))
    finally:
        handler.close()
