import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.db.database import Base


class PostORM(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_name: Mapped[str] = mapped_column(String(200), nullable=False)
    scripture: Mapped[str] = mapped_column(String(500), nullable=False)
    meditation: Mapped[str] = mapped_column(Text, nullable=False, default="")
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    post_songs: Mapped[list["PostSongORM"]] = relationship(
        "PostSongORM", back_populates="post", cascade="all, delete-orphan"
    )
    comments: Mapped[list["CommentORM"]] = relationship(
        "CommentORM", back_populates="post", cascade="all, delete-orphan"
    )


class PostSongORM(Base):
    __tablename__ = "post_songs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    song_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("songs.id", ondelete="CASCADE"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ment: Mapped[str] = mapped_column(Text, nullable=False, default="")

    post: Mapped["PostORM"] = relationship("PostORM", back_populates="post_songs")


class CommentORM(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_name: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    post: Mapped["PostORM"] = relationship("PostORM", back_populates="comments")
