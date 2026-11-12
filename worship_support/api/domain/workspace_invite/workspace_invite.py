from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.common.token_hash import TokenHash
from worship_support.api.domain.user.email import Email
from worship_support.api.domain.workspace_invite.attempts import Attempts


# #
# entity

@dataclass(frozen=True, kw_only=True)
class WorkspaceInvite(CoreEntity):
    workspace_id: UUID
    recipient_email: Email
    code_hash: TokenHash
    expires_at: Moment
    accepted_by_user_id: UUID | None = None
    failed_attempts: Attempts

    @classmethod
    @typecheck
    def new(cls, *, workspace_id: UUID, recipient_email: Email, code_hash: TokenHash, expires_at: Moment) -> "WorkspaceInvite":
        return cls(
            workspace_id=workspace_id,
            recipient_email=recipient_email,
            code_hash=code_hash,
            expires_at=expires_at,
            failed_attempts=Attempts.from_int(0),
            by_factory=True,
        )

    def is_live(self, *, now: Moment) -> bool:
        return self.expires_at.to_datetime() > now.to_datetime()

    def expire(self, *, at: Moment) -> "WorkspaceInvite":
        return replace(self, by_factory=True, expires_at=at)

    def accept(self, *, user_id: UUID, at: Moment) -> "WorkspaceInvite":
        return replace(self, by_factory=True, accepted_by_user_id=user_id, expires_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
            "kind": "email",
            "email": self.recipient_email.to_str(),
            "expires_at": self.expires_at.to_str(),
            "accepted": self.accepted_by_user_id is not None,
            "created_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }

    def to_model(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "recipient_email": self.recipient_email.to_str(),
            "code_hash": self.code_hash.to_str(),
            "expires_at": self.expires_at.to_datetime(),
            "accepted_by_user_id": self.accepted_by_user_id,
            "failed_attempts": self.failed_attempts.to_int(),
        }
