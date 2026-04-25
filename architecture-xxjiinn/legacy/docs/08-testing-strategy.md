# 테스트 전략

이 문서는 auth 테스트 전략을 정의한다.

## 테스트 종류

- unit test
- integration test
- API test
- migration test
- security regression test

## 자동 테스트 실행

테스트는 pytest로 실행한다.

```text
uv run pytest
```

테스트는 `worship_support_auth_test` DB를 사용한다.

세션 시작 시 Alembic migration을 test DB에 적용한다.

각 테스트 전후로 아래 테이블을 비운다.

```text
auth_audit_log
refresh_token
users
```

Async SQLAlchemy engine은 event loop 간 connection 재사용 문제를 피하기 위해 각 테스트 전후로 dispose한다.

## 단위 테스트 대상

Domain unit test:

- `Email` value object는 기본 email 형식을 검증한다.
- `RawPassword` value object는 최소 길이와 72 bytes 제한을 검증한다.
- `User.ensure_can_login()`은 `active`만 허용한다.
- `RefreshToken.is_expired()`는 기준 시각보다 같거나 과거면 만료로 본다.
- `RefreshToken.is_revoked()`는 `revoked_at` 존재 여부로 판단한다.

Security unit test:

- `PasswordHasher`는 bcrypt hash를 만들고 raw password를 검증한다.
- `PasswordHasher`는 72 bytes 초과 raw password를 거부한다.
- `TokenService`는 access token JWT를 생성하고 검증한다.
- `TokenService`는 `type != access`, `jti` 누락, 만료 token을 거부한다.
- `RefreshTokenService`는 opaque token 원문을 만들고 SHA-256 hash를 만든다.

CSRF API regression test:

- login 성공 시 `csrf_token` cookie를 발급한다.
- refresh 성공 시 새 `csrf_token` cookie를 발급한다.
- refresh token cookie가 있는데 `X-CSRF-Token` header가 없으면 `403 CSRF_TOKEN_INVALID`를 반환한다.
- logout token cookie가 있는데 `X-CSRF-Token` header가 없으면 `403 CSRF_TOKEN_INVALID`를 반환한다.
- auth cookie가 없는 logout은 성공하되 cookie 삭제 header를 내려주지 않는다.

Audit API regression test:

- signup 성공 시 `auth.signup/success`를 기록한다.
- signup 중복 실패 시 `auth.signup/failure`와 reason을 기록한다.
- login 실패 시 `auth.login/failure`와 reason을 기록한다.
- refresh CSRF 실패 시 `auth.refresh/failure`와 reason을 기록한다.
- logout 성공 시 `auth.logout/success`를 기록한다.
- audit log에는 raw email 대신 64자리 hash를 저장한다.

## 초기 Auth 테스트 대상

Signup:

- 성공
- 중복 email
- 잘못된 email
- 약한 password
- signup 성공 시 token cookie가 발급되지 않음

Login:

- 성공
- 존재하지 않는 email
- 틀린 password
- blocked user
- 성공 시 access_token HttpOnly cookie 발급
- 성공 시 refresh_token HttpOnly cookie 발급
- 성공 시 refresh_token hash DB 저장

Logout:

- 성공
- refresh_token cookie 없음
- 성공 시 access_token cookie 삭제
- 성공 시 refresh_token cookie 삭제
- 성공 시 refresh_token row revoked_at 설정

Current user:

- 유효한 token
- token 없음
- 잘못된 token
- 만료된 token
- token의 user가 DB에 없음
- active가 아닌 user

Error contract:

- Pydantic validation error는 `400 VALIDATION_ERROR`
- 중복 email은 `409 EMAIL_ALREADY_EXISTS`
- login 실패는 `401 INVALID_CREDENTIALS`
- active가 아닌 user는 `403 USER_NOT_ACTIVE`
- refresh token 재사용은 `401 REFRESH_TOKEN_REUSED`

## Signup API 검증 기록

검증 명령:

```text
POST /auth/signup
```

검증 결과:

```text
성공 signup:
  201 Created
  Location header 설정
  data.id/email/name/status/is_admin/created_at/updated_at 반환
  token cookie 발급 없음

잘못된 request:
  400 VALIDATION_ERROR

중복 email:
  409 EMAIL_ALREADY_EXISTS

72 bytes 초과 password:
  400 VALIDATION_ERROR

DB 확인:
  users.status = active
  users.is_admin = false
  users.password_hash는 bcrypt hash
  auth_audit_log에 auth.signup/success 기록
```

## Login API 검증 기록

검증 명령:

