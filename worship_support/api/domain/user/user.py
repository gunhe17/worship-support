from __future__ import annotations

from dataclasses import dataclass, replace

from worship_support.api.core.entity import Entity as CoreEntity
from worship_support.api.core.validate import typecheck
from worship_support.api.domain.user.name import Name
from worship_support.api.domain.user.status import Status


# #
# entity

@dataclass(frozen=True, kw_only=True)
class User(CoreEntity):
    name: Name | None
    status: Status

    @classmethod
    @typecheck
    def new(cls, *, name: Name) -> "User":
        return cls(name=name, status=Status.from_str("ACTIVE"), by_factory=True)

    def with_name(self, name: Name) -> "User":
        return replace(self, by_factory=True, name=name)

    def withdraw(self) -> "User":
        return replace(self, by_factory=True, name=None, status=Status.from_str("WITHDRAWN"))

    def is_active(self) -> bool:
        return self.status.is_("ACTIVE")

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": (
                self.name.to_str() if self.name else None
            ),
            "status": self.status.to_str(),
        }

    def to_model(self):
        return {
            "id": self.id,
            "name": (
                self.name.to_str() if self.name else None
            ),
            "status": self.status.to_str(),
        }
