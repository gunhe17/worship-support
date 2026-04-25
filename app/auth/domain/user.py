from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime

from app.auth.exceptions import (
    InvalidEmailFormatException,
    InvalidPasswordFormatException,
    InvalidValueObjectException,
)


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

@dataclass(frozen=True)
class RawPassword: #입력된 비밀번호가 
    value: str

    _PATTERN = re.compile(r"^(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]).{8,16}$")

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self._PATTERN.match(self.value):
            raise InvalidPasswordFormatException()

@dataclass(frozen=True) # Hash는 도메인 영역이 아니라 인프라 영역에 뒀기 때문에 빈값인지만 확인함
class HashedPassword:
    value: str

    def __post_init__(self) -> None:
        if not isinstance(self.value, str) or not self.value.strip():
            raise InvalidValueObjectException("HashedPassword는 비어있을 수 없습니다.")

@dataclass(frozen=True)
class RefreshTokenId:
    value: str

    def __post_init__(self) -> None:
        try:
            uuid.UUID(self.value, version=4)
        except (ValueError, AttributeError):
            raise InvalidValueObjectException("RefreshTokenId는 UUID v4 형식이어야 합니다.")


# ──────────────────────────────────────────────
# Entity
# ──────────────────────────────────────────────

@dataclass
class User:
    id: UserId
    email: Email
    password: HashedPassword
    is_active: bool = True
    is_verified: bool = False
    deleted_at: datetime | None = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def deactivate(self) -> None:
        """탈퇴: 즉시 비활성화 + 삭제 시각 기록."""
        self.is_active = False
        self.deleted_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def verify_email(self) -> None:
        """이메일 인증 완료."""
        self.is_verified = True
        self.updated_at = datetime.utcnow()

    def is_withdrawable(self) -> bool:
        """이미 탈퇴한 계정인지 확인."""
        return self.deleted_at is not None