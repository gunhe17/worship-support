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
class WorkspacePublicLink(CoreEntity):
    workspace_id: UUID
    token_hash: TokenHash
    expires_at: Moment | None = None

    @classmethod
    @typecheck
    def new(cls, *, id: UUID, workspace_id: UUID, token_hash: TokenHash) -> "WorkspacePublicLink":
        return cls(id=id, workspace_id=workspace_id, token_hash=token_hash, by_factory=True)

    def disable(self, *, at: Moment) -> "WorkspacePublicLink":
        return replace(self, by_factory=True, expires_at=at)

    def to_dict(self):
        return {
            "id": str(self.id),
            "enabled": self.expires_at is None,
        }

    def to_model(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "token_hash": self.token_hash.to_str(),
            "expires_at": (
                self.expires_at.to_datetime() if self.expires_at else None
            ),
        }
