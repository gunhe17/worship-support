from __future__ import annotations

from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.user.email import Email
from worship_support.api.domain.user.social_account.provider import Provider
from worship_support.api.domain.user.social_account.social_account import SocialAccount
from worship_support.api.domain.user.social_account.subject import Subject


# #
# model

class SocialAccountModel(CoreBase):
    __tablename__ = "user_social_account"
    __table_args__ = {"info": {"scope_via": "user_id"}}

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    provider: Mapped[str] = mapped_column(sa.Text)
    subject: Mapped[str | None] = mapped_column(sa.Text)
    provider_email: Mapped[str | None] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    unlinked_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def to_social_account(model: SocialAccountModel) -> SocialAccount:
    return SocialAccount(
        id=model.id,
        user_id=model.user_id,
        provider=Provider.from_str(model.provider),
        subject=(
            Subject.from_str(model.subject) if model.subject else None
        ),
        provider_email=(
            Email.from_str(model.provider_email) if model.provider_email else None
        ),
        created_at=model.created_at,
        updated_at=model.updated_at,
        by_factory=True,
    )
