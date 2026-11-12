from __future__ import annotations

import re
from dataclasses import dataclass
from typing import ClassVar

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError, InvalidFormatError


# #
# value

@dataclass(frozen=True, kw_only=True)
class TokenHash(CoreValueObject):
    _value: str

    # hint
    _pattern: ClassVar[str] = r"^[0-9a-f]{64}$"

    @classmethod
    def from_str(cls, value) -> "TokenHash":
        # type
        if not isinstance(value, str):
            raise InvalidError("TokenHash")
        # format
        if not re.match(cls._pattern, value):
            raise InvalidFormatError("TokenHash")
        return cls(_value=value, by_factory=True)

    def to_str(self) -> str:
        return self._value
