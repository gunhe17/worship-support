from __future__ import annotations

from dataclasses import InitVar, dataclass, field
from datetime import datetime
from uuid import UUID, uuid4

from worship_support.api.core.exception import DevelopError as CoreDevelopError


# #
# base

@dataclass(frozen=True, kw_only=True)
class Entity:
    id: UUID = field(default_factory=uuid4)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    by_factory: InitVar[bool] = False

    def __post_init__(self, by_factory: bool):
        if not by_factory:
            raise CoreDevelopError(message=f"{type(self).__name__} 팩토리 필요 (실제: 직접 생성)", code=500)
