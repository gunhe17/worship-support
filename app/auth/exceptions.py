from __future__ import annotations


# =============================================================================
# Base
# =============================================================================

class BaseAppException(Exception):
    """이 프로젝트에서 발생하는 모든 커스텀 예외의 최상위 부모."""

    message: str = "알 수 없는 오류가 발생했습니다."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.__class__.message
        super().__init__(self.message)


# =============================================================================
# Domain Layer  —  비즈니스 규칙 위반
# =============================================================================

class DomainException(BaseAppException):
    """도메인 규칙을 위반했을 때 발생하는 예외의 부모."""

    message = "도메인 규칙 위반입니다."


class InvalidEmailFormatException(DomainException):
    """이메일 형식이 올바르지 않을 때."""

    message = "이메일 형식이 올바르지 않습니다."


class InvalidPasswordFormatException(DomainException):
    """비밀번호 형식(8~16자, 특수문자 포함) 위반."""

    message = "비밀번호는 8~16자이며 특수문자를 포함해야 합니다."


class InvalidValueObjectException(DomainException):
    """값 객체 유효성 검증 실패."""

    message = "유효하지 않은 값입니다."


# =============================================================================
# Application Layer  —  유스케이스 흐름 오류
# =============================================================================

class ApplicationException(BaseAppException):
    """애플리케이션 유스케이스 처리 중 발생하는 예외의 부모."""

    message = "요청을 처리할 수 없습니다."


# ── 그룹 1 : 로그인 / 인증 ────────────────────────────────────────────────────

class AuthenticationException(ApplicationException):
    """인증 관련 예외의 부모."""

    message = "인증에 실패했습니다."


class InvalidCredentialsException(AuthenticationException):
    """이메일 또는 비밀번호가 틀렸을 때."""

    message = "이메일 또는 비밀번호가 틀렸습니다."


class AccountInactiveException(AuthenticationException):
    """비활성화된 계정으로 로그인 시도할 때."""

    message = "비활성화된 계정입니다."


class EmailNotVerifiedException(AuthenticationException):
    """이메일 인증이 완료되지 않은 계정일 때."""

    message = "이메일 인증이 필요합니다."


class TokenExpiredException(AuthenticationException):
    """액세스/리프레시 토큰이 만료됐을 때."""

    message = "토큰이 만료되었습니다."


# ── 그룹 2 : 회원가입 ────────────────────────────────────────────────────────

class SignUpException(ApplicationException):
    """회원가입 유스케이스 오류의 부모."""

    message = "회원가입 처리 중 오류가 발생했습니다."


class DuplicateEmailException(SignUpException):
    """이미 사용 중인 이메일로 가입 시도할 때."""

    message = "이미 사용 중인 이메일입니다."


# ── 그룹 3 : 토큰 처리 ───────────────────────────────────────────────────────

class TokenException(ApplicationException):
    """토큰 생성·검증·조회 오류의 부모."""

    message = "토큰 처리 중 오류가 발생했습니다."


class InvalidTokenException(TokenException):
    """서명이 잘못됐거나 형식이 올바르지 않은 토큰."""

    message = "유효하지 않은 토큰입니다."


class TokenBlacklistedException(TokenException):
    """이미 폐기(블랙리스트)된 토큰을 사용할 때."""

    message = "폐기된 토큰입니다."


class RefreshTokenNotFoundException(TokenException):
    """DB/Redis에서 리프레시 토큰을 찾을 수 없을 때."""

    message = "토큰을 찾을 수 없습니다."


# ── 그룹 4 : 탈퇴 ────────────────────────────────────────────────────────────

class WithdrawException(ApplicationException):
    """회원 탈퇴 유스케이스 오류의 부모."""

    message = "탈퇴 처리 중 오류가 발생했습니다."


class AlreadyWithdrawnException(WithdrawException):
    """이미 탈퇴 처리된 계정에 재요청할 때."""

    message = "이미 탈퇴한 계정입니다."


# =============================================================================
# Infrastructure Layer  —  외부 연동 오류
# =============================================================================

class InfrastructureException(BaseAppException):
    """DB·Redis·메일 등 외부 시스템 연동 실패 예외의 부모."""

    message = "외부 연동 오류가 발생했습니다."


class DatabaseException(InfrastructureException):
    """데이터베이스 쿼리·연결 오류."""

    message = "데이터베이스 오류가 발생했습니다."


class RedisException(InfrastructureException):
    """Redis 연결·명령 오류."""

    message = "Redis 오류가 발생했습니다."


class MailSendException(InfrastructureException):
    """이메일 발송 실패."""

    message = "이메일 발송에 실패했습니다."
