from dataclasses import dataclass

from core.value_object import ValueObject


@dataclass(frozen=True, kw_only=True)
class Password(ValueObject):
    _value: str

    # #
    # factory

    @classmethod
    def from_str(cls, value) -> "Password":
        # type
        if not isinstance(value, str):
            raise  # InvalidError

        # length
        if len(value) < 8:
            raise  # TooShortError

        return cls(_value=value, by_factory=True)

    # #
    # query

    def to_str(self) -> str:
        return self._value