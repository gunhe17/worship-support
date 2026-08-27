from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class SongSheet:
    song_id: UUID
    key: str
    sheet_url: str
    id: UUID = field(default_factory=uuid4)
    page_order: int = 0
