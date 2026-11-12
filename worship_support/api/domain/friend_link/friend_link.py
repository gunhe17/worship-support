from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash


# #
# entity

@dataclass(frozen=True, kw_only=True)
class FriendLink(CoreEntity):
    user_id: UUID
    token_hash: TokenHash
    expires_at: Moment | None = None

    @classmethod
    @typecheck
    def new(cls, *, id: UUID, user_id: UUID, token_hash: TokenHash) -> "FriendLink":
        return cls(id=id, user_id=user_id, token_hash=token_hash, by_factory=True)

    def disable(self, *, at: Moment) -> "FriendLink":
        return replace(self, by_factory=True, expires_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
        }

    def to_model(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token_hash": self.token_hash.to_str(),
            "expires_at": (
                self.expires_at.to_datetime() if self.expires_at else None
            ),
        }
