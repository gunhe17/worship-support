"""add duration_minutes to worships

Revision ID: 002
Revises: 001
Create Date: 2026-07-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "worships",
        sa.Column("duration_minutes", sa.Integer, nullable=False, server_default="30"),
    )


def downgrade() -> None:
    op.drop_column("worships", "duration_minutes")
