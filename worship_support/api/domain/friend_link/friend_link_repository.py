from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.friend_link.friend_link import FriendLink
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class FriendLinkModel(CoreBase):
    __tablename__ = "user_friend_link"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    token_hash: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    expires_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def _to_friend_link(model: FriendLinkModel) -> FriendLink:
    return FriendLink(
        id=model.id,
        user_id=model.user_id,
        token_hash=TokenHash.from_str(model.token_hash),
        expires_at=(
            Moment.from_datetime(model.expires_at) if model.expires_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class FriendLinkRepository(PostgresRepository[FriendLink, FriendLinkModel]):
    model = FriendLinkModel
    mapper = _to_friend_link

    @classmethod
    async def find_live_for_user(cls, *, session, user_id: UUID) -> FriendLink | None:
        return await cls._find(
            session=session,
            where=[
                FriendLinkModel.user_id == user_id,
                FriendLinkModel.expires_at.is_(None),
            ],
            lock=True,
        )

    @classmethod
    async def get_live_by_token_hash(cls, *, session, token_hash: TokenHash) -> FriendLink:
        found = await cls._find(
            session=session,
            where=[
                FriendLinkModel.token_hash == token_hash.to_str(),
                FriendLinkModel.expires_at.is_(None),
            ],
        )
        if found is None:
            raise NotFoundError("친구 링크", "-")
        return found

    @classmethod
    async def disable(cls, *, session, entity: FriendLink) -> FriendLink:
        updated = await cls._update(session=session, entity=entity, where=[])
        if updated is None:
            raise NotFoundError("친구 링크", str(entity.id))
        return updated

    @classmethod
    async def end_all_for_user(cls, *, session, user_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(FriendLinkModel)
            .where(
                FriendLinkModel.user_id == user_id,
                FriendLinkModel.expires_at.is_(None),
            )
            .values(expires_at=now)
        )
