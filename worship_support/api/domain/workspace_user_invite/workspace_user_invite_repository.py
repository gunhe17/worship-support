from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace_user_invite.workspace_user_invite import WorkspaceUserInvite
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class WorkspaceUserInviteModel(CoreBase):
    __tablename__ = "workspace_user_invite"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("workspace.id"), info={"scope": "workspace"})
    recipient_user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    accepted_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    declined_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


def _to_workspace_user_invite(model: WorkspaceUserInviteModel) -> WorkspaceUserInvite:
    return WorkspaceUserInvite(
        id=model.id,
        workspace_id=model.workspace_id,
        recipient_user_id=model.recipient_user_id,
        expires_at=Moment.from_datetime(model.expires_at),
        accepted_at=(
            Moment.from_datetime(model.accepted_at) if model.accepted_at else None
        ),
        declined_at=(
            Moment.from_datetime(model.declined_at) if model.declined_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class WorkspaceUserInviteRepository(PostgresRepository[WorkspaceUserInvite, WorkspaceUserInviteModel]):
    model = WorkspaceUserInviteModel
    mapper = _to_workspace_user_invite
    tenant_column = "workspace_id"

    @classmethod
    async def tenanted_search_live_for_user(cls, *, session, workspace_id: UUID, user_id: UUID, now: datetime) -> list[WorkspaceUserInvite]:
        return await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=[
                WorkspaceUserInviteModel.recipient_user_id == user_id,
                WorkspaceUserInviteModel.expires_at > now,
            ],
            lock=True,
        )

    @classmethod
    async def tenanted_search(cls, *, session, workspace_id: UUID) -> list[WorkspaceUserInvite]:
        return await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=[],
            order_by="created_at",
            descending=True,
        )

    @classmethod
    async def tenanted_get_by_id(cls, *, session, workspace_id: UUID, id: UUID) -> WorkspaceUserInvite:
        found = await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceUserInviteModel.id == id],
            lock=True,
        )
        if found is None:
            raise NotFoundError("초대", str(id))
        return found

    @classmethod
    async def get_by_id_for_recipient(cls, *, session, id: UUID, user_id: UUID) -> WorkspaceUserInvite:
        found = await cls._find(
            session=session,
            where=[
                WorkspaceUserInviteModel.id == id,
                WorkspaceUserInviteModel.recipient_user_id == user_id,
            ],
            lock=True,
        )
        if found is None:
            raise NotFoundError("초대", str(id))
        return found

    @classmethod
    async def search_live_for_recipient(cls, *, session, user_id: UUID, now: datetime) -> list[WorkspaceUserInvite]:
        return await cls._filter(
            session=session,
            where=[
                WorkspaceUserInviteModel.recipient_user_id == user_id,
                WorkspaceUserInviteModel.expires_at > now,
            ],
            order_by="created_at",
            descending=True,
        )

    @classmethod
    async def tenanted_count_live(cls, *, session, workspace_id: UUID, now: datetime) -> int:
        return await cls._tenanted_count(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceUserInviteModel.expires_at > now],
        )

    @classmethod
    async def tenanted_update(cls, *, session, entity: WorkspaceUserInvite) -> WorkspaceUserInvite:
        updated = await cls._tenanted_update(session=session, entity=entity, workspace_id=entity.workspace_id)
        if updated is None:
            raise NotFoundError("초대", str(entity.id))
        return updated

    @classmethod
    async def tenanted_expire_live(cls, *, session, workspace_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(WorkspaceUserInviteModel)
            .where(
                WorkspaceUserInviteModel.workspace_id == workspace_id,
                WorkspaceUserInviteModel.expires_at > now,
            )
            .values(expires_at=now)
        )
