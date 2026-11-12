from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.user_block.user_block import UserBlock
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class UserBlockModel(CoreBase):
    __tablename__ = "user_block"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    blocked_user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    ended_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def _to_user_block(model: UserBlockModel) -> UserBlock:
    return UserBlock(
        id=model.id,
        user_id=model.user_id,
        blocked_user_id=model.blocked_user_id,
        ended_at=(
            Moment.from_datetime(model.ended_at) if model.ended_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class UserBlockRepository(PostgresRepository[UserBlock, UserBlockModel]):
    model = UserBlockModel
    mapper = _to_user_block

    @classmethod
    async def verify_blocked_either_way(cls, *, session, user_id: UUID, other_user_id: UUID) -> bool:
        return await cls._exists(
            session=session,
            where=[
                UserBlockModel.ended_at.is_(None),
                sa.or_(
                    sa.and_(UserBlockModel.user_id == user_id, UserBlockModel.blocked_user_id == other_user_id),
                    sa.and_(UserBlockModel.user_id == other_user_id, UserBlockModel.blocked_user_id == user_id),
                ),
            ],
        )

    @classmethod
    async def find_live(cls, *, session, user_id: UUID, blocked_user_id: UUID) -> UserBlock | None:
        return await cls._find(
            session=session,
            where=[
                UserBlockModel.user_id == user_id,
                UserBlockModel.blocked_user_id == blocked_user_id,
                UserBlockModel.ended_at.is_(None),
            ],
            lock=True,
        )

    @classmethod
    async def search_live_for_user(cls, *, session, user_id: UUID) -> list[UserBlock]:
        return await cls._filter(
            session=session,
            where=[
                UserBlockModel.user_id == user_id,
                UserBlockModel.ended_at.is_(None),
            ],
            order_by="created_at",
            descending=True,
        )

    @classmethod
    async def search_blocked_either_way(cls, *, session, user_id: UUID) -> set[UUID]:
        blocks = await cls._filter(
            session=session,
            where=[
                UserBlockModel.ended_at.is_(None),
                sa.or_(UserBlockModel.user_id == user_id, UserBlockModel.blocked_user_id == user_id),
            ],
        )
        return {
            block.blocked_user_id if block.user_id == user_id else block.user_id for block in blocks
        }

    @classmethod
    async def end_all_for_user(cls, *, session, user_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(UserBlockModel)
            .where(
                sa.or_(UserBlockModel.user_id == user_id, UserBlockModel.blocked_user_id == user_id),
                UserBlockModel.ended_at.is_(None),
            )
            .values(ended_at=now)
        )
