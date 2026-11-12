from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.friendship.friendship import Friendship
from worship_support.api.domain.friendship.sent_by_me import SentByMe
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class FriendshipModel(CoreBase):
    __tablename__ = "user_friendship"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    pair_id: Mapped[UUID] = mapped_column(sa.Uuid)
    user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    friend_user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"))
    sent_by_me: Mapped[bool] = mapped_column(sa.Boolean)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    accepted_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def _to_friendship(model: FriendshipModel) -> Friendship:
    return Friendship(
        id=model.id,
        pair_id=model.pair_id,
        user_id=model.user_id,
        friend_user_id=model.friend_user_id,
        sent_by_me=SentByMe.from_bool(model.sent_by_me),
        accepted_at=(
            Moment.from_datetime(model.accepted_at) if model.accepted_at else None
        ),
        ended_at=(
            Moment.from_datetime(model.ended_at) if model.ended_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class FriendshipRepository(PostgresRepository[Friendship, FriendshipModel]):
    model = FriendshipModel
    mapper = _to_friendship

    @classmethod
    async def add_pair(cls, *, session, pair: tuple[Friendship, Friendship]) -> Friendship:
        sent = await cls.add(session=session, entity=pair[0])
        await cls.add(session=session, entity=pair[1])
        return sent

    @classmethod
    async def find_live_between(cls, *, session, user_id: UUID, other_user_id: UUID) -> Friendship | None:
        return await cls._find(
            session=session,
            where=[
                FriendshipModel.user_id == user_id,
                FriendshipModel.friend_user_id == other_user_id,
                FriendshipModel.ended_at.is_(None),
            ],
            lock=True,
        )

    @classmethod
    async def get_live_by_pair_for_user(cls, *, session, pair_id: UUID, user_id: UUID) -> Friendship:
        found = await cls._find(
            session=session,
            where=[
                FriendshipModel.pair_id == pair_id,
                FriendshipModel.user_id == user_id,
            ],
            lock=True,
        )
        if found is None:
            raise NotFoundError("친구 요청", str(pair_id))
        return found

    @classmethod
    async def find_by_pair_for_user(cls, *, session, pair_id: UUID, user_id: UUID) -> Friendship | None:
        return await cls._find(
            session=session,
            where=[
                FriendshipModel.pair_id == pair_id,
                FriendshipModel.user_id == user_id,
            ],
        )

    @classmethod
    async def update_pair(cls, *, session, entity: Friendship) -> Friendship:
        values = {
            "accepted_at": (
                entity.accepted_at.to_datetime() if entity.accepted_at else None
            ),
            "ended_at": (
                entity.ended_at.to_datetime() if entity.ended_at else None
            ),
        }
        await session.execute(
            sa.update(FriendshipModel)
            .where(FriendshipModel.pair_id == entity.pair_id)
            .values(**values)
        )
        found = await cls.find_by_pair_for_user(session=session, pair_id=entity.pair_id, user_id=entity.user_id)
        if found is None:
            raise NotFoundError("친구 요청", str(entity.pair_id))
        return found

    @classmethod
    async def search_live_for_user(cls, *, session, user_id: UUID) -> list[Friendship]:
        return await cls._filter(
            session=session,
            where=[
                FriendshipModel.user_id == user_id,
                FriendshipModel.ended_at.is_(None),
            ],
            order_by="created_at",
            descending=True,
        )

    @classmethod
    async def search_friend_user_ids(cls, *, session, user_id: UUID) -> set[UUID]:
        friends = await cls._filter(
            session=session,
            where=[
                FriendshipModel.user_id == user_id,
                FriendshipModel.ended_at.is_(None),
                FriendshipModel.accepted_at.is_not(None),
            ],
        )
        return {
            friend.friend_user_id for friend in friends
        }

    @classmethod
    async def count_pending_sent(cls, *, session, user_id: UUID) -> int:
        return await cls._count(
            session=session,
            where=[
                FriendshipModel.user_id == user_id,
                FriendshipModel.sent_by_me.is_(True),
                FriendshipModel.accepted_at.is_(None),
                FriendshipModel.ended_at.is_(None),
            ],
        )

    @classmethod
    async def count_sent_since(cls, *, session, user_id: UUID, now: datetime) -> int:
        return await cls._count(
            session=session,
            where=[
                FriendshipModel.user_id == user_id,
                FriendshipModel.sent_by_me.is_(True),
                FriendshipModel.created_at > now - timedelta(days=1),
            ],
        )

    @classmethod
    async def end_all_for_user(cls, *, session, user_id: UUID, now: datetime) -> None:
        pair_ids = sa.select(FriendshipModel.pair_id).where(
            FriendshipModel.user_id == user_id,
            FriendshipModel.ended_at.is_(None),
        )
        await session.execute(
            sa.update(FriendshipModel)
            .where(FriendshipModel.pair_id.in_(pair_ids))
            .values(ended_at=now)
        )
