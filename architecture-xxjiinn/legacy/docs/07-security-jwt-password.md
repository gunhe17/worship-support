# Security, JWT, Password

이 문서는 password hashing, JWT, auth security 결정을 정리한다.

## 다룰 주제

- password hashing
- bcrypt
- JWT access token
- refresh token
- token expiration
- token revocation
- CSRF
- sensitive data logging policy
- account enumeration prevention
- brute force mitigation

## 초기 방향

비밀번호는 절대 평문으로 저장하지 않는다.

이메일/비밀번호 login에서는 bcrypt로 만든 `password_hash`만 DB에 저장한다.

Raw password 규칙:

- 최소 8자
- 최대 72 bytes

MVP에서는 숫자/특수문자/대문자 조합을 강제하지 않는다.

refresh token을 추가할 때는 refresh token 원문을 DB에 저장하지 않는다.

Access token과 refresh token은 HttpOnly cookie로 전달한다.

CSRF 방어를 위해 `csrf_token` cookie와 `X-CSRF-Token` header를 함께 사용한다.

Access token은 JWT로 구현한다.

Access token claim:

- `sub`
- `type`
- `exp`
- `iat`
- `jti`

Refresh token은 opaque random token으로 구현한다.

Refresh token hash는 SHA-256으로 만든다.

아래 값은 로그에 남기지 않는다.

- plain password
- password hash
- JWT
- refresh token
- raw Authorization header
- raw email
- raw IP
- raw User-Agent

## 왜 password_hash만 저장하는가?

서버는 login 시 사용자의 raw password를 다시 알아낼 필요가 없다.
필요한 것은 "입력한 raw password가 기존 password와 같은가"를 검증하는 것이다.

따라서 복호화 가능한 암호화가 아니라 password hashing algorithm을 사용한다.

bcrypt hash 문자열에는 일반적으로 아래 정보가 포함된다.

```text
algorithm variant
cost
salt
hash result
```

그래서 별도 salt 컬럼을 직접 두지 않고 `password_hash` 문자열만 저장해도 검증에 필요한 정보가 들어 있다.

## XSS와 Token 저장소

XSS는 공격자가 우리 웹 페이지 안에서 악성 JavaScript를 실행하게 만드는 공격이다.

`localStorage`나 `sessionStorage`에 token을 저장하면 XSS 발생 시 JavaScript가 token 원문을 읽어 외부로 전송할 수 있다.

HttpOnly cookie는 JavaScript에서 읽을 수 없다.
따라서 token 원문 탈취 위험을 줄일 수 있다.

단, XSS가 있으면 공격 JavaScript가 사용자 브라우저에서 API 요청을 보낼 수 있으므로 XSS 자체를 막는 것도 중요하다.

## CSRF와 Cookie 인증

CSRF는 공격자가 사용자의 브라우저를 이용해 사용자가 의도하지 않은 요청을 보내게 만드는 공격이다.

Cookie 기반 인증에서는 브라우저가 요청에 cookie를 자동으로 붙인다.
이 때문에 HttpOnly cookie를 쓰더라도 상태 변경 요청에는 CSRF 방어가 필요하다.

이번 MVP의 방어 전략:

```text
SameSite=Lax
csrf_token cookie
X-CSRF-Token header
```

`csrf_token` cookie는 JavaScript가 읽을 수 있도록 HttpOnly를 사용하지 않는다.
클라이언트는 이 값을 읽어 `X-CSRF-Token` header로 보낸다.

서버는 cookie 값과 header 값이 없거나 다르면 요청을 거부한다.

```text
403 CSRF_TOKEN_INVALID
```

이 방식은 access token이나 refresh token 원문을 JavaScript에 노출하지 않으면서, 브라우저가 자동으로 cookie만 붙여 보낸 cross-site 요청을 걸러내기 위한 장치다.

## Cookie와 HttpOnly Cookie

Cookie는 브라우저에 저장되고 요청 시 서버로 전송되는 key-value 데이터다.

HttpOnly cookie는 JavaScript에서 읽을 수 없는 cookie다.

