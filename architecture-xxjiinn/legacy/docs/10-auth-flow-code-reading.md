# Auth 코드 리딩

이 문서는 구현된 auth MVP의 요청 흐름을 코드 기준으로 다시 읽기 위한 문서다.

## 전체 Endpoint

```text
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /users/me
```

## 공통 구조

```text
endpoint
  -> dependency
  -> schema
  -> usecase
  -> domain object
  -> repository
  -> Unit of Work
  -> SQLAlchemy model
  -> PostgreSQL

endpoint
  -> audit logger
  -> auth_audit_log
```

Spring Boot 관점으로 보면 아래와 비슷하다.

```text
Controller
  -> DTO
  -> Service
  -> Domain
  -> Repository
  -> Transaction Manager
  -> JPA Entity
  -> DB
```

이번 구현에서는 Spring의 `@Transactional` 역할을 `SqlAlchemyUnitOfWork`가 담당한다.

## Signup 흐름

Endpoint:

```text
app/domains/auth/endpoint.py
```

Dependency:

```text
app/domains/auth/dependency.py
```

Usecase:

```text
SignupUseCase
```

흐름:

```text
1. FastAPI dependency가 SignupUseCase를 조립한다.
2. SignupRequest가 email/password/name을 받는다.
3. Email value object가 email 형식을 검증한다.
4. RawPassword value object가 password 길이와 72 bytes 제한을 검증한다.
5. Unit of Work가 transaction scope를 시작한다.
6. UserRepository가 email 중복을 확인한다.
7. PasswordHasher가 bcrypt password_hash를 만든다.
8. User domain entity를 만든다.
9. UserRepository가 UserModel로 변환해 DB에 저장한다.
10. Unit of Work가 commit한다.
11. endpoint가 auth.signup/success audit log를 기록한다.
12. UserResponse를 반환한다.
```

Signup은 token을 발급하지 않는다.
계정 생성과 인증/token 발급 흐름을 분리하기 위해서다.

## Login 흐름

Endpoint:

```text
app/domains/auth/endpoint.py
```

Dependency:

```text
app/domains/auth/dependency.py
```

Usecase:

```text
LoginUseCase
```

흐름:

```text
1. FastAPI dependency가 LoginUseCase를 조립한다.
2. LoginRequest가 email/password를 받는다.
3. Email과 RawPassword value object를 만든다.
4. Unit of Work가 transaction scope를 시작한다.
5. UserRepository가 email로 user를 조회한다.
6. user가 없으면 INVALID_CREDENTIALS를 반환한다.
7. PasswordHasher가 raw password와 password_hash를 verify한다.
8. password가 틀리면 INVALID_CREDENTIALS를 반환한다.
9. User.ensure_can_login()이 active 상태인지 확인한다.
10. TokenService가 JWT access token을 만든다.
11. RefreshTokenService가 opaque refresh token 원문을 만든다.
12. RefreshTokenService가 refresh token 원문을 SHA-256 hash로 바꾼다.
13. RefreshTokenRepository가 token_hash를 DB에 저장한다.
14. Unit of Work가 commit한다.
15. endpoint가 cookie helper를 호출한다.
16. cookie helper가 access_token HttpOnly cookie를 설정한다.
17. cookie helper가 refresh_token HttpOnly cookie를 설정한다.
18. cookie helper가 csrf_token 일반 cookie를 설정한다.
19. endpoint가 auth.login/success audit log를 기록한다.
20. UserResponse를 반환한다.
```

Response body에는 token 원문을 넣지 않는다.
Token은 `Set-Cookie` header로 전달된다.

## Current User 흐름

Endpoint:

```text
app/domains/user/endpoint.py
```

Dependency:

```text
app/domains/auth/dependency.py
get_current_user
```

흐름:

```text
1. Cookie에서 access_token을 읽는다.
2. 없으면 UNAUTHENTICATED를 반환한다.
3. TokenService가 JWT signature와 exp를 검증한다.
4. TokenService가 type == access인지 확인한다.
5. TokenService가 sub와 jti 존재 여부를 확인한다.
6. sub를 UUID로 변환한다.
7. UserRepository가 user_id로 user를 조회한다.
8. user가 없으면 UNAUTHENTICATED를 반환한다.
9. User.ensure_can_login()이 active 상태인지 확인한다.
10. UserResponse를 반환한다.
```

## Refresh 흐름

Endpoint:

```text
app/domains/auth/endpoint.py
```

Dependency:

```text
app/domains/auth/dependency.py
```

Usecase:

```text
RefreshUseCase
```

흐름:

