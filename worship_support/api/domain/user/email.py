from __future__ import annotations

import re
from dataclasses import dataclass
from typing import ClassVar

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError, InvalidFormatError


# #
# value

@dataclass(frozen=True, kw_only=True)
class Email(CoreValueObject):
    _value: str

    # hint
    _pattern: ClassVar[str] = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    _max_length: ClassVar[int] = 320

    @classmethod
    def from_str(cls, value) -> "Email":
        # type
        if not isinstance(value, str):
            raise InvalidError("이메일")
        # normalize
        normalized = value.strip().lower()
        # format
        if len(normalized) > cls._max_length or not re.match(cls._pattern, normalized):
            raise InvalidFormatError("이메일")
        return cls(_value=normalized, by_factory=True)

    def to_str(self) -> str:
        return self._value
