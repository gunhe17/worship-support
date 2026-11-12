from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.workspace_group.name import Name


# #
# entity

@dataclass(frozen=True, kw_only=True)
class WorkspaceGroup(CoreEntity):
    workspace_id: UUID
    name: Name

    @classmethod
    @typecheck
    def new(cls, *, workspace_id: UUID, name: Name) -> "WorkspaceGroup":
        return cls(workspace_id=workspace_id, name=name, by_factory=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name.to_str(),
        }

    def to_model(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "name": self.name.to_str(),
        }
