from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4


@dataclass
class PostSong:
    post_id: UUID
    song_id: UUID
    order: int
    ment: str = ""
    id: UUID = field(default_factory=uuid4)


@dataclass
class Comment:
    post_id: UUID
    author_name: str
    content: str
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class Post:
    author_name: str
    scripture: str
    meditation: str = ""
    id: UUID = field(default_factory=uuid4)
    view_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    songs: list[PostSong] = field(default_factory=list)
    comments: list[Comment] = field(default_factory=list)
