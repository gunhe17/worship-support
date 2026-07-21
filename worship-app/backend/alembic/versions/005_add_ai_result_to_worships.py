"""add ai_result to worships

Revision ID: 005
Revises: 004
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("worships", sa.Column("ai_result", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("worships", "ai_result")
