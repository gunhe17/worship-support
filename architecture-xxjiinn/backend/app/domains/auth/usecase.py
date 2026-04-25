from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.core.security import (
    PasswordHasher,
    RefreshTokenService,
    TokenService,
    days_from_now,
    now_utc,
)
from app.domains.auth.repository import RefreshTokenRecord, RefreshTokenRepository
from app.domains.auth.schema import LoginRequest, SignupRequest, UserResponse
from app.domains.user.domain import Email, PasswordHash, User, UserStatus
from app.domains.user.repository import UserRepository


@dataclass
class SignupUsecase:
    user_repository: UserRepository
    password_hasher: PasswordHasher

    def execute(self, request: SignupRequest) -> UserResponse:
        email = Email(str(request.email))
        if self.user_repository.exists_by_email(email):
            raise AppError(ErrorCode.AUTH_EMAIL_ALREADY_EXISTS)

        user = User(
            id=str(uuid4()),
            email=email,
            password_hash=PasswordHash(self.password_hasher.hash(request.password)),
            name=request.name,
            status=UserStatus.ACTIVE,
        )
        self.user_repository.add(user)
        return UserResponse(
            id=user.id,
            email=user.email.value,
            name=user.name,
            status=user.status.value,
        )


@dataclass
class LoginResult:
    user: UserResponse
    access_token: str
    refresh_token: str
    csrf_token: str


@dataclass
class LoginUsecase:
    user_repository: UserRepository
    password_hasher: PasswordHasher
    token_service: TokenService
    refresh_token_repository: RefreshTokenRepository
    refresh_token_service: RefreshTokenService

    def execute(self, request: LoginRequest) -> LoginResult:
        user = self.user_repository.get_by_email(Email(str(request.email)))
        if user is None:
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

        user.ensure_can_login()
        if not self.password_hasher.verify(request.password, user.password_hash.value):
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

        access_token = self.token_service.issue_access_token(user.id)
        refresh_token = self.refresh_token_service.issue_refresh_token()
        token_hash = self.refresh_token_service.hash_refresh_token(refresh_token)
        self.refresh_token_repository.add(
            RefreshTokenRecord(
                id=self.refresh_token_repository.next_id(),
                user_id=user.id,
                token_hash=token_hash,
                expires_at=days_from_now(7),
                created_at=now_utc(),
            )
        )
        return LoginResult(
            user=UserResponse(
                id=user.id,
                email=user.email.value,
                name=user.name,
                status=user.status.value,
            ),
            access_token=access_token,
            refresh_token=refresh_token,
            csrf_token=self.refresh_token_service.issue_csrf_token(),
        )


@dataclass
class GetCurrentUserUsecase:
    user_repository: UserRepository
    token_service: TokenService

    def execute(self, access_token: str) -> UserResponse:
        payload = self.token_service.verify_access_token(access_token)
        user = self.user_repository.get(payload.user_id)
        if user is None:
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)
        user.ensure_can_login()
        return UserResponse(
            id=user.id,
            email=user.email.value,
            name=user.name,
            status=user.status.value,
        )


@dataclass
class RefreshResult:
    access_token: str
    refresh_token: str
    csrf_token: str


@dataclass
class RefreshUsecase:
    user_repository: UserRepository
    token_service: TokenService
    refresh_token_repository: RefreshTokenRepository
    refresh_token_service: RefreshTokenService

    def execute(self, refresh_token: str) -> RefreshResult:
        token_hash = self.refresh_token_service.hash_refresh_token(refresh_token)
        record = self.refresh_token_repository.get_by_token_hash(token_hash)
        if record is None:
            raise AppError(ErrorCode.AUTH_REFRESH_TOKEN_INVALID)

        if record.is_revoked():
            self.refresh_token_repository.revoke_all_for_user(record.user_id, now_utc())
            raise AppError(ErrorCode.AUTH_REFRESH_TOKEN_REUSED)

        if record.is_expired(now_utc()):
            raise AppError(ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED)

        user = self.user_repository.get(record.user_id)
        if user is None:
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)
        user.ensure_can_login()

        self.refresh_token_repository.revoke(record, now_utc())
        next_refresh_token = self.refresh_token_service.issue_refresh_token()
        next_token_hash = self.refresh_token_service.hash_refresh_token(next_refresh_token)
        self.refresh_token_repository.add(
            RefreshTokenRecord(
                id=self.refresh_token_repository.next_id(),
                user_id=user.id,
                token_hash=next_token_hash,
                expires_at=days_from_now(7),
                created_at=now_utc(),
            )
        )
        return RefreshResult(
            access_token=self.token_service.issue_access_token(user.id),
            refresh_token=next_refresh_token,
            csrf_token=self.refresh_token_service.issue_csrf_token(),
        )


@dataclass
class LogoutUsecase:
    refresh_token_repository: RefreshTokenRepository
    refresh_token_service: RefreshTokenService

    def execute(self, refresh_token: str | None) -> None:
        if not refresh_token:
            return
        token_hash = self.refresh_token_service.hash_refresh_token(refresh_token)
        record = self.refresh_token_repository.get_by_token_hash(token_hash)
        if record is None or record.is_revoked():
            return
        self.refresh_token_repository.revoke(record, now_utc())