서버가 cookie를 읽는다는 말은 서버 내부에 cookie 저장소가 있다는 뜻이 아니다.
클라이언트가 HTTP 요청에 포함해 보낸 `Cookie` header를 읽는다는 뜻이다.

## HS256과 SHA-256

SHA-256은 secret key 없이 digest를 만드는 hash function이다.

HS256은 JWT에서 사용하는 HMAC-SHA256 서명 알고리즘이다.
HS256은 secret key를 사용해 JWT가 서버에 의해 발급되었고 중간에 위변조되지 않았음을 검증한다.

이번 프로젝트에서의 사용:

```text
HS256:
  access token JWT 서명/검증

SHA-256:
  opaque refresh token 원문을 DB 저장용 hash로 변환
```

## Revoke와 Rotation

Revoke는 token을 폐기하는 것이다.

예:

```text
revoked_at = now()
```

Rotation은 refresh token을 사용할 때마다 기존 refresh token을 revoke하고 새 refresh token을 발급하는 방식이다.

Rotation이 있으면 이미 사용되어 revoke된 refresh token이 다시 들어왔을 때 탈취 또는 재사용 의심 상황을 감지할 수 있다.

Refresh 요청은 일반 API 요청마다 발생하지 않는다.
Access token이 만료되었거나 만료 직전일 때 발생한다.

## Security Service

보안 기술 처리는 `app/core/security.py`에 둔다.

### PasswordHasher

역할:

- raw password를 bcrypt password hash로 변환
- raw password와 password hash를 비교

구현:

- `bcrypt` 라이브러리를 직접 사용한다.
- `passlib` 래퍼는 사용하지 않는다.
- bcrypt 제한 때문에 UTF-8 기준 72 bytes를 초과하는 raw password는 거부한다.

### TokenService

역할:

- access token JWT 생성
- access token JWT 검증

Access token 검증 시 확인할 것:

- signature
- `exp`
- `type == "access"`
- `sub`
- `jti`

### RefreshTokenService

역할:

- opaque refresh token 원문 생성
- refresh token 원문을 SHA-256 hash로 변환

Refresh token 원문은 cookie로만 전달하고 DB에는 저장하지 않는다.

## Auth Cookie 구성

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
  HttpOnly=false
  Path=/
  Max-Age=REFRESH_TOKEN_EXPIRE_DAYS * 86400
```

## CORS와 Credential

브라우저 frontend와 API origin이 다르면 CORS 설정이 필요하다.

이번 구현은 기본적으로 CORS middleware를 비활성화한다.
`CORS_ALLOWED_ORIGINS`가 설정된 경우에만 해당 origin에 credential 요청을 허용한다.

환경변수 예:

```text
CORS_ALLOWED_ORIGINS=["http://localhost:3000"]
CORS_ALLOW_CREDENTIALS=true
```

Cookie 인증을 사용하므로 frontend 요청도 credential을 포함해야 한다.
또한 refresh/logout은 `X-CSRF-Token` header를 보내야 하므로 CORS 허용 header에 이 값이 포함되어야 한다.

## Auth Audit Log 보안 정책

Audit log는 보안 사고 조사와 운영 추적을 위한 기록이다.
하지만 log 자체도 민감 정보가 될 수 있으므로 최소 정보만 저장한다.

저장하는 이벤트:

```text
auth.signup
auth.login
auth.refresh
auth.logout
```

저장하는 결과:

```text
success
failure
```

저장하는 식별 정보:

```text
user_id
email_hash
client_ip_hash
user_agent_hash
reason
```

원문 email, IP, User-Agent는 저장하지 않는다.
대신 `JWT_SECRET_KEY`를 key로 사용하는 HMAC-SHA256 hash를 저장한다.

단순 SHA-256을 사용하지 않는 이유는 email/IP처럼 후보 범위가 좁은 값은 dictionary 공격으로 원문을 추측할 수 있기 때문이다.

Audit log에 절대 저장하지 않는 값:

```text
plain password
password_hash
access token
refresh token 원문
refresh token hash
csrf token
raw cookie
raw Authorization header
```
