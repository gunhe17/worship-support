from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment


# #
# entity

@dataclass(frozen=True, kw_only=True)
class UserBlock(CoreEntity):
    user_id: UUID
    blocked_user_id: UUID
    ended_at: Moment | None = None

    @classmethod
    @typecheck
    def new(cls, *, user_id: UUID, blocked_user_id: UUID) -> "UserBlock":
        return cls(user_id=user_id, blocked_user_id=blocked_user_id, by_factory=True)

    def end(self, *, at: Moment) -> "UserBlock":
        return replace(self, by_factory=True, ended_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
            "user_id": str(self.blocked_user_id),
            "blocked_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }

    def to_model(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "blocked_user_id": self.blocked_user_id,
            "ended_at": (
                self.ended_at.to_datetime() if self.ended_at else None
            ),
        }
