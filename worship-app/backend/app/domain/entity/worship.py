from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class Worship:
    title: str
    scripture: str
    sermon_direction: str = ""
    duration_minutes: int = 30
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=datetime.utcnow)
    leader_meditation: str = ""
    ai_result: dict | None = None
