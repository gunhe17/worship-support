from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.login_session.device_label import DeviceLabel


# #
# entity

@dataclass(frozen=True, kw_only=True)
class LoginSession(CoreEntity):
    user_id: UUID
    token_hash: TokenHash
    device_label: DeviceLabel | None
    last_used_at: Moment | None = None
    revoked_at: Moment | None = None

    @classmethod
    @typecheck
    def new(cls, *, user_id: UUID, token_hash: TokenHash, device_label: DeviceLabel | None) -> "LoginSession":
        return cls(user_id=user_id, token_hash=token_hash, device_label=device_label, by_factory=True)

    def touch(self, *, at: Moment) -> "LoginSession":
        return replace(self, by_factory=True, last_used_at=at)

    def revoke(self, *, at: Moment) -> "LoginSession":
        return replace(self, by_factory=True, revoked_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
            "device_label": (
                self.device_label.to_str() if self.device_label else None
            ),
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
            "last_used_at": (
                self.last_used_at.to_str() if self.last_used_at else None
            ),
        }

    def to_model(self):
        model = {
            "id": self.id,
            "user_id": self.user_id,
            "token_hash": self.token_hash.to_str(),
            "device_label": (
                self.device_label.to_str() if self.device_label else None
            ),
            "revoked_at": (
                self.revoked_at.to_datetime() if self.revoked_at else None
            ),
        }
        if self.last_used_at is not None:
            model["last_used_at"] = self.last_used_at.to_datetime()
        return model
