from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.user.email import Email
from worship_support.api.domain.user.social_account.provider import Provider
from worship_support.api.domain.user.social_account.subject import Subject


# #
# entity

@dataclass(frozen=True, kw_only=True)
class SocialAccount(CoreEntity):
    user_id: UUID
    provider: Provider
    subject: Subject | None
    provider_email: Email | None

    @classmethod
    @typecheck
    def new(cls, *, user_id: UUID, provider: Provider, subject: Subject, provider_email: Email | None) -> "SocialAccount":
        return cls(user_id=user_id, provider=provider, subject=subject, provider_email=provider_email, by_factory=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "provider": self.provider.to_str(),
            "email": (
                self.provider_email.to_str() if self.provider_email else None
            ),
            "linked_at": (
                self.created_at.isoformat() if self.created_at else None
            ),
        }

    def to_model(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider.to_str(),
            "subject": (
                self.subject.to_str() if self.subject else None
            ),
            "provider_email": (
                self.provider_email.to_str() if self.provider_email else None
            ),
        }
