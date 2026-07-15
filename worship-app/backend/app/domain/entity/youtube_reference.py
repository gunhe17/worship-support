from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class YoutubeReference:
    song_id: UUID
    title: str
    url: str
    channel: str
    arrangement_type: str
    id: UUID = field(default_factory=uuid4)
