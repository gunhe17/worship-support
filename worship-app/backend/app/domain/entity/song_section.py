from dataclasses import dataclass, field
from uuid import UUID, uuid4


SECTION_TYPES = [
    "INTRO",
    "VERSE1", "VERSE2", "VERSE3", "VERSE4",
    "PRE_CHORUS",
    "CHORUS",
    "BRIDGE",
    "INTERLUDE",
    "OUTRO",
]


@dataclass
class SongSection:
    song_id: UUID
    section_type: str
    section_label: str
    lyrics: str
    bars: int
    order: int
    chord: str | None = None
    id: UUID = field(default_factory=uuid4)
