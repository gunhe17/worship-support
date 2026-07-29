"""add worship_ments table

Revision ID: 004
Revises: 003
Create Date: 2026-07-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "worship_ments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("worship_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("song_title", sa.String(200), nullable=False),
        sa.Column("section_label", sa.String(100), nullable=False),
        sa.Column("ment_text", sa.Text, nullable=False),
        sa.Column("order", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_worship_ments_worship_id", "worship_ments", ["worship_id"])


def downgrade() -> None:
    op.drop_index("ix_worship_ments_worship_id", table_name="worship_ments")
    op.drop_table("worship_ments")
