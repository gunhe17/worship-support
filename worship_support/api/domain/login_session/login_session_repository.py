from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.login_session.device_label import DeviceLabel
from worship_support.api.domain.login_session.login_session import LoginSession
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class LoginSessionModel(CoreBase):
    __tablename__ = "user_session"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    token_hash: Mapped[str] = mapped_column(sa.Text)
    device_label: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    last_used_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def _to_login_session(model: LoginSessionModel) -> LoginSession:
    return LoginSession(
        id=model.id,
        user_id=model.user_id,
        token_hash=TokenHash.from_str(model.token_hash),
        device_label=(
            DeviceLabel.from_str(model.device_label) if model.device_label else None
        ),
        last_used_at=Moment.from_datetime(model.last_used_at),
        revoked_at=(
            Moment.from_datetime(model.revoked_at) if model.revoked_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class LoginSessionRepository(PostgresRepository[LoginSession, LoginSessionModel]):
    model = LoginSessionModel
    mapper = _to_login_session

    @classmethod
    async def find_valid_by_token_hash(cls, *, session, token_hash: TokenHash, now: datetime, days: int) -> LoginSession | None:
        return await cls._find(
            session=session,
            where=[
                LoginSessionModel.token_hash == token_hash.to_str(),
                LoginSessionModel.revoked_at.is_(None),
                LoginSessionModel.last_used_at > now - timedelta(days=days),
            ],
        )

    @classmethod
    async def search_valid_by_user(cls, *, session, user_id: UUID, now: datetime, days: int) -> list[LoginSession]:
        return await cls._filter(
            session=session,
            where=[
                LoginSessionModel.user_id == user_id,
                LoginSessionModel.revoked_at.is_(None),
                LoginSessionModel.last_used_at > now - timedelta(days=days),
            ],
            order_by="last_used_at",
            descending=True,
        )

    @classmethod
    async def get_by_id_and_user(cls, *, session, id: UUID, user_id: UUID) -> LoginSession:
        found = await cls._find(
            session=session,
            where=[
                LoginSessionModel.id == id,
                LoginSessionModel.user_id == user_id,
                LoginSessionModel.revoked_at.is_(None),
            ],
        )
        if found is None:

            raise NotFoundError("로그인 기기", str(id))
        return found

    @classmethod
    async def revoke_all_for_user(cls, *, session, user_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(LoginSessionModel)
            .where(
                LoginSessionModel.user_id == user_id,
                LoginSessionModel.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
