"""add page_order to song_sheets

Revision ID: 011
Revises: 010
Create Date: 2026-08-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("song_sheets", sa.Column("page_order", sa.Integer, nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("song_sheets", "page_order")
