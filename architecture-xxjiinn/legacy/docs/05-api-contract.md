# API 계약

이 문서는 request, response, error contract를 정의한다.

## 초기 Endpoint

```text
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me
```

## 기본 응답 형식

기본 응답 형식은 v1 아키텍처 문서를 따른다.

성공:

```json
{
  "data": {}
}
```

에러:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message."
  }
}
```

## 에러 코드 계약

| Code | HTTP | 의미 |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | 요청 값 검증 실패 |
| `EMAIL_ALREADY_EXISTS` | 409 | signup email 중복 |
| `INVALID_CREDENTIALS` | 401 | login email/password 실패 |
| `USER_NOT_ACTIVE` | 403 | active가 아닌 사용자 |
| `UNAUTHENTICATED` | 401 | 인증 정보 없음 |
| `TOKEN_EXPIRED` | 401 | access token 만료 |
| `TOKEN_INVALID` | 401 | access token 유효하지 않음 |
| `CSRF_TOKEN_INVALID` | 403 | CSRF token 누락 또는 불일치 |
| `REFRESH_TOKEN_INVALID` | 401 | refresh token 유효하지 않음 |
| `REFRESH_TOKEN_EXPIRED` | 401 | refresh token 만료 |
| `REFRESH_TOKEN_REUSED` | 401 | 폐기된 refresh token 재사용 |

## 에러 설계 원칙

로그인 실패는 email 없음과 password 틀림을 구분하지 않는다.

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

`blocked`, `deactivated` 같은 세부 계정 상태는 외부 응답에서 구분하지 않고 `USER_NOT_ACTIVE`로 통일한다.

FastAPI/Pydantic validation error는 기본 422 대신 `400 VALIDATION_ERROR`로 변환한다.

Usecase/domain/repository는 FastAPI `HTTPException`을 직접 사용하지 않는다.
하위 레이어는 `AppError`를 던지고, FastAPI exception handler가 HTTP 응답으로 변환한다.

## Endpoint 의미

### `POST /auth/signup`

새 사용자를 생성한다.

Token을 발급하지 않는다.

Signup 성공 후 사용자는 `active` 상태가 된다.

Request:

```json
{
  "email": "user@example.com",
  "password": "password1234",
  "name": "홍길동"
}
```

Response:

```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "홍길동",
    "status": "active",
    "is_admin": false,
    "created_at": "2026-04-18T00:00:00Z",
    "updated_at": "2026-04-18T00:00:00Z"
  }
}
```

Status:

```text
201 Created
```

Signup은 token을 발급하지 않는다.
계정 생성과 인증/token 발급 흐름을 분리하기 위해 login은 별도 endpoint에서 처리한다.

실제 구현도 signup 성공 시 `Set-Cookie`를 설정하지 않는다.

Audit:

```text
성공: auth.signup success
실패: auth.signup failure
```

### `POST /auth/login`

Email/password로 사용자를 인증한다.

성공하면 아래 cookie를 설정한다.

```text
access_token
refresh_token
csrf_token
```

Response body에는 token 원문을 넣지 않는다.

Request:

```json
{
  "email": "user@example.com",
  "password": "password1234"
}
```

Response:

```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "홍길동",
    "status": "active",
    "is_admin": false,
    "created_at": "2026-04-18T00:00:00Z",
    "updated_at": "2026-04-18T00:00:00Z"
  }
}
```

Cookie:

```text
access_token:
  HttpOnly
  Path=/
  Max-Age=ACCESS_TOKEN_EXPIRE_SECONDS

refresh_token:
  HttpOnly
  Path=/auth
  Max-Age=REFRESH_TOKEN_EXPIRE_DAYS * 86400

csrf_token:
  JavaScript readable
  Path=/
  Max-Age=REFRESH_TOKEN_EXPIRE_DAYS * 86400
```

Login 실패:

```text
email 없음:
  401 INVALID_CREDENTIALS

password 틀림:
  401 INVALID_CREDENTIALS

user.status != active:
  403 USER_NOT_ACTIVE
```

Audit:

```text
성공: auth.login success
실패: auth.login failure
```

### `POST /auth/refresh`

Refresh token cookie를 사용해 새 access token과 새 refresh token을 발급한다.

기존 refresh token은 revoke하고, 새 refresh token으로 rotation한다.

Request:

```text
Cookie: refresh_token=<opaque-token>
Cookie: csrf_token=<csrf-token>
X-CSRF-Token: <csrf-token>
```

Response:

```json
{
  "data": {
    "refreshed": true
  }
}
```

Cookie:

```text
access_token:
  새 JWT access token

refresh_token:
  새 opaque refresh token

csrf_token:
  새 CSRF token
```

Error:

```text
refresh_token cookie 없음:
  401 REFRESH_TOKEN_INVALID

csrf_token cookie와 X-CSRF-Token header 불일치:
  403 CSRF_TOKEN_INVALID

DB에서 token_hash 조회 실패:
  401 REFRESH_TOKEN_INVALID

revoked refresh token 재사용:
  401 REFRESH_TOKEN_REUSED

refresh token 만료:
  401 REFRESH_TOKEN_EXPIRED

user.status != active:
  403 USER_NOT_ACTIVE
```

Audit:

```text
성공: auth.refresh success
실패: auth.refresh failure
```

### `POST /auth/logout`

Refresh token cookie를 사용해 현재 refresh token을 revoke한다.

Auth cookie가 요청에 포함되어 있으면 CSRF 검증 후 access token cookie, refresh token cookie, csrf token cookie를 삭제한다.

Request:

```text
Cookie: refresh_token=<opaque-token>
Cookie: csrf_token=<csrf-token>
X-CSRF-Token: <csrf-token>
```

Response:

```json
{
  "data": {
    "logged_out": true
  }
}
```

Cookie:

```text
access_token:
  삭제

refresh_token:
  삭제

csrf_token:
  삭제
```

Logout은 사용자 관점에서 멱등적으로 처리한다.
Auth cookie가 없으면 성공 응답을 반환하되 cookie 삭제 header를 내려주지 않는다.

Auth cookie가 있는 logout 요청은 CSRF 검증을 통과해야 한다.
Refresh token cookie가 있지만 DB에서 찾을 수 없는 경우에도 cookie 삭제 응답은 내려준다.

Audit:

```text
auth cookie 있음 + 성공: auth.logout success
auth cookie 있음 + 실패: auth.logout failure
auth cookie 없음: 기록하지 않음
```

### `GET /users/me`

Access token cookie를 사용해 현재 로그인한 사용자 정보를 조회한다.

Access token JWT의 signature, `exp`, `type`, `sub`, `jti`를 검증한 뒤 user를 DB에서 조회한다.

Request:

```text
Cookie: access_token=<jwt>
```

Response:

```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "홍길동",
    "status": "active",
    "is_admin": false,
    "created_at": "2026-04-18T00:00:00Z",
    "updated_at": "2026-04-18T00:00:00Z"
  }
}
```

Error:

```text
access_token cookie 없음:
  401 UNAUTHENTICATED

access token 만료:
  401 TOKEN_EXPIRED

access token invalid:
  401 TOKEN_INVALID

user 없음:
  401 UNAUTHENTICATED

user.status != active:
  403 USER_NOT_ACTIVE
```
