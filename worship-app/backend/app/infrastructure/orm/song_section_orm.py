import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.database import Base


class SongSectionORM(Base):
    __tablename__ = "song_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    song_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    section_type: Mapped[str] = mapped_column(String(50), nullable=False)
    section_label: Mapped[str] = mapped_column(String(100), nullable=False)
    lyrics: Mapped[str] = mapped_column(Text, nullable=False, default="")
    bars: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    chord: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
