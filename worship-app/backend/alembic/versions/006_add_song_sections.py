"""add song_sections table

Revision ID: 006
Revises: 005
Create Date: 2026-07-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "song_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "song_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("songs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("section_type", sa.String(50), nullable=False),
        sa.Column("section_label", sa.String(100), nullable=False),
        sa.Column("lyrics", sa.Text, nullable=False, server_default=""),
        sa.Column("bars", sa.Integer, nullable=False, server_default="8"),
        sa.Column("chord", sa.String(500), nullable=True),
        sa.Column("order", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_song_sections_song_id", "song_sections", ["song_id"])


def downgrade() -> None:
    op.drop_index("ix_song_sections_song_id", table_name="song_sections")
    op.drop_table("song_sections")
