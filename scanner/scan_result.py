"""Changes observed in one scan and shared by alerts, audit and reports."""

from dataclasses import dataclass, field
from uuid import uuid4


@dataclass(frozen=True)
class ScanEvent:
    event_type: str
    ports: tuple[int, ...] = ()
    event_id: str = field(default_factory=lambda: uuid4().hex)


@dataclass(frozen=True)
class ScanResult:
    detected_at: str
    events: tuple[ScanEvent, ...]
    pending_alerts: int

    @property
    def event_type(self) -> str:
        return self.events[0].event_type if self.events else "NO_CHANGE"
