import uuid

from sqlalchemy import ARRAY, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.database import Base


class SongArrangementORM(Base):
    __tablename__ = "song_arrangements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worship_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("worships.id", ondelete="CASCADE"), nullable=False
    )
    song_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    song_form: Mapped[list] = mapped_column(ARRAY(String), nullable=False, default=list)
    ment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    memo: Mapped[str] = mapped_column(Text, nullable=False, default="")
    key: Mapped[str] = mapped_column(String(10), nullable=False, default="")
    tempo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sheet_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
