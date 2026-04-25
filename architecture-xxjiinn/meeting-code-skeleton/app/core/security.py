from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AccessTokenPayload:
    user_id: str
    token_type: str


class PasswordHasher:
    def hash(self, raw_password: str) -> str:
        raise NotImplementedError

    def verify(self, raw_password: str, password_hash: str) -> bool:
        raise NotImplementedError


class TokenService:
    def issue_access_token(self, user_id: str) -> str:
        raise NotImplementedError

    def verify_access_token(self, token: str) -> AccessTokenPayload:
        raise NotImplementedError
