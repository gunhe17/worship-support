from __future__ import annotations

from dataclasses import dataclass

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError, InvalidFormatError


# #
# value

@dataclass(frozen=True, kw_only=True)
class Attempts(CoreValueObject):
    _value: int

    @classmethod
    def from_int(cls, value) -> "Attempts":
        # type
        if not isinstance(value, int) or isinstance(value, bool):
            raise InvalidError("틀린 횟수")
        # range
        if value < 0:
            raise InvalidFormatError("틀린 횟수")
        return cls(_value=value, by_factory=True)

    def to_int(self) -> int:
        return self._value
