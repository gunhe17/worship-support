from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator


EmailText = Annotated[
    str,
    StringConstraints(pattern=r"^[^@]+@[^@]+\.[^@]+$"),
]
PasswordText = Annotated[
    str,
    StringConstraints(min_length=8),
]


class SignupRequest(BaseModel):
    email: EmailText
    password: PasswordText
    name: str = Field(min_length=1)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("Password must include letters and numbers.")
        return value


class LoginRequest(BaseModel):
    email: EmailText
    password: PasswordText

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not any(ch.isalpha() for ch in value) or not any(ch.isdigit() for ch in value):
            raise ValueError("Password must include letters and numbers.")
        return value


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    status: str
