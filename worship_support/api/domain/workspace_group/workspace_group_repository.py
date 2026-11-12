from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import StateError
from worship_support.api.domain.workspace_group.group_member.group_member_model import GroupMemberModel
from worship_support.api.domain.workspace_group.name import Name
from worship_support.api.domain.workspace_group.workspace_group import WorkspaceGroup
from worship_support.api.infrastructure.database.common.exception import UniqueViolationError
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class WorkspaceGroupModel(CoreBase):
    __tablename__ = "workspace_group"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("workspace.id"), info={"scope": "workspace"})
    name: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def _to_workspace_group(model: WorkspaceGroupModel) -> WorkspaceGroup:
    return WorkspaceGroup(
        id=model.id,
        workspace_id=model.workspace_id,
        name=Name.from_str(model.name),
        created_at=model.created_at,
        updated_at=model.updated_at,
        by_factory=True,
    )


_active_member = sa.table("workspace_member", sa.column("id"), sa.column("status"))


# #
# repository

class WorkspaceGroupRepository(PostgresRepository[WorkspaceGroup, WorkspaceGroupModel]):
    model = WorkspaceGroupModel
    mapper = _to_workspace_group
    tenant_column = "workspace_id"

    @classmethod
    async def tenanted_search(cls, *, session, workspace_id: UUID) -> list[WorkspaceGroup]:
        return await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceGroupModel.deleted_at.is_(None)],
            order_by="created_at",
        )

    @classmethod
    async def tenanted_add_unique_by_name(cls, *, session, entity: WorkspaceGroup) -> WorkspaceGroup:
        try:
            await cls._ensure_unique(
                session=session,
                where=[
                    WorkspaceGroupModel.workspace_id == entity.workspace_id,
                    WorkspaceGroupModel.deleted_at.is_(None),
                    sa.func.normalize_name(WorkspaceGroupModel.name) == sa.func.normalize_name(entity.name.to_str()),
                ],
                identifier=entity.name.to_str(),
            )
        except UniqueViolationError:
            raise StateError("group_name_taken")
        return await cls.add(session=session, entity=entity)

    @classmethod
    async def tenanted_search_member_counts(cls, *, session, workspace_id: UUID) -> dict[UUID, int]:
        statement = (
            sa.select(GroupMemberModel.group_id, sa.func.count())
            .join(_active_member, _active_member.c.id == GroupMemberModel.member_id)
            .where(
                GroupMemberModel.workspace_id == workspace_id,
                GroupMemberModel.removed_at.is_(None),
                _active_member.c.status == "ACTIVE",
            )
            .group_by(GroupMemberModel.group_id)
        )
        rows = (
            await session.execute(statement)
        ).all()
        return {
            group_id: count for group_id, count in rows
        }
