# 수동 검증 가이드

이 문서는 auth API를 직접 호출하면서 cookie, JWT, refresh token, CSRF 흐름을 눈으로 확인하기 위한 가이드다.

자동 테스트는 회귀를 잡기 위한 장치이고, 수동 검증은 흐름을 이해하기 위한 학습 도구다.

## 준비

Backend 폴더로 이동한다.

```bash
cd sj-draft/backend
```

PostgreSQL을 실행한다.

```bash
docker compose up -d postgres
```

Migration을 적용한다.

```bash
uv run alembic upgrade head
```

FastAPI 서버를 실행한다.

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

다른 터미널에서 아래 명령을 실행한다.

## 1. Health Check

```bash
curl -i http://127.0.0.1:8000/health
```

기대 결과:

```text
200 OK
```

## 2. Signup

```bash
curl -i -s \
  -X POST http://127.0.0.1:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"manual@example.com","password":"password1234","name":"Manual User"}'
```

확인할 것:

```text
201 Created
Location: /users/<user-id>
Set-Cookie 없음
```

Signup은 계정 생성만 담당한다.
Token 발급은 login에서만 일어난다.

## 3. Login

Cookie jar 파일에 서버가 내려준 cookie를 저장한다.

```bash
curl -i -s \
  -c /tmp/ws-auth-cookies.txt \
  -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manual@example.com","password":"password1234"}'
```

확인할 것:

```text
200 OK
Set-Cookie: access_token=...
Set-Cookie: refresh_token=...
Set-Cookie: csrf_token=...
```

Cookie 의미:

```text
access_token:
  JWT
  HttpOnly
  보호 API 접근에 사용
  local/test 기본 15초 만료

refresh_token:
  opaque random token
  HttpOnly
  access token 재발급에 사용
  DB에는 SHA-256 hash만 저장

csrf_token:
  JavaScript readable
  refresh/logout 요청의 X-CSRF-Token header에 넣어 사용
```

## 4. Current User

```bash
curl -i -s \
  -b /tmp/ws-auth-cookies.txt \
  http://127.0.0.1:8000/users/me
```

기대 결과:

```text
200 OK
data.email = manual@example.com
```

주의:

local/test access token은 15초 만료다.
15초가 지난 뒤 cookie jar가 access token을 보내지 않으면 서버는 `401 UNAUTHENTICATED`를 반환할 수 있다.

## 5. Refresh

Refresh는 `refresh_token` cookie뿐 아니라 CSRF header도 필요하다.

Cookie jar에서 `csrf_token` 값을 꺼낸다.

```bash
CSRF_TOKEN=$(awk '$6=="csrf_token" {print $7}' /tmp/ws-auth-cookies.txt)
```

Refresh를 호출한다.

```bash
curl -i -s \
  -b /tmp/ws-auth-cookies.txt \
  -c /tmp/ws-auth-cookies.txt \
  -X POST http://127.0.0.1:8000/auth/refresh \
  -H "X-CSRF-Token: ${CSRF_TOKEN}"
```

확인할 것:

```text
200 OK
Set-Cookie: access_token=...
Set-Cookie: refresh_token=...
Set-Cookie: csrf_token=...
```

Refresh 성공 시 일어나는 일:

```text
1. 기존 refresh_token 원문을 SHA-256 hash한다.
2. DB에서 token_hash를 찾는다.
3. 기존 refresh_token row의 revoked_at을 채운다.
4. 새 refresh token 원문을 만든다.
5. 새 refresh token hash를 DB에 저장한다.
6. 새 access token JWT를 만든다.
7. 새 access/refresh/csrf cookie를 내려준다.
```

## 6. Logout

Refresh 후에는 CSRF token도 새로 발급되었으므로 cookie jar에서 다시 꺼낸다.

```bash
CSRF_TOKEN=$(awk '$6=="csrf_token" {print $7}' /tmp/ws-auth-cookies.txt)
```

Logout을 호출한다.

```bash
curl -i -s \
  -b /tmp/ws-auth-cookies.txt \
  -c /tmp/ws-auth-cookies.txt \
  -X POST http://127.0.0.1:8000/auth/logout \
  -H "X-CSRF-Token: ${CSRF_TOKEN}"
```

확인할 것:

```text
200 OK
access_token 삭제 cookie
refresh_token 삭제 cookie
csrf_token 삭제 cookie
```

Logout 성공 시 일어나는 일:

```text
1. refresh_token 원문을 SHA-256 hash한다.
2. DB에서 token_hash를 찾는다.
3. 아직 revoke 전이면 revoked_at을 채운다.
4. access/refresh/csrf cookie를 삭제한다.
```

## 7. CSRF 실패 확인

Login 후 CSRF header 없이 refresh를 호출하면 실패해야 한다.

```bash
curl -i -s \
  -b /tmp/ws-auth-cookies.txt \
  -X POST http://127.0.0.1:8000/auth/refresh
```

기대 결과:

```text
403 CSRF_TOKEN_INVALID
```

## 8. DB 확인

PostgreSQL container 안에서 refresh token 저장 상태를 확인한다.

```bash
docker compose exec -T postgres psql -U worship -d worship_support_auth -c \
  "SELECT u.email, length(rt.token_hash) AS hash_length, rt.revoked_at, rt.expires_at FROM refresh_token rt JOIN users u ON u.id = rt.user_id WHERE u.email = 'manual@example.com' ORDER BY rt.created_at;"
```

확인할 것:

```text
token_hash 길이 = 64
refresh 후 이전 row는 revoked_at 있음
현재 활성 row는 revoked_at 없음
logout 후 활성 row도 revoked_at 있음
```

## 9. Audit Log 확인

Auth 이벤트가 audit log에 남았는지 확인한다.

```bash
docker compose exec -T postgres psql -U worship -d worship_support_auth -c \
  "SELECT event_type, result, user_id IS NOT NULL AS has_user_id, length(email_hash) AS email_hash_length, reason, created_at FROM auth_audit_log ORDER BY created_at;"
```

확인할 것:

```text
auth.signup success
auth.login success
auth.refresh success
auth.logout success
email_hash 길이 = 64 또는 null
password/token/cookie 원문 없음
```

## 10. 자동 테스트

```bash
uv run pytest
```

현재 기대 결과:

```text
41 passed
```
