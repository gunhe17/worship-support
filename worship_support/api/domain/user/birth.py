import re
from dataclasses import dataclass

from worship_support.architecture.core.value_object import ValueObject


@dataclass(frozen=True, kw_only=True)
class Birth(ValueObject):
    _value: str
    
    # hint
    _format: str = "%Y-%m-%d"

    # #
    # factory

    @classmethod
    def from_str(cls, value) -> "Birth":
        # type
        if not isinstance(value, str):
            raise  # InvalidError

        # format
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
            raise  # InvalidFormatError

        return cls(_value=value, by_factory=True)

    # #
    # query

    def to_str(self) -> str:
        return self._value