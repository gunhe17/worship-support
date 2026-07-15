"""replace theme with sermon_direction

Revision ID: 003
Revises: 002
Create Date: 2026-07-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # theme 컬럼을 sermon_direction으로 변경하고 타입을 Text로 확장
    op.alter_column("worships", "theme", new_column_name="sermon_direction")
    op.alter_column("worships", "sermon_direction", type_=sa.Text, existing_nullable=False)


def downgrade() -> None:
    op.alter_column("worships", "sermon_direction", new_column_name="theme")
    op.alter_column("worships", "theme", type_=sa.String(200), existing_nullable=False)
