from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class WorshipMent:
    worship_id: UUID
    song_title: str
    section_label: str  # e.g. "인트로 시작", "코러스→브릿지", "곡 마무리"
    ment_text: str
    order: int
    id: UUID = field(default_factory=uuid4)
