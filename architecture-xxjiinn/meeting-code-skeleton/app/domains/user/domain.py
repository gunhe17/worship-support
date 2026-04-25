from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError


class UserStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    DEACTIVATED = "deactivated"


@dataclass(frozen=True)
class Email:
    value: str


@dataclass(frozen=True)
class RawPassword:
    value: str


@dataclass(frozen=True)
class PasswordHash:
    value: str


@dataclass
class User:
    id: str
    email: Email
    password_hash: PasswordHash
    name: str
    status: UserStatus

    def ensure_can_login(self) -> None:
        if self.status is not UserStatus.ACTIVE:
            raise AppError(
                ErrorCode.AUTH_USER_NOT_ACTIVE,
                context={"user_status": self.status.value},
            )
