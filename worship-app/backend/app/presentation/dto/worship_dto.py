from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WorshipCreateRequest(BaseModel):
    title: str
    scripture: str
    sermon_direction: str = Field(default="", max_length=500)
    duration_minutes: int = 30


class WorshipFromTextRequest(BaseModel):
    raw_text: str
    duration_minutes: int = 30


class WorshipUpdateRequest(BaseModel):
    title: str | None = None
    scripture: str | None = None
    sermon_direction: str | None = Field(default=None, max_length=500)
    duration_minutes: int | None = None
    leader_meditation: str | None = None


class WorshipResponse(BaseModel):
    id: UUID
    title: str
    scripture: str
    sermon_direction: str = ""
    duration_minutes: int = 30
    leader_meditation: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


# ── Arrangement (콘티) ────────────────────────────────────────────────────────

class SectionSummary(BaseModel):
    id: UUID
    section_type: str
    section_label: str
    order: int


class ArrangementCreateRequest(BaseModel):
    song_id: UUID
    order: int = 0
    song_form: list[str] = []
    ment: str = ""


class ArrangementBulkItem(BaseModel):
    song_id: UUID
    order: int = 0
    song_form: list[str] = []
    ment: str = ""


class ArrangementUpdateRequest(BaseModel):
    song_form: list[str] | None = None
    ment: str | None = None
    order: int | None = None
    sheet_url: str | None = None


class ArrangementResponse(BaseModel):
    id: UUID
    worship_id: UUID
    song_id: UUID
    order: int
    song_form: list[str]
    ment: str
    sheet_url: str | None = None
    song_title: str = ""
    song_artist: str = ""
    song_bpm: int = 80
    sections: list[SectionSummary] = []

    class Config:
        from_attributes = True
