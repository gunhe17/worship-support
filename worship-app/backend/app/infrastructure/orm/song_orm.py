import uuid

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.db.database import Base


class SongORM(Base):
    __tablename__ = "songs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    artist: Mapped[str] = mapped_column(String(200), nullable=False)
    default_key: Mapped[str] = mapped_column(String(10), nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    lyrics: Mapped[str] = mapped_column(Text, nullable=False)
    sheet: Mapped[str | None] = mapped_column(String(500), nullable=True)
