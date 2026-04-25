from __future__ import annotations

from dataclasses import dataclass

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.core.security import PasswordHasher, TokenService
from app.domains.auth.schema import LoginRequest, SignupRequest, UserResponse
from app.domains.user.domain import Email, PasswordHash, RawPassword, User, UserStatus
from app.domains.user.repository import UserRepository


@dataclass
class SignupUsecase:
    user_repository: UserRepository
    password_hasher: PasswordHasher

    def execute(self, request: SignupRequest) -> UserResponse:
        email = Email(request.email)
        raw_password = RawPassword(request.password)

        if self.user_repository.exists_by_email(email):
            raise AppError(
                ErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
                context={"email": "masked"},
            )

        user = User(
            id="generated-user-id",
            email=email,
            password_hash=PasswordHash(self.password_hasher.hash(raw_password.value)),
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


@dataclass
class LoginUsecase:
    user_repository: UserRepository
    password_hasher: PasswordHasher
    token_service: TokenService

    def execute(self, request: LoginRequest) -> LoginResult:
        email = Email(request.email)
        user = self.user_repository.get_by_email(email)
        if user is None:
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

        user.ensure_can_login()

        if not self.password_hasher.verify(request.password, user.password_hash.value):
            raise AppError(ErrorCode.AUTH_INVALID_CREDENTIALS)

        access_token = self.token_service.issue_access_token(user.id)
        return LoginResult(
            user=UserResponse(
                id=user.id,
                email=user.email.value,
                name=user.name,
                status=user.status.value,
            ),
            access_token=access_token,
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
