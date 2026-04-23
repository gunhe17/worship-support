from __future__ import annotations

import re
from dataclasses import dataclass

from app.auth.exceptions import InvalidEmailFormatException, InvalidValueObjectException


# ──────────────────────────────────────────────
# Value Objects
# ──────────────────────────────────────────────

@dataclass(frozen=True)
class UserId:
    value: int

    def __post_init__(self) -> None:
        if not isinstance(self.value, int) or self.value <= 0:
            raise InvalidValueObjectException("UserId는 양의 정수여야 합니다.")

@dataclass(frozen=True)
class Email:
    value: str

    def __post_init__(self) -> None:
        # 소문자로 정규화 (frozen이라 object.__setattr__ 사용)
        object.__setattr__(self, "value", self.value.strip().lower())

        if not isinstance(self.value, str) or not re.match(
            r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", self.value
        ):
            raise InvalidEmailFormatException()