"""add song_arrangements table

Revision ID: 009
Revises: 008
Create Date: 2026-08-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if "song_arrangements" not in existing_tables:
        op.create_table(
            "song_arrangements",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("worship_id", UUID(as_uuid=True), sa.ForeignKey("worships.id", ondelete="CASCADE"), nullable=False),
            sa.Column("song_id", UUID(as_uuid=True), sa.ForeignKey("songs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("order", sa.Integer(), nullable=False, default=0),
            sa.Column("song_form", ARRAY(sa.String()), nullable=False, server_default="{}"),
            sa.Column("ment", sa.Text(), nullable=False, server_default=""),
            sa.Column("memo", sa.Text(), nullable=False, server_default=""),
            sa.Column("key", sa.String(10), nullable=False, server_default=""),
            sa.Column("tempo", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("sheet_url", sa.Text(), nullable=True),
        )
        op.create_index("ix_song_arrangements_worship_id", "song_arrangements", ["worship_id"])
    else:
        # 테이블이 이미 존재하는 경우 누락된 컬럼만 추가
        existing_cols = {col["name"] for col in inspector.get_columns("song_arrangements")}

        if "sheet_url" not in existing_cols:
            op.add_column("song_arrangements", sa.Column("sheet_url", sa.Text(), nullable=True))
        if "memo" not in existing_cols:
            op.add_column("song_arrangements", sa.Column("memo", sa.Text(), nullable=False, server_default=""))
        if "key" not in existing_cols:
            op.add_column("song_arrangements", sa.Column("key", sa.String(10), nullable=False, server_default=""))
        if "tempo" not in existing_cols:
            op.add_column("song_arrangements", sa.Column("tempo", sa.Integer(), nullable=False, server_default="0"))
        if "song_form" not in existing_cols:
            op.add_column("song_arrangements", sa.Column("song_form", ARRAY(sa.String()), nullable=False, server_default="{}"))
        if "ment" not in existing_cols:
            op.add_column("song_arrangements", sa.Column("ment", sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_index("ix_song_arrangements_worship_id", "song_arrangements")
    op.drop_table("song_arrangements")
