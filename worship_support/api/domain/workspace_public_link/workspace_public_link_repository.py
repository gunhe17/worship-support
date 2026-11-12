from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.workspace_public_link.workspace_public_link import WorkspacePublicLink
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class WorkspacePublicLinkModel(CoreBase):
    __tablename__ = "workspace_public_link"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    workspace_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("workspace.id"), info={"scope": "workspace"})
    token_hash: Mapped[str] = mapped_column(sa.Text)
    expires_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


def _to_workspace_public_link(model: WorkspacePublicLinkModel) -> WorkspacePublicLink:
    return WorkspacePublicLink(
        id=model.id,
        workspace_id=model.workspace_id,
        token_hash=TokenHash.from_str(model.token_hash),
        expires_at=(
            Moment.from_datetime(model.expires_at) if model.expires_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class WorkspacePublicLinkRepository(PostgresRepository[WorkspacePublicLink, WorkspacePublicLinkModel]):
    model = WorkspacePublicLinkModel
    mapper = _to_workspace_public_link
    tenant_column = "workspace_id"

    @classmethod
    async def tenanted_find_live(cls, *, session, workspace_id: UUID, lock: bool = False) -> WorkspacePublicLink | None:
        return await cls._tenanted_find(
            session=session,
            workspace_id=workspace_id,
            where=[WorkspacePublicLinkModel.expires_at.is_(None)],
            lock=lock,
        )

    @classmethod
    async def find_by_token_hash(cls, *, session, token_hash: TokenHash) -> WorkspacePublicLink | None:
        return await cls._find(
            session=session,
            where=[WorkspacePublicLinkModel.token_hash == token_hash.to_str()],
        )

    @classmethod
    async def tenanted_update(cls, *, session, entity: WorkspacePublicLink) -> WorkspacePublicLink:
        updated = await cls._tenanted_update(session=session, entity=entity, workspace_id=entity.workspace_id)
        if updated is None:
            raise NotFoundError("공개 링크", str(entity.id))
        return updated

    @classmethod
    async def tenanted_expire_live(cls, *, session, workspace_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(WorkspacePublicLinkModel)
            .where(
                WorkspacePublicLinkModel.workspace_id == workspace_id,
                WorkspacePublicLinkModel.expires_at.is_(None),
            )
            .values(expires_at=now)
        )
