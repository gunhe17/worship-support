from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Song:
    title: str
    artist: str
    default_key: str
    bpm: int
    category: str
    lyrics: str
    id: UUID = field(default_factory=uuid4)
    sheet: str | None = None
