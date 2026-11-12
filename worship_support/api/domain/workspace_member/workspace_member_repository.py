from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import ForbiddenError, NotFoundError
from worship_support.api.domain.workspace_member.role import Role
from worship_support.api.domain.workspace_member.status import Status
from worship_support.api.domain.workspace_member.workspace_member import WorkspaceMember
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class WorkspaceMemberModel(CoreBase):
    __tablename__ = "workspace_member"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("workspace.id"), info={"scope": "workspace"})
    user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    role: Mapped[str] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


def _to_workspace_member(model: WorkspaceMemberModel) -> WorkspaceMember:
    return WorkspaceMember(
        id=model.id,
        workspace_id=model.workspace_id,
        user_id=model.user_id,
        role=Role.from_str(model.role),
        status=Status.from_str(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
        by_factory=True,
    )


_open_workspace = sa.table("workspace", sa.column("id"), sa.column("closed_at"))


# #
# repository

class WorkspaceMemberRepository(PostgresRepository[WorkspaceMember, WorkspaceMemberModel]):
    model = WorkspaceMemberModel
    mapper = _to_workspace_member
    tenant_column = "workspace_id"

    @classmethod
    async def tenanted_find_by_user(cls, *, session, workspace_id: UUID, user_id: UUID, lock: bool = False) -> WorkspaceMember | None:
        return await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceMemberModel.user_id == user_id],
            lock=lock,
        )

    @classmethod
    async def tenanted_get_active_by_user(cls, *, session, workspace_id: UUID, user_id: UUID) -> WorkspaceMember:
        found = await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceMemberModel.user_id == user_id, WorkspaceMemberModel.status == "ACTIVE"],
        )
        if found is None:
            raise ForbiddenError("공간 보기")
        return found

    @classmethod
    async def tenanted_get_active_by_id(cls, *, session, workspace_id: UUID, id: UUID, lock: bool = False) -> WorkspaceMember:
        found = await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceMemberModel.id == id, WorkspaceMemberModel.status == "ACTIVE"],
            lock=lock,
        )
        if found is None:
            raise NotFoundError("구성원", str(id))
        return found

    @classmethod
    async def tenanted_get_manager(cls, *, session, workspace_id: UUID, lock: bool = False) -> WorkspaceMember:
        found = await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceMemberModel.role == "MANAGER"],
            lock=lock,
        )
        if found is None:
            raise NotFoundError("관리자", str(workspace_id))
        return found

    @classmethod
    async def tenanted_search_active(cls, *, session, workspace_id: UUID) -> list[WorkspaceMember]:
        return await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceMemberModel.status == "ACTIVE"],
            order_by="created_at",
        )

    @classmethod
    async def tenanted_count_active(cls, *, session, workspace_id: UUID) -> int:
        return await cls._tenanted_count(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceMemberModel.status == "ACTIVE"],
        )

    @classmethod
    async def tenanted_update(cls, *, session, entity: WorkspaceMember) -> WorkspaceMember:
        updated = await cls._tenanted_update(session=session, entity=entity, workspace_id=entity.workspace_id)
        if updated is None:
            raise NotFoundError("구성원", str(entity.id))
        return updated

    @classmethod
    async def search_active_by_user(cls, *, session, user_id: UUID) -> list[WorkspaceMember]:
        return await cls._filter(
            session=session,
            where=[
                WorkspaceMemberModel.user_id == user_id,
                WorkspaceMemberModel.status == "ACTIVE",
                WorkspaceMemberModel.workspace_id.in_(
                    sa.select(_open_workspace.c.id).where(_open_workspace.c.closed_at.is_(None))
                ),
            ],
            order_by="created_at",
        )

    @classmethod
    async def search_shared_workspace_ids(cls, *, session, user_id: UUID, other_user_ids: list[UUID]) -> dict[UUID, list[UUID]]:
        if not other_user_ids:
            return {}
        mine = sa.select(WorkspaceMemberModel.workspace_id).where(
            WorkspaceMemberModel.user_id == user_id,
            WorkspaceMemberModel.status == "ACTIVE",
        )
        statement = (
            sa.select(WorkspaceMemberModel.user_id, WorkspaceMemberModel.workspace_id)
            .where(
                WorkspaceMemberModel.user_id.in_(other_user_ids),
                WorkspaceMemberModel.status == "ACTIVE",
                WorkspaceMemberModel.workspace_id.in_(mine),
            )
            .order_by(WorkspaceMemberModel.created_at.asc())
        )
        rows = (
            await session.execute(statement)
        ).all()
        shared: dict[UUID, list[UUID]] = {}
        for other_user_id, workspace_id in rows:
            shared.setdefault(other_user_id, []).append(workspace_id)
        return shared

    @classmethod
    async def search_active_counts(cls, *, session, workspace_ids: list[UUID]) -> dict[UUID, int]:
        if not workspace_ids:
            return {}
        statement = (
            sa.select(WorkspaceMemberModel.workspace_id, sa.func.count())
            .where(
                WorkspaceMemberModel.workspace_id.in_(workspace_ids),
                WorkspaceMemberModel.status == "ACTIVE",
            )
            .group_by(WorkspaceMemberModel.workspace_id)
        )
        rows = (
            await session.execute(statement)
        ).all()
        return {
            workspace_id: count for workspace_id, count in rows
        }

    @classmethod
    async def search_managers(cls, *, session, workspace_ids: list[UUID]) -> dict[UUID, UUID]:
        if not workspace_ids:
            return {}
        statement = sa.select(WorkspaceMemberModel.workspace_id, WorkspaceMemberModel.user_id).where(
            WorkspaceMemberModel.workspace_id.in_(workspace_ids),
            WorkspaceMemberModel.role == "MANAGER",
        )
        rows = (
            await session.execute(statement)
        ).all()
        return {
            workspace_id: user_id for workspace_id, user_id in rows
        }

    @classmethod
    async def shares_workspace(cls, *, session, user_id: UUID, other_user_id: UUID) -> bool:
        shared = await cls.search_shared_workspace_ids(session=session, user_id=user_id, other_user_ids=[other_user_id])
        return bool(shared.get(other_user_id))
