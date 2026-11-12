from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment


# #
# entity

@dataclass(frozen=True, kw_only=True)
class WorkspaceUserInvite(CoreEntity):
    workspace_id: UUID
    recipient_user_id: UUID
    expires_at: Moment
    accepted_at: Moment | None = None
    declined_at: Moment | None = None

    @classmethod
    @typecheck
    def new(cls, *, workspace_id: UUID, recipient_user_id: UUID, expires_at: Moment) -> "WorkspaceUserInvite":
        return cls(workspace_id=workspace_id, recipient_user_id=recipient_user_id, expires_at=expires_at, by_factory=True)

    def is_live(self, *, now: Moment) -> bool:
        return self.expires_at.to_datetime() > now.to_datetime()

    def state(self, *, now: Moment) -> str:
        if self.accepted_at is not None:
            return "accepted"
        if self.declined_at is not None:
            return "declined"
        if self.is_live(now=now):
            return "pending"
        return "expired"

    def accept(self, *, at: Moment) -> "WorkspaceUserInvite":
        return replace(self, by_factory=True, accepted_at=at, expires_at=at)

    def decline(self, *, at: Moment) -> "WorkspaceUserInvite":
        return replace(self, by_factory=True, declined_at=at, expires_at=at)

    def expire(self, *, at: Moment) -> "WorkspaceUserInvite":
        return replace(self, by_factory=True, expires_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
            "kind": "friend",
            "workspace_id": str(self.workspace_id),
            "recipient_user_id": str(self.recipient_user_id),
            "expires_at": self.expires_at.to_str(),
            "accepted_at": (
                self.accepted_at.to_str() if self.accepted_at else None
            ),
            "declined_at": (
                self.declined_at.to_str() if self.declined_at else None
            ),
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }

    def to_model(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "recipient_user_id": self.recipient_user_id,
            "expires_at": self.expires_at.to_datetime(),
            "accepted_at": (
                self.accepted_at.to_datetime() if self.accepted_at else None
            ),
            "declined_at": (
                self.declined_at.to_datetime() if self.declined_at else None
            ),
        }
