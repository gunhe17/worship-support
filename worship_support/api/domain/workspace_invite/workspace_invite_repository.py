from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.user.email import Email
from worship_support.api.domain.workspace_invite.attempts import Attempts
from worship_support.api.domain.workspace_invite.workspace_invite import WorkspaceInvite
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class WorkspaceInviteModel(CoreBase):
    __tablename__ = "workspace_invite"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("workspace.id"), info={"scope": "workspace"})
    recipient_email: Mapped[str] = mapped_column(sa.Text)
    code_hash: Mapped[str] = mapped_column(sa.Text)
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    accepted_by_user_id: Mapped[UUID | None] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"))
    failed_attempts: Mapped[int] = mapped_column(sa.SmallInteger)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


def _to_workspace_invite(model: WorkspaceInviteModel) -> WorkspaceInvite:
    return WorkspaceInvite(
        id=model.id,
        workspace_id=model.workspace_id,
        recipient_email=Email.from_str(model.recipient_email),
        code_hash=TokenHash.from_str(model.code_hash),
        expires_at=Moment.from_datetime(model.expires_at),
        accepted_by_user_id=model.accepted_by_user_id,
        failed_attempts=Attempts.from_int(model.failed_attempts),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class WorkspaceInviteRepository(PostgresRepository[WorkspaceInvite, WorkspaceInviteModel]):
    model = WorkspaceInviteModel
    mapper = _to_workspace_invite
    tenant_column = "workspace_id"

    @classmethod
    async def find_live_by_code_hash(cls, *, session, code_hash: TokenHash, now: datetime, lock: bool = False) -> WorkspaceInvite | None:
        return await cls._find(
            session=session,
            where=[
                WorkspaceInviteModel.code_hash == code_hash.to_str(),
                WorkspaceInviteModel.expires_at > now,
            ],
            lock=lock,
        )

    @classmethod
    async def exists_live_by_code_hash(cls, *, session, code_hash: TokenHash, now: datetime) -> bool:
        return await cls._exists(
            session=session,
            where=[
                WorkspaceInviteModel.code_hash == code_hash.to_str(),
                WorkspaceInviteModel.expires_at > now,
            ],
        )

    @classmethod
    async def tenanted_search_live_by_email(cls, *, session, workspace_id: UUID, email: Email, now: datetime) -> list[WorkspaceInvite]:
        return await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=[
                WorkspaceInviteModel.recipient_email == email.to_str(),
                WorkspaceInviteModel.expires_at > now,
            ],
            lock=True,
        )

    @classmethod
    async def tenanted_search(cls, *, session, workspace_id: UUID) -> list[WorkspaceInvite]:
        return await cls._tenanted_filter(
            session=session,
            workspace_id=workspace_id,
            where=[],
            order_by="created_at",
            descending=True,
        )

    @classmethod
    async def tenanted_get_by_id(cls, *, session, workspace_id: UUID, id: UUID) -> WorkspaceInvite:
        found = await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceInviteModel.id == id],
            lock=True,
        )
        if found is None:
            raise NotFoundError("초대", str(id))
        return found

    @classmethod
    async def tenanted_count_live(cls, *, session, workspace_id: UUID, now: datetime) -> int:
        return await cls._tenanted_count(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspaceInviteModel.expires_at > now],
        )

    @classmethod
    async def tenanted_update(cls, *, session, entity: WorkspaceInvite) -> WorkspaceInvite:
        updated = await cls._tenanted_update(session=session, entity=entity, workspace_id=entity.workspace_id)
        if updated is None:
            raise NotFoundError("초대", str(entity.id))
        return updated

    @classmethod
    async def tenanted_expire_live(cls, *, session, workspace_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(WorkspaceInviteModel)
            .where(
                WorkspaceInviteModel.workspace_id == workspace_id,
                WorkspaceInviteModel.expires_at > now,
            )
            .values(expires_at=now)
        )
