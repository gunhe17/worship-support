from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PostSongCreateRequest(BaseModel):
    song_id: UUID
    order: int = 0
    ment: str = ""


class PostSongResponse(BaseModel):
    id: UUID
    post_id: UUID
    song_id: UUID
    order: int
    ment: str

    class Config:
        from_attributes = True


class CommentCreateRequest(BaseModel):
    author_name: str
    content: str


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class PostCreateRequest(BaseModel):
    author_name: str
    scripture: str
    meditation: str = ""
    songs: list[PostSongCreateRequest] = []


class PostUpdateRequest(BaseModel):
    scripture: str | None = None
    meditation: str | None = None


class PostResponse(BaseModel):
    id: UUID
    author_name: str
    scripture: str
    meditation: str
    view_count: int
    created_at: datetime
    songs: list[PostSongResponse] = []
    comments: list[CommentResponse] = []

    class Config:
        from_attributes = True


class PostSummaryResponse(BaseModel):
    id: UUID
    author_name: str
    scripture: str
    meditation: str
    view_count: int
    created_at: datetime
    song_count: int = 0
    comment_count: int = 0

    class Config:
        from_attributes = True
