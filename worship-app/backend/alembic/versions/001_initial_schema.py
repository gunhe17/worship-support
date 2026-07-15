"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "worships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("scripture", sa.String(500), nullable=False),
        sa.Column("theme", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "songs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("artist", sa.String(200), nullable=False),
        sa.Column("default_key", sa.String(10), nullable=False),
        sa.Column("bpm", sa.Integer, nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("lyrics", sa.Text, nullable=False),
        sa.Column("sheet", sa.String(500), nullable=True),
    )

    op.create_table(
        "song_arrangements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("song_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("songs.id"), nullable=False),
        sa.Column("worship_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("worships.id"), nullable=False),
        sa.Column("key", sa.String(10), nullable=False),
        sa.Column("tempo", sa.Integer, nullable=False),
        sa.Column("song_form", postgresql.ARRAY(sa.Text), nullable=False),
        sa.Column("ment", sa.Text, nullable=False),
        sa.Column("memo", sa.Text, nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
    )

    op.create_table(
        "youtube_references",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("song_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("songs.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("channel", sa.String(200), nullable=False),
        sa.Column("arrangement_type", sa.String(100), nullable=False),
    )

    op.create_table(
        "sheets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("song_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("songs.id"), nullable=False),
        sa.Column("key", sa.String(10), nullable=False),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("pdf_url", sa.String(500), nullable=True),
    )

    op.create_index("ix_worships_created_at", "worships", ["created_at"])
    op.create_index("ix_songs_title", "songs", ["title"])
    op.create_index("ix_song_arrangements_worship_id", "song_arrangements", ["worship_id"])


def downgrade() -> None:
    op.drop_table("sheets")
    op.drop_table("youtube_references")
    op.drop_table("song_arrangements")
    op.drop_table("songs")
    op.drop_table("worships")
