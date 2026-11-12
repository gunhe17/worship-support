from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.exception import NotFoundError
from worship_support.api.domain.user.name import Name
from worship_support.api.domain.user.social_account.provider import Provider
from worship_support.api.domain.user.social_account.social_account import SocialAccount
from worship_support.api.domain.user.social_account.social_account_model import SocialAccountModel, to_social_account
from worship_support.api.domain.user.social_account.subject import Subject
from worship_support.api.domain.user.status import Status
from worship_support.api.domain.user.user import User
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class UserModel(CoreBase):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True, info={"scope": "account"})
    name: Mapped[str | None] = mapped_column(sa.Text)
    status: Mapped[str] = mapped_column(sa.Text)
    phone_e164: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())


def _to_user(model: UserModel) -> User:
    return User(
        id=model.id,
        name=(
            Name.from_str(model.name) if model.name else None
        ),
        status=Status.from_str(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
        by_factory=True,
    )


# #
# repository

class UserRepository(PostgresRepository[User, UserModel]):
    model = UserModel
    mapper = _to_user

    @classmethod
    async def get_by_id(cls, *, session, id: UUID) -> User:
        found = await cls.find_by_id(session=session, id=id)
        if found is None:
            raise NotFoundError("사용자", str(id))
        return found

    @classmethod
    async def get_active_by_id(cls, *, session, id: UUID) -> User:
        found = await cls._find(session=session, where=[UserModel.id == id, UserModel.status == "ACTIVE"])
        if found is None:
            raise NotFoundError("사용자", str(id))
        return found

    @classmethod
    async def lock(cls, *, session, ids: list[UUID]) -> None:
        await cls._lock_rows(session=session, model=UserModel, ids=ids)

    # #
    # social account

    @classmethod
    async def find_by_social(cls, *, session, provider: Provider, subject: Subject) -> User | None:
        statement = (
            sa.select(UserModel)
            .join(SocialAccountModel, SocialAccountModel.user_id == UserModel.id)
            .where(
                SocialAccountModel.provider == provider.to_str(),
                SocialAccountModel.subject == subject.to_str(),
                SocialAccountModel.unlinked_at.is_(None),
            )
        )
        row = (
            await session.execute(statement)
        ).scalar_one_or_none()
        return _to_user(row) if row is not None else None

    @classmethod
    async def add_social_account(cls, *, session, entity: SocialAccount) -> SocialAccount:
        row = SocialAccountModel(**entity.to_model())
        session.add(row)
        await session.flush()
        await session.refresh(row)
        return to_social_account(row)

    @classmethod
    async def search_social_accounts(cls, *, session, user_id: UUID) -> list[SocialAccount]:
        statement = (
            sa.select(SocialAccountModel)
            .where(
                SocialAccountModel.user_id == user_id,
                SocialAccountModel.unlinked_at.is_(None),
            )
            .order_by(SocialAccountModel.created_at.asc())
        )
        rows = (
            await session.execute(statement)
        ).scalars().all()
        return [
            to_social_account(row) for row in rows
        ]

    @classmethod
    async def search_display_emails(cls, *, session, user_ids: list[UUID]) -> dict[UUID, str]:
        if not user_ids:
            return {}
        statement = (
            sa.select(SocialAccountModel.user_id, SocialAccountModel.provider_email)
            .where(
                SocialAccountModel.user_id.in_(user_ids),
                SocialAccountModel.unlinked_at.is_(None),
                SocialAccountModel.provider_email.is_not(None),
            )
            .order_by(SocialAccountModel.created_at.asc())
        )
        rows = (
            await session.execute(statement)
        ).all()
        emails: dict[UUID, str] = {}
        for user_id, email in rows:
            emails.setdefault(user_id, email)
        return emails

    @classmethod
    async def unlink_all_social_accounts(cls, *, session, user_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(SocialAccountModel)
            .where(
                SocialAccountModel.user_id == user_id,
                SocialAccountModel.unlinked_at.is_(None),
            )
            .values(subject=None, provider_email=None, unlinked_at=now)
        )

    @classmethod
    async def withdraw(cls, *, session, entity: User) -> User:
        await session.execute(
            sa.update(UserModel)
            .where(UserModel.id == entity.id)
            .values(name=None, phone_e164=None, status=entity.status.to_str(), updated_at=sa.func.now())
        )
        return await cls.get_by_id(session=session, id=entity.id)