```text
POST /auth/login
```

검증 결과:

```text
성공 login:
  200 OK
  data.id/email/name/status/is_admin/created_at/updated_at 반환
  access_token HttpOnly cookie 발급
  access_token Max-Age=15
  access_token Path=/
  refresh_token HttpOnly cookie 발급
  refresh_token Max-Age=604800
  refresh_token Path=/auth
  csrf_token 일반 cookie 발급
  csrf_token Max-Age=604800
  csrf_token Path=/

틀린 password:
  401 INVALID_CREDENTIALS

존재하지 않는 email:
  401 INVALID_CREDENTIALS

DB 확인:
  refresh_token.token_hash length = 64
  refresh_token.revoked_at is null
  refresh_token.expires_at > now()
  auth_audit_log에 auth.login/success 또는 auth.login/failure 기록
```

## Current User API 검증 기록

검증 명령:

```text
GET /users/me
```

검증 결과:

```text
유효한 access_token cookie:
  200 OK
  현재 user 정보 반환

access_token cookie 없음:
  401 UNAUTHENTICATED

잘못된 access token:
  401 TOKEN_INVALID

curl cookie jar에서 Max-Age가 지난 access_token:
  cookie가 요청에 포함되지 않음
  401 UNAUTHENTICATED

만료된 access token 원문을 강제로 Cookie header에 포함:
  401 TOKEN_EXPIRED
```

주의:

브라우저나 `curl` cookie jar는 만료된 cookie를 자동으로 보내지 않을 수 있다.
이 경우 서버는 만료 token이 아니라 token 없음으로 판단한다.

서버의 `TOKEN_EXPIRED` 경로를 검증하려면 만료된 JWT 원문을 직접 Cookie header에 넣어 보내야 한다.

## Refresh API 검증 기록

검증 명령:

```text
POST /auth/refresh
```

검증 결과:

```text
유효한 refresh_token cookie:
  200 OK
  {"data":{"refreshed":true}}
  새 access_token HttpOnly cookie 발급
  새 refresh_token HttpOnly cookie 발급
  새 csrf_token cookie 발급

refresh_token cookie 없음:
  401 REFRESH_TOKEN_INVALID

refresh_token cookie는 있지만 CSRF header 없음:
  403 CSRF_TOKEN_INVALID

DB에 없는 refresh_token:
  401 REFRESH_TOKEN_INVALID

이전 refresh token 재사용:
  401 REFRESH_TOKEN_REUSED

DB 확인:
  active refresh token count = 1
  revoked refresh token count = 1
  auth_audit_log에 auth.refresh/success 또는 auth.refresh/failure 기록
```

Refresh 성공 시 기존 refresh token row는 `revoked_at`이 채워지고, 새 refresh token hash row가 생성된다.

## Logout API 검증 기록

검증 명령:

```text
POST /auth/logout
```

검증 결과:

```text
유효한 refresh_token cookie:
  200 OK
  {"data":{"logged_out":true}}
  access_token cookie 삭제
  refresh_token cookie 삭제
  csrf_token cookie 삭제

refresh_token cookie는 있지만 CSRF header 없음:
  403 CSRF_TOKEN_INVALID

refresh_token cookie 없음:
  200 OK
  {"data":{"logged_out":true}}
  cookie 삭제 header 없음

DB 확인:
  active refresh token count = 0
  revoked refresh token count = 1
  auth_audit_log에 auth.logout/success 또는 auth.logout/failure 기록

cookie jar 확인:
  logout 후 cookie jar 비어 있음
```

Logout은 사용자 관점에서 멱등적으로 처리한다.
Auth cookie가 없으면 성공 응답만 반환하고 cookie 삭제 header는 내려주지 않는다.

## 자동 테스트 결과

자동 테스트 작성 후 아래를 검증했다.

```text
41 passed
```

검증 범위:

- domain value object 규칙
- domain entity 상태 규칙
- password hashing 규칙
- JWT access token claim 검증 규칙
- opaque refresh token hash 규칙
- signup 성공
- signup 중복 email
- signup validation error
- login 성공과 cookie 발급
- login 실패 시 INVALID_CREDENTIALS 통일
- blocked/deactivated user login 차단
- users/me 성공
- users/me 인증 없음
- users/me 잘못된 token
- users/me 만료 token
- users/me blocked/deactivated user 차단
- refresh rotation
- refresh/logout CSRF token 검증
- auth audit log 기록
- DB에 없는 refresh token 차단
- refresh token 재사용 차단
- refresh token 없음
- logout revoke와 cookie 삭제
- logout 멱등성
