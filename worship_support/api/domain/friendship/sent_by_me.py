from __future__ import annotations

from dataclasses import dataclass

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError


# #
# value

@dataclass(frozen=True, kw_only=True)
class SentByMe(CoreValueObject):
    _value: bool

    @classmethod
    def from_bool(cls, value) -> "SentByMe":
        # type
        if not isinstance(value, bool):
            raise InvalidError("보낸 요청 여부")
        return cls(_value=value, by_factory=True)

    def to_bool(self) -> bool:
        return self._value
