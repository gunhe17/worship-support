from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class SongArrangement:
    song_id: UUID
    worship_id: UUID
    key: str
    tempo: int
    song_form: list[str]
    ment: str
    memo: str
    order: int
    sheet_url: str | None = None
    id: UUID = field(default_factory=uuid4)
