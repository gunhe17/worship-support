from dataclasses import dataclass

from worship_support.architecture.core.value_object import ValueObject


@dataclass(frozen=True, kw_only=True)
class Name(ValueObject):
    _value: str
    
    # #
    # factory

    @classmethod
    def from_str(cls, value) -> "Name":
        # type
        if not isinstance(value, str):
            raise # InvalidError
        
        # value
        if value == "":
            raise # EmptyValueError

        return cls(_value=value, by_factory=True)

    # #
    # query

    def to_str(self) -> str:
        return self._value