from __future__ import annotations

from dataclasses import dataclass, replace

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.common.moment import Moment
from worship_support.api.domain.workspace.name import Name


# #
# entity

@dataclass(frozen=True, kw_only=True)
class Workspace(CoreEntity):
    name: Name
    closed_at: Moment | None = None

    @classmethod
    @typecheck
    def new(cls, *, name: Name) -> "Workspace":
        return cls(name=name, by_factory=True)

    def with_name(self, name: Name) -> "Workspace":
        return replace(self, by_factory=True, name=name)

    def close(self, *, at: Moment) -> "Workspace":
        return replace(self, by_factory=True, closed_at=at)

    def is_closed(self) -> bool:
        return self.closed_at is not None

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name.to_str(),
        }

    def to_model(self):
        return {
            "id": self.id,
            "name": self.name.to_str(),
            "closed_at": (
                self.closed_at.to_datetime() if self.closed_at else None
            ),
        }
