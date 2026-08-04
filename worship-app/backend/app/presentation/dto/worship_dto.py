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


class WorshipResponse(BaseModel):
    id: UUID
    title: str
    scripture: str
    sermon_direction: str = ""
    duration_minutes: int = 30
    created_at: datetime

    class Config:
        from_attributes = True
