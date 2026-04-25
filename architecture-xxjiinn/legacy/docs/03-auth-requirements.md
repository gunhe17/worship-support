# Auth 요구사항

이 문서는 signup, login, account status, token, security 요구사항을 정리한다.

## 초기 범위

초기 MVP:

- signup
- login
- refresh
- logout
- current user lookup

후반부 확장:

- rate limiting
- admin user management

## 결정된 요구사항

### Signup 접근 정책

MVP에서는 별도의 invite code 없이 signup을 허용한다.

Signup 성공 시 사용자는 바로 `active` 상태가 된다.

내부용 서비스 보호를 위한 invite code 정책은 이번 MVP 설계에 포함하지 않는다.
필요하면 별도 phase에서 다시 결정한다.

### 사용자 상태

아래 상태를 사용한다.

- `active`
- `blocked`
- `deactivated`

초기 signup은 `active` 사용자를 생성한다.
login은 `active` 사용자에게만 허용한다.

과거 문서의 `is_approved` 기반 signup approval flow는 MVP에 포함하지 않는다.

### 비밀번호 정책

Raw password 규칙:

- 최소 8자
- 최대 72 bytes

MVP에서는 숫자/특수문자/대문자 조합을 강제하지 않는다.

비밀번호는 평문으로 저장하지 않는다.

DB에는 bcrypt 결과인 `password_hash`만 저장한다.

### Token 정책

Access token:

- JWT 사용
- HttpOnly cookie로 전달
- DB에 저장하지 않음
- local/test 기본 만료 15초
- 운영 권장 만료 900초
- claim: `sub`, `type`, `exp`, `iat`, `jti`

Refresh token:

- opaque random token 사용
- HttpOnly cookie로 전달
- DB에는 `sha256(refresh_token)` 결과인 `token_hash`만 저장
- 만료 7일
- refresh 요청 시 rotation 적용

Cookie:

- JavaScript에서 읽지 못하도록 HttpOnly 사용
- local 개발에서는 `Secure=false`
- 운영에서는 HTTPS와 `Secure=true` 사용
- refresh/logout은 CSRF token cookie와 `X-CSRF-Token` header를 함께 검증

## 아직 정하지 않은 것

아래 결정은 아직 확정하지 않았다.

- brute force 방어를 위한 rate limiting 방식
- production CORS 허용 origin 값

## Audit Log 요구사항

Auth MVP에서 audit log는 구현 대상에 포함한다.

기록 대상:

- signup 성공/실패
- login 성공/실패
- refresh 성공/실패
- logout 성공/실패

Audit log는 운영 추적용이며 사용자 응답에는 포함하지 않는다.

저장 금지:

- plain password
- password hash
- access token
- refresh token 원문
- refresh token hash
- csrf token
- raw cookie
- raw email
- raw IP
- raw User-Agent

상관관계 분석이 필요한 email/IP/User-Agent는 원문 대신 HMAC-SHA256 hash로 저장한다.
