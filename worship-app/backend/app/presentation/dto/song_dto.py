from uuid import UUID

from pydantic import BaseModel


class SongCreateRequest(BaseModel):
    title: str
    artist: str
    default_key: str
    bpm: int
    category: str
    lyrics: str
    sheet: str | None = None


class SongUpdateRequest(BaseModel):
    title: str | None = None
    artist: str | None = None
    default_key: str | None = None
    bpm: int | None = None
    category: str | None = None
    lyrics: str | None = None
    sheet: str | None = None


class SongResponse(BaseModel):
    id: UUID
    title: str
    artist: str
    default_key: str
    bpm: int
    category: str
    lyrics: str
    sheet: str | None = None

    class Config:
        from_attributes = True
