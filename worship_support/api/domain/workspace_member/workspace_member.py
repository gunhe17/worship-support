from __future__ import annotations

from dataclasses import dataclass, replace
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace_member.role import Role
from worship_support.api.domain.workspace_member.status import Status


# #
# entity

@dataclass(frozen=True, kw_only=True)
class WorkspaceMember(CoreEntity):
    workspace_id: UUID
    user_id: UUID
    role: Role
    status: Status

    @classmethod
    @typecheck
    def new(cls, *, workspace_id: UUID, user_id: UUID, role: Role) -> "WorkspaceMember":
        return cls(workspace_id=workspace_id, user_id=user_id, role=role, status=Status.from_str("ACTIVE"), by_factory=True)

    def is_active(self) -> bool:
        return self.status.is_("ACTIVE")

    def is_manager(self) -> bool:
        return self.role.is_("MANAGER") and self.is_active()

    def rejoin(self) -> "WorkspaceMember":
        return replace(self, by_factory=True, status=Status.from_str("ACTIVE"))

    def leave(self) -> "WorkspaceMember":
        return replace(self, by_factory=True, role=Role.from_str("MEMBER"), status=Status.from_str("LEFT"))

    def remove(self) -> "WorkspaceMember":
        return replace(self, by_factory=True, role=Role.from_str("MEMBER"), status=Status.from_str("REMOVED"))

    def promote(self) -> "WorkspaceMember":
        return replace(self, by_factory=True, role=Role.from_str("MANAGER"))

    def demote(self) -> "WorkspaceMember":
        return replace(self, by_factory=True, role=Role.from_str("MEMBER"))

    def to_dict(self):
        return {
            "id": str(self.id),
            "workspace_id": str(self.workspace_id),
            "user_id": str(self.user_id),
            "role": self.role.to_str(),
            "status": self.status.to_str(),
        }

    def to_model(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "role": self.role.to_str(),
            "status": self.status.to_str(),
        }
