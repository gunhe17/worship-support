from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SignupRequest:
    email: str
    password: str
    name: str


@dataclass(frozen=True)
class LoginRequest:
    email: str
    password: str


@dataclass(frozen=True)
class UserResponse:
    id: str
    email: str
    name: str
    status: str

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "status": self.status,
        }
