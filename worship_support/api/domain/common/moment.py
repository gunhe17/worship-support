from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError, InvalidFormatError


# #
# value

@dataclass(frozen=True, kw_only=True)
class Moment(CoreValueObject):
    _value: datetime

    @classmethod
    def from_datetime(cls, value) -> "Moment":
        # type
        if not isinstance(value, datetime):
            raise InvalidError("Moment")
        # format
        if value.tzinfo is None:
            raise InvalidFormatError("Moment")
        return cls(_value=value, by_factory=True)

    def to_str(self) -> str:
        return self._value.isoformat()

    def to_datetime(self) -> datetime:
        return self._value
