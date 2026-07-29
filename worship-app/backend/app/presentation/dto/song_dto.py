from uuid import UUID

from pydantic import BaseModel


class SongSectionCreateRequest(BaseModel):
    section_type: str
    section_label: str
    lyrics: str = ""
    bars: int = 8
    chord: str | None = None
    order: int = 0


class SongSectionUpdateRequest(BaseModel):
    section_type: str | None = None
    section_label: str | None = None
    lyrics: str | None = None
    bars: int | None = None
    chord: str | None = None
    order: int | None = None


class SectionReorderRequest(BaseModel):
    section_ids: list[UUID]


class SongSectionResponse(BaseModel):
    id: UUID
    song_id: UUID
    section_type: str
    section_label: str
    lyrics: str
    bars: int
    chord: str | None = None
    order: int

    class Config:
        from_attributes = True


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
    sections: list[SongSectionResponse] = []

    class Config:
        from_attributes = True
