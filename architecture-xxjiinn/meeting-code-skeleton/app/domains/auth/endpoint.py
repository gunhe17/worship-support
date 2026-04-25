from __future__ import annotations

from app.domains.auth.cookies import set_access_cookie
from app.domains.auth.schema import LoginRequest, SignupRequest
from app.domains.auth.usecase import GetCurrentUserUsecase, LoginUsecase, SignupUsecase


class AuthEndpoint:
    def __init__(
        self,
        signup_usecase: SignupUsecase,
        login_usecase: LoginUsecase,
        get_current_user_usecase: GetCurrentUserUsecase,
    ) -> None:
        self.signup_usecase = signup_usecase
        self.login_usecase = login_usecase
        self.get_current_user_usecase = get_current_user_usecase

    def signup(self, request: SignupRequest) -> dict[str, object]:
        user = self.signup_usecase.execute(request)
        return {"data": user.to_dict()}

    def login(self, request: LoginRequest, response: object) -> dict[str, object]:
        result = self.login_usecase.execute(request)
        set_access_cookie(response, result.access_token)
        return {"data": result.user.to_dict()}

    def me(self, access_token: str) -> dict[str, object]:
        user = self.get_current_user_usecase.execute(access_token)
        return {"data": user.to_dict()}
