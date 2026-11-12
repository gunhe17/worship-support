from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase


# #
# model

class GroupMemberModel(CoreBase):
    __tablename__ = "workspace_group_member"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(sa.Uuid, info={"scope": "workspace"})
    group_id: Mapped[UUID] = mapped_column(sa.Uuid)
    member_id: Mapped[UUID] = mapped_column(sa.Uuid)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    removed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
