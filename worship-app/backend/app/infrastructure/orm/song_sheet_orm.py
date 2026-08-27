import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.database import Base


class SongSheetORM(Base):
    __tablename__ = "song_sheets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(10), nullable=False)
    sheet_url: Mapped[str] = mapped_column(Text, nullable=False)
    page_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
