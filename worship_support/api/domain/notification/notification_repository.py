from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from worship_support.api.core.model import Base as CoreBase
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.notification.display_text import DisplayText
from worship_support.api.domain.notification.kind import Kind
from worship_support.api.domain.notification.notification import Notification
from worship_support.api.domain.notification.target_type import TargetType
from worship_support.api.infrastructure.database.postgresql.repository import PostgresRepository


# #
# model

class NotificationModel(CoreBase):
    __tablename__ = "user_notification"

    id: Mapped[UUID] = mapped_column(sa.Uuid, primary_key=True)
    recipient_user_id: Mapped[UUID] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"), info={"scope": "account"})
    notification_type: Mapped[str] = mapped_column(sa.Text)
    actor_user_id: Mapped[UUID | None] = mapped_column(sa.Uuid, sa.ForeignKey("users.id"))
    target_type: Mapped[str | None] = mapped_column(sa.Text)
    target_id: Mapped[UUID | None] = mapped_column(sa.Uuid, info={"ref_by": "target_type"})
    display_text: Mapped[str] = mapped_column(sa.Text)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), server_default=sa.func.now())
    read_at: Mapped[datetime | None] = mapped_column(sa.DateTime(timezone=True))


def _to_notification(model: NotificationModel) -> Notification:
    return Notification(
        id=model.id,
        recipient_user_id=model.recipient_user_id,
        kind=Kind.from_str(model.notification_type),
        actor_user_id=model.actor_user_id,
        target_type=(
            TargetType.from_str(model.target_type) if model.target_type else None
        ),
        target_id=model.target_id,
        display_text=DisplayText.from_str(model.display_text),
        read_at=(
            Moment.from_datetime(model.read_at) if model.read_at else None
        ),
        created_at=model.created_at,
        by_factory=True,
    )


# #
# repository

class NotificationRepository(PostgresRepository[Notification, NotificationModel]):
    model = NotificationModel
    mapper = _to_notification

    @classmethod
    async def search_recent_for_user(cls, *, session, user_id: UUID, now: datetime, days: int) -> list[Notification]:
        return await cls._filter(
            session=session,
            where=[
                NotificationModel.recipient_user_id == user_id,
                NotificationModel.created_at > now - timedelta(days=days),
            ],
            order_by="created_at",
            descending=True,
            limit=200,
        )

    @classmethod
    async def read_all_for_user(cls, *, session, user_id: UUID, now: datetime) -> None:
        await session.execute(
            sa.update(NotificationModel)
            .where(
                NotificationModel.recipient_user_id == user_id,
                NotificationModel.read_at.is_(None),
            )
            .values(read_at=now)
        )
