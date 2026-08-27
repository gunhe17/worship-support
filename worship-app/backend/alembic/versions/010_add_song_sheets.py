"""add song_sheets table

Revision ID: 010
Revises: 009
Create Date: 2026-08-26
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "song_sheets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "song_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("songs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("key", sa.String(10), nullable=False),
        sa.Column("sheet_url", sa.Text, nullable=False),
    )
    op.create_index("ix_song_sheets_song_id", "song_sheets", ["song_id"])


def downgrade() -> None:
    op.drop_index("ix_song_sheets_song_id", table_name="song_sheets")
    op.drop_table("song_sheets")
