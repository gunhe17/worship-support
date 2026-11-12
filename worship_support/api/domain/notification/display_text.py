from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError, InvalidFormatError


# #
# value

@dataclass(frozen=True, kw_only=True)
class DisplayText(CoreValueObject):
    _value: str

    # hint
    _min_length: ClassVar[int] = 1
    _max_length: ClassVar[int] = 500

    @classmethod
    def from_str(cls, value) -> "DisplayText":
        # type
        if not isinstance(value, str):
            raise InvalidError("알림 문구")
        # normalize
        normalized = value.strip()
        # length
        if not (cls._min_length <= len(normalized) <= cls._max_length):
            raise InvalidFormatError("알림 문구")
        return cls(_value=normalized, by_factory=True)

    def to_str(self) -> str:
        return self._value