```text
1. FastAPI dependency가 RefreshUseCase를 조립한다.
2. Cookie에서 refresh_token 원문을 읽는다.
3. 없으면 REFRESH_TOKEN_INVALID를 반환한다.
4. csrf_token cookie와 X-CSRF-Token header가 일치하는지 확인한다.
5. 일치하지 않으면 CSRF_TOKEN_INVALID를 반환한다.
6. RefreshTokenService가 원문을 SHA-256 hash로 바꾼다.
7. RefreshTokenRepository가 token_hash로 DB row를 조회한다.
8. row가 없으면 REFRESH_TOKEN_INVALID를 반환한다.
9. revoked_at이 있으면 REFRESH_TOKEN_REUSED를 반환한다.
10. expires_at이 지났으면 REFRESH_TOKEN_EXPIRED를 반환한다.
11. UserRepository가 user를 조회한다.
12. User.ensure_can_login()이 active 상태인지 확인한다.
13. 기존 refresh token row의 revoked_at을 채운다.
14. 새 opaque refresh token 원문을 만든다.
15. 새 refresh token hash를 DB에 저장한다.
16. 새 access token JWT를 만든다.
17. Unit of Work가 commit한다.
18. endpoint가 cookie helper를 호출한다.
19. cookie helper가 새 access_token cookie를 설정한다.
20. cookie helper가 새 refresh_token cookie를 설정한다.
21. cookie helper가 새 csrf_token cookie를 설정한다.
22. endpoint가 auth.refresh/success audit log를 기록한다.
23. refreshed=true를 반환한다.
```

이 과정이 refresh token rotation이다.

## Logout 흐름

Endpoint:

```text
app/domains/auth/endpoint.py
```

Dependency:

```text
app/domains/auth/dependency.py
```

Usecase:

```text
LogoutUseCase
```

흐름:

```text
1. FastAPI dependency가 LogoutUseCase를 조립한다.
2. Cookie에서 access_token과 refresh_token을 읽는다.
3. auth cookie가 하나라도 있으면 csrf_token cookie와 X-CSRF-Token header가 일치하는지 확인한다.
4. 일치하지 않으면 CSRF_TOKEN_INVALID를 반환한다.
5. auth cookie가 없으면 DB 작업과 cookie 삭제 없이 logged_out=true를 반환한다.
6. refresh_token이 있으면 SHA-256 hash로 바꾼다.
7. RefreshTokenRepository가 token_hash로 DB row를 조회한다.
8. row가 있고 아직 revoke 전이면 revoked_at을 채운다.
9. Unit of Work가 commit한다.
10. endpoint가 cookie helper를 호출한다.
11. cookie helper가 access_token cookie를 삭제한다.
12. cookie helper가 refresh_token cookie를 삭제한다.
13. cookie helper가 csrf_token cookie를 삭제한다.
14. endpoint가 auth.logout/success audit log를 기록한다.
15. logged_out=true를 반환한다.
```

Logout은 사용자 관점에서 멱등적이다.
Auth cookie가 없으면 성공 응답을 반환하되 cookie 삭제 header는 내려주지 않는다.

## Audit Log 흐름

파일:

```text
app/core/audit.py
app/domains/audit/model.py
```

흐름:

```text
1. auth endpoint가 usecase 실행을 try/except로 감싼다.
2. 성공하면 event_type/success/user_id를 기록한다.
3. AppError가 발생하면 event_type/failure/reason을 기록한다.
4. reason은 ErrorCode 문자열을 사용한다.
5. raw email/IP/User-Agent는 저장하지 않는다.
6. email/IP/User-Agent는 HMAC-SHA256 hash로 저장한다.
7. password/token/cookie 원문은 저장하지 않는다.
```

Audit log writer는 auth usecase의 Unit of Work와 별도 DB session을 사용한다.
따라서 login 실패처럼 usecase transaction이 rollback되는 경우에도 실패 기록은 남는다.

## 에러 처리 흐름

파일:

```text
app/core/exceptions.py
app/main.py
```

흐름:

```text
1. usecase/domain/dependency가 AppError를 던진다.
2. FastAPI exception handler가 AppError를 잡는다.
3. ErrorCode에 맞는 HTTP status와 message로 변환한다.
4. {"error":{"code":"...","message":"..."}} 형식으로 반환한다.
```

Pydantic validation error도 `400 VALIDATION_ERROR`로 변환한다.

## 테스트

자동 테스트:

```text
backend/tests/test_auth_api.py
backend/tests/test_security.py
backend/tests/test_user_domain.py
```

실행:

```text
uv run pytest
```

현재 결과:

```text
41 passed
```
