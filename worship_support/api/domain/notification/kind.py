from __future__ import annotations

from dataclasses import dataclass
from typing import ClassVar

from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.domain.common.exception import InvalidError, InvalidFormatError


# #
# value

@dataclass(frozen=True, kw_only=True)
class Kind(CoreValueObject):
    _value: str

    # hint
    _allowed_list: ClassVar[tuple[str, ...]] = ("FRIEND_REQUEST", "FRIEND_ACCEPTED", "WORKSPACE_INVITE", "WORKSPACE_INVITE_DECLINED", "MEMBER_JOINED", "MEMBER_RETURNED", "MEMBER_LEFT", "MEMBER_REMOVED", "MANAGER_TRANSFERRED", "WORKSPACE_CLOSED",)

    @classmethod
    def from_str(cls, value) -> "Kind":
        # type
        if not isinstance(value, str):
            raise InvalidError("알림 종류")
        # format
        if value not in cls._allowed_list:
            raise InvalidFormatError("알림 종류")
        return cls(_value=value, by_factory=True)

    def to_str(self) -> str:
        return self._value

    def is_(self, value: str) -> bool:
        return self._value == value
