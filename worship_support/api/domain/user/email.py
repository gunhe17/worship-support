import re
from dataclasses import dataclass

from worship_support.architecture.core.value_object import ValueObject


@dataclass(frozen=True, kw_only=True)
class Email(ValueObject):
    _value: str

    # #
    # factory

    @classmethod
    def from_str(cls, value) -> "Email":
        # type
        if not isinstance(value, str):
            raise  # InvalidError

        # format
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", value):
            raise  # InvalidFormatError

        return cls(_value=value, by_factory=True)

    # #
    # query

    def to_str(self) -> str:
        return self._value
