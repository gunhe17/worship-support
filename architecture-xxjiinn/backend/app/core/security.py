from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError


@dataclass(frozen=True)
class AccessTokenPayload:
    user_id: str
    token_type: str = "access"


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


class RefreshTokenService:
    def issue_refresh_token(self) -> str:
        raise NotImplementedError

    def hash_refresh_token(self, token: str) -> str:
        raise NotImplementedError

    def issue_csrf_token(self) -> str:
        raise NotImplementedError


class PBKDF2PasswordHasher(PasswordHasher):
    _iterations = 600_000

    def hash(self, raw_password: str) -> str:
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            raw_password.encode("utf-8"),
            salt.encode("utf-8"),
            self._iterations,
        ).hex()
        return f"pbkdf2_sha256${self._iterations}${salt}${digest}"

    def verify(self, raw_password: str, password_hash: str) -> bool:
        algorithm, iterations, salt, expected = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            raw_password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iterations),
        ).hex()
        return hmac.compare_digest(digest, expected)


class SignedTokenService(TokenService):
    def issue_access_token(self, user_id: str) -> str:
        payload = {"user_id": user_id, "token_type": "access"}
        payload_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        payload_part = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
        signature = hmac.new(
            settings.access_token_secret.encode("utf-8"),
            payload_part.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return f"{payload_part}.{signature}"

    def verify_access_token(self, token: str) -> AccessTokenPayload:
        try:
            payload_part, signature = token.split(".", 1)
        except ValueError as exc:
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED, cause=exc) from exc

        expected_signature = hmac.new(
            settings.access_token_secret.encode("utf-8"),
            payload_part.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)

        padded = payload_part + "=" * (-len(payload_part) % 4)
        try:
            payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")))
        except Exception as exc:
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED, cause=exc) from exc

        if payload.get("token_type") != "access":
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)

        user_id = payload.get("user_id")
        if not isinstance(user_id, str) or not user_id:
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)

        return AccessTokenPayload(user_id=user_id)


class OpaqueRefreshTokenService(RefreshTokenService):
    def issue_refresh_token(self) -> str:
        return secrets.token_urlsafe(32)

    def hash_refresh_token(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def issue_csrf_token(self) -> str:
        return secrets.token_urlsafe(24)


def now_utc() -> datetime:
    return datetime.now(UTC)


def days_from_now(days: int) -> datetime:
    return now_utc() + timedelta(days=days)
