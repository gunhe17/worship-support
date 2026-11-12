from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError, StateError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace.name import Name
from worship_support.api.domain.workspace.workspace import Workspace
from worship_support.api.domain.workspace_member.workspace_member_repository import WorkspaceMemberModel
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class WorkspaceModel(CoreBase):
    __tablename__ = "workspace"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, info={"scope": "workspace"})
    name: Mapped[str] = mapped_column(sa.Text)
    closed_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


def _to_workspace(model: WorkspaceModel) -> Workspace:
    return Workspace(
        id=model.id,
        name=Name.from_str(model.name),
        closed_at=(
            Moment.from_datetime(model.closed_at) if model.closed_at else None
        ),
        created_at=model.created_at,
        updated_at=model.updated_at,
        by_factory=True,
    )


# #
# repository

class WorkspaceRepository(PostgresRepository[Workspace, WorkspaceModel]):
    model = WorkspaceModel
    mapper = _to_workspace

    @classmethod
    async def get_open_by_id(cls, *, session, id: UUID, lock: bool = False) -> Workspace:
        found = await cls._find(session=session, where=[WorkspaceModel.id == id], lock=lock)
        if found is None:
            raise NotFoundError("공간", str(id))
        if found.is_closed():
            raise StateError("workspace_closed")
        return found

    @classmethod
    async def update(cls, *, session, entity: Workspace) -> Workspace:
        updated = await cls._update(session=session, entity=entity, where=[])
        if updated is None:
            raise NotFoundError("공간", str(entity.id))
        return updated

    @classmethod
    async def ensure_name_free_for_user(cls, *, session, name: Name, user_id: UUID, exclude_id: UUID | None = None) -> None:
        where = [
            sa.func.normalize_name(WorkspaceModel.name) == sa.func.normalize_name(name.to_str()),
            WorkspaceModel.closed_at.is_(None),
            WorkspaceModel.id.in_(
                sa.select(WorkspaceMemberModel.workspace_id).where(
                    WorkspaceMemberModel.user_id == user_id,
                    WorkspaceMemberModel.status == "ACTIVE",
                )
            ),
        ]
        if exclude_id is not None:
            where.append(WorkspaceModel.id != exclude_id)
        if await cls._exists(session=session, where=where):
            raise StateError("workspace_name_taken")
