from __future__ import annotations

from dataclasses import dataclass

from app.core.error_codes import ErrorCode
from app.core.exceptions import AppError
from app.core.security import now_utc
from app.domains.auth.repository import RefreshTokenRepository
from app.domains.user.domain import User
from app.domains.user.repository import UserRepository


@dataclass
class WithdrawCurrentUserUsecase:
    user_repository: UserRepository
    refresh_token_repository: RefreshTokenRepository

    def execute(self, actor_id: str) -> User:
        user = self.user_repository.get(actor_id)
        if user is None:
            raise AppError(ErrorCode.AUTH_UNAUTHENTICATED)

        user.deactivate()
        self.user_repository.archive_and_deactivate(user)
        self.refresh_token_repository.revoke_all_for_user(user.id, now_utc())
        return user
