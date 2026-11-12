from __future__ import annotations

from dataclasses import InitVar, dataclass

from worship_support.api.core.exception import DevelopError as CoreDevelopError


# #
# base

@dataclass(frozen=True, kw_only=True)
class ValueObject:
    by_factory: InitVar[bool] = False

    def __post_init__(self, by_factory: bool):
        if not by_factory:
            raise CoreDevelopError(message=f"{type(self).__name__} 팩토리 필요 (실제: 직접 생성)", code=500)
