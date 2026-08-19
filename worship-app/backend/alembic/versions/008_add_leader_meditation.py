"""add leader_meditation to worships

Revision ID: 008
Revises: 007
Create Date: 2026-08-04
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("worships", sa.Column("leader_meditation", sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("worships", "leader_meditation")
