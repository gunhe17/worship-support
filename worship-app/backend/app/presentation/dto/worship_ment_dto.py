from uuid import UUID

from pydantic import BaseModel


class WorshipMentItem(BaseModel):
    id: str | None = None
    song_title: str
    section_label: str
    ment_text: str
    order: int


class WorshipMentListResponse(BaseModel):
    worship_id: str
    ments: list[WorshipMentItem]


class BatchSaveMentsRequest(BaseModel):
    worship_id: str
    ments: list[WorshipMentItem]


class BatchSaveMentsResponse(BaseModel):
    worship_id: str
    saved_count: int


class DeleteMentResponse(BaseModel):
    deleted: bool
