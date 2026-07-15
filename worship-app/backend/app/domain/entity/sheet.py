from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Sheet:
    song_id: UUID
    key: str
    id: UUID = field(default_factory=uuid4)
    image_url: str | None = None
    pdf_url: str | None = None
