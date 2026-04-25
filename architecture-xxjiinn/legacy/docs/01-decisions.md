# 결정 기록

이 문서는 auth 튜토리얼을 진행하면서 정한 프로젝트 결정을 기록한다.

결정 기록은 아래 형식을 사용한다.

- 문제
- 선택지
- 결정
- 이유
- 코드 영향

## D-0001. 튜토리얼 진행 방식

### 문제

AI 도구가 한 번에 너무 많은 코드를 구현하면 학습자가 아키텍처와 요청 흐름을 따라가기 어렵다.

### 선택지

- 먼저 구현하고 나중에 설명한다.
- 개념만 설명하고 구현하지 않는다.
- 개념 학습, 선택지 비교, 결정, 문서화, 설계, 구현, 코드 리딩, 테스트를 step 단위로 진행한다.

### 결정

아래 순서로 튜토리얼을 진행한다.

1. 개념 학습
2. Spring MVC 비교
3. 프로젝트 문제 정의
4. 선택지 정리
5. 결정
6. 문서화
7. 설계
8. 구현
9. 코드 리딩
10. 테스트/검증

### 이유

목표는 signup/login 기능 완성만이 아니다.
목표는 worship-support 프로젝트를 계속 개발할 수 있을 정도로 구조를 이해하는 것이다.

### 코드 영향

관련 개념과 설계가 이해되고 확인되기 전에는 구현을 시작하지 않는다.

## D-0002. 초기 MVP 범위

### 문제

Auth에는 signup, login, refresh token, logout, password reset, OAuth, audit log, rate limiting, admin approval 등 많은 기능이 포함될 수 있다.
모든 기능을 한 번에 구현하면 학습 범위가 너무 넓어진다.

### 선택지

- 모든 auth 기능을 한 번에 구현한다.
- signup만 구현한다.
- signup, login, current-user lookup을 먼저 구현하고 이후 확장한다.
- signup, login, refresh, logout, current-user lookup까지 인증 MVP로 구현한다.

### 결정

초기 MVP 범위는 아래와 같다.

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/me`

Audit log, rate limiting, admin flow는 초기에 설계 방향만 고려하고 구현은 뒤로 미룬다.

### 이유

signup, login, refresh, logout, current-user lookup은 실무적인 최소 인증 루프를 구성한다.

1. 계정을 만든다.
2. credential로 인증한다.
3. access token과 refresh token을 발급한다.
4. access token으로 보호 API에 접근한다.
5. access token 만료 후 refresh token으로 갱신한다.
6. logout으로 refresh token을 폐기한다.

### 코드 영향

초기 구현은 아래에 집중한다.

- user table
- password hashing
- JWT access token
- refresh_token table
- opaque refresh token
- auth endpoint
- refresh/logout endpoint
- current user dependency
- users/me endpoint

## D-0003. 문서와 구현 위치

### 문제

학습, 설계, 구현 기록을 기존 draft들과 분리해 새롭게 시작할 전용 공간이 필요하다.

### 선택지

- 기존 `worship-support`, `v1`, `test` 문서를 계속 수정한다.
- 새 학습/구현 폴더를 만든다.

### 결정

`sj-draft`를 auth 학습, 설계, 구현, 문서화 전용 폴더로 사용한다.

### 이유

이전 내부 파일들을 지우고 새롭게 시작하기로 했기 때문에, 기존 draft와 섞지 않는 편이 명확하다.

### 코드 영향

문서는 아래에 둔다.

```text
sj-draft/docs
```

구현은 아래에 둔다.

```text
sj-draft/backend
```

## D-0004. 기준 문서 우선순위

### 문제

workspace 안에는 서로 다른 시점에 작성된 문서들이 있다.
일부 문서는 Next.js, Supabase Auth, Supabase RLS, SSR session, `is_approved` 기반 관리자 승인 흐름 등 과거 방향을 설명한다.

이 문서들을 같은 우선순위로 두면 auth 구현 기준이 흔들린다.

### 선택지

- 기존 문서를 모두 같은 기준으로 본다.
- Supabase/Next.js 기반 문서를 따른다.
- 최신 FastAPI 기반 v1 아키텍처 문서를 1순위로 두고, 충돌하는 과거 방향은 따르지 않는다.

### 결정

이번 auth 튜토리얼의 기준 문서는 아래 순서로 둔다.

1. 1순위 아키텍처 기준:
   - `v1/architecture-decision-draft-v1.md`
2. API 참고:
   - `v1/api-design-draft-v1.md`
3. DDD 학습과 문서화 스타일 참고:
   - `worship-support/docs/DDD-docs.md`
4. 제품/도메인 방향 참고:
   - `test/project.md`
   - `worship-support/docs/project.md`

Supabase/Next.js/RLS 기반 문서는 이번 튜토리얼에서 따르지 않는다.

### 이유

`v1/architecture-decision-draft-v1.md`는 현재 FastAPI, PostgreSQL, SQLAlchemy async, JWT 방향을 반영한다.
Supabase/Next.js/RLS 기반 문서는 과거 아키텍처이며 이번 학습 목표와 충돌한다.

### 코드 영향

이번 튜토리얼에서는 아래를 사용한다.

- FastAPI
- PostgreSQL
- SQLAlchemy async
- JWT
- password hashing
- endpoint -> usecase -> domain/repository -> database
- usecase-level transaction boundary

이번 튜토리얼에서는 아래를 사용하지 않는다.

- Next.js App Router
- Supabase Auth
- Supabase RLS
- Supabase SSR session handling

## D-0005. 초기 사용자 상태 정책

### 문제

과거 문서에는 `is_approved` 기반 관리자 승인 흐름이 있었다.
현재 v1 아키텍처 문서는 더 단순한 사용자 상태 모델을 사용한다.

Auth 구현에는 하나의 명확한 계정 상태 모델이 필요하다.

### 선택지

- signup 후 `is_approved=false`로 만들고 관리자 승인을 요구한다.
- signup 후 바로 `status=active`로 만든다.
- `is_approved`와 `status`를 함께 사용한다.

### 결정

상태 기반 모델을 사용한다.

- `active`
- `blocked`
- `deactivated`

초기 signup은 `active` 사용자를 생성한다.
login은 `active` 사용자에게만 허용한다.
`is_approved` 기반 관리자 승인 흐름은 MVP에서 제외한다.

### 이유

v1 아키텍처 문서를 따르며, 초기 auth 흐름을 단순하게 유지한다.
관리자 승인은 팀에서 필요하다고 결정하면 나중에 추가할 수 있다.

### 코드 영향

초기 user table에는 `status` 컬럼을 둔다.

login usecase는 token 발급 전에 아래 조건을 확인한다.

```text
user.status == active
```

## D-0006. 레이어 책임 규칙

### 문제

FastAPI는 자유도가 높다.
명확한 규칙이 없으면 endpoint 코드 안에 HTTP 처리, 검증, 비즈니스 흐름, 비밀번호 해시, 토큰 생성, DB 접근이 모두 섞일 수 있다.

### 선택지

- 대부분의 로직을 FastAPI endpoint에 둔다.
- 일반적인 MVC 스타일의 큰 service layer를 둔다.
- endpoint, usecase, domain, repository, infrastructure, Unit of Work 경계를 명확히 둔다.

### 결정

아래 레이어 경계를 사용한다.

```text
endpoint -> usecase -> domain/repository -> database
```

Repository는 DB 접근을 담당하지만 commit/rollback은 하지 않는다.
트랜잭션 제어는 usecase 또는 Unit of Work 경계가 담당한다.

Domain 객체는 FastAPI, SQLAlchemy, PostgreSQL, JWT, bcrypt에 의존하지 않는다.

### 이유

명확한 경계는 요청 흐름 이해를 돕고, 프레임워크/DB/보안 라이브러리 세부사항이 도메인 규칙으로 새는 것을 막는다.

### 코드 영향

signup/login 구현은 아래를 분리한다.

- endpoint/router
- Pydantic schema
- usecase
- domain entity/value object
- repository port
- SQLAlchemy repository adapter
- Unit of Work
- security service

## D-0007. 개발 환경 선택

### 문제

FastAPI 프로젝트는 Spring Boot와 달리 패키지 관리, 실행 명령, DB 실행 방식, 환경변수, 테스트 DB 구성을 직접 정해야 한다.

### 선택지

- 시스템 Python과 pip만 사용한다.
- poetry를 사용한다.
- uv를 사용한다.
- PostgreSQL을 로컬에 직접 설치한다.
- PostgreSQL을 Docker Compose로 실행한다.

### 결정

이번 튜토리얼의 개발 환경은 아래로 정한다.

- 패키지 관리: `uv`
- Python: 현재 로컬의 Python 3.13
- 구현 위치: `sj-draft/backend`
- DB 실행: Docker Compose
- PostgreSQL 이미지: `postgres:16-alpine`
- 로컬 DB: `worship_support_auth`
- 테스트 DB: `worship_support_auth_test`

### 이유

`uv`는 Python 프로젝트의 의존성 관리와 실행을 간단하게 해준다.
Docker Compose로 PostgreSQL을 실행하면 로컬 설치 상태와 무관하게 동일한 DB 환경을 재현할 수 있다.
로컬 DB와 테스트 DB를 분리하면 테스트 데이터가 개발 데이터를 오염시키지 않는다.

### 코드 영향

추후 아래 파일을 만든다.

```text
sj-draft/backend/pyproject.toml
sj-draft/backend/docker-compose.yml
sj-draft/backend/.env.example
sj-draft/backend/app
```

## D-0008. 문서 언어

### 문제

튜토리얼의 목적은 학습과 구현 흐름 이해다.
문서가 영어로 작성되면 개념 이해보다 번역에 불필요한 에너지가 들어갈 수 있다.

### 선택지

- 모든 문서를 영어로 작성한다.
- 모든 문서를 한국어로 작성한다.
- 설명 문서는 한국어로 작성하고, 코드 식별자와 API 이름은 영어를 사용한다.

### 결정

튜토리얼 문서는 한국어로 작성한다.

단, 아래 항목은 영어를 사용한다.

- 코드
- 파일명
- 클래스명
- 함수명
- 변수명
- API 경로
- 에러 코드
- 라이브러리 이름

### 이유

개념 설명과 설계 의도는 한국어가 학습에 더 적합하다.
하지만 실제 코드와 API는 Python/FastAPI 생태계의 관례에 맞춰 영어를 사용한다.

### 코드 영향

문서 본문은 한국어로 유지한다.
코드 내부 주석은 필요할 때만 사용하며, 프로젝트 코드 스타일에 맞춰 간결하게 작성한다.

## D-0009. 초기 FastAPI 프로젝트 구조

### 문제

구현을 시작하기 전에 파일 구조를 정하지 않으면 FastAPI endpoint, 설정, DB 연결, domain 코드가 섞일 수 있다.

### 선택지

- 하나의 `main.py`에 모든 코드를 작성한다.
- Spring MVC처럼 controller/service/repository 중심으로만 구성한다.
- `core`와 `domains`를 나누고, 도메인별로 endpoint/schema/usecase/domain/model/repository를 분리한다.

### 결정

초기 backend 구조는 아래처럼 시작한다.

```text
sj-draft/backend/
├── pyproject.toml
├── docker-compose.yml
├── .env.example
├── alembic.ini
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── exceptions.py
│   │   └── security.py
│   └── domains/
│       ├── auth/
│       │   ├── cookies.py
│       │   ├── dependency.py
│       │   ├── endpoint.py
│       │   ├── schema.py
│       │   └── usecase.py
│       └── user/
│           ├── domain.py
│           ├── endpoint.py
│           ├── model.py
│           ├── repository.py
│           └── schema.py
├── migrations/
└── tests/
```

### 이유

초기부터 endpoint, usecase, domain, ORM model, repository의 위치를 나누면 이후 signup/login 구현 시 책임 경계를 따라가기 쉽다.

### 코드 영향

`app/main.py`는 FastAPI 앱 생성과 router 등록만 담당한다.

`app/core`는 설정, DB 연결, 공통 예외, 보안 도구를 담당한다.

`app/domains/auth`는 signup/login 같은 인증 흐름을 담당한다.

`app/domains/user`는 user domain, user persistence, `/users/me` 같은 사용자 관련 기능을 담당한다.

## D-0010. 환경변수 파일 관리

### 문제

JWT secret, DB URL 같은 설정값은 코드에 직접 박아두면 환경별 변경이 어렵고 보안상 위험하다.

### 선택지

- 설정값을 코드에 직접 작성한다.
- `.env`만 사용하고 샘플 파일은 만들지 않는다.
- `.env.example`로 필요한 환경변수를 문서화하고, 실제 로컬 값은 `.env`에 둔다.

### 결정

`.env.example`과 `.env`를 함께 사용한다.

- `.env.example`: 커밋 가능한 샘플 파일
- `.env`: 로컬 실행용 실제 설정 파일

`.env`는 `.gitignore`에 포함한다.

### 이유

팀원은 `.env.example`을 보고 필요한 설정을 알 수 있다.
실제 secret이나 로컬 설정은 `.env`에만 둔다.

### 코드 영향

`app/core/config.py`는 Pydantic Settings를 사용해 `.env` 값을 읽는다.

## D-0011. Signup 접근 정책

### 문제

worship-support는 교회/팀 내부용 서비스에 가깝다.
따라서 URL을 아는 사람이 누구나 가입해도 되는지, invite code나 관리자 승인이 필요한지 결정해야 한다.

### 선택지

- 누구나 signup 가능
- invite code 필요
- 관리자 승인 필요
- private deploy 또는 내부 URL로 제한

### 결정

MVP에서는 invite code 없이 signup을 허용한다.

Signup 성공 시 사용자는 바로 `active` 상태가 된다.

invite code 정책은 이번 MVP 설계에 포함하지 않는다.
필요하면 별도 phase에서 다시 결정한다.

### 이유

이번 튜토리얼의 목표는 signup/login의 기본 인증 흐름을 완전히 이해하는 것이다.
invite code를 초기에 넣으면 signup request, 설정, 검증, 에러 계약이 늘어나 학습 초점이 분산된다.

### 코드 영향

`POST /auth/signup` request에는 invite code field를 두지 않는다.

Signup usecase는 invite code를 검증하지 않는다.

Signup usecase는 새 user의 초기 상태를 `active`로 설정한다.

## D-0012. 비밀번호 정책

### 문제

이메일/비밀번호 기반 login을 직접 구현하려면 사용자가 입력하는 raw password 규칙과 DB 저장 방식을 정해야 한다.

### 선택지

- 평문 비밀번호 저장
- 복호화 가능한 암호화 저장
- 빠른 단순 hash 저장
- bcrypt, Argon2, scrypt 같은 password hashing algorithm 결과 저장
- 외부 인증 provider 사용
- passwordless login
- passkey/WebAuthn

### 결정

MVP에서는 자체 이메일/비밀번호 login을 구현한다.

Raw password 규칙:

- 최소 8자
- 최대 72 bytes

복잡도:

- MVP에서는 숫자/특수문자/대문자 조합을 강제하지 않는다.

저장:

- plain password는 절대 저장하지 않는다.
- DB에는 `password_hash`만 저장한다.

해시:

- bcrypt를 사용한다.

### 이유

평문 저장은 DB 유출 시 즉시 사용자 비밀번호가 노출되므로 금지한다.
복호화 가능한 암호화 저장은 서버가 복호화 키를 가져야 하므로 login 검증 목적에 적합하지 않다.
빠른 단순 hash는 대량 대입 공격에 취약하다.

bcrypt는 salt와 cost를 포함하는 password hashing algorithm이며, 이메일/비밀번호 login에서 널리 사용되는 실무적 선택이다.

bcrypt는 일반적으로 72 bytes까지만 유의미하게 처리하므로 raw password 최대 길이를 72 bytes로 둔다.

문자 수와 byte 수는 다를 수 있다.
예를 들어 한글은 UTF-8에서 한 글자가 여러 bytes가 될 수 있으므로, 구현에서는 `len(password.encode("utf-8")) <= 72`를 확인한다.

초기 검증에서 `passlib`와 현재 `bcrypt` 라이브러리 조합의 호환성 문제가 확인되었다.
따라서 `passlib` 래퍼를 사용하지 않고 `bcrypt` 라이브러리를 직접 사용한다.

### 코드 영향

`POST /auth/signup` request는 raw password를 받는다.

Domain layer에는 입력 password를 검증하는 `RawPassword` value object 후보를 둔다.

DB user table에는 plain password 컬럼을 만들지 않는다.

DB user table에는 아래 컬럼만 둔다.

```text
password_hash
```

`PasswordHasher`는 `bcrypt` 라이브러리를 직접 사용해 hash/verify를 담당한다.

Login usecase는 raw password와 저장된 `password_hash`를 비교할 때 bcrypt verify를 사용한다.

## D-0013. Token 저장과 전달 방식

### 문제

Access token과 refresh token을 어디에 저장하고 어떻게 서버에 전달할지 정해야 한다.

후보 저장소는 DB, memory, localStorage, sessionStorage, cookie가 있다.

### 선택지

- access token을 memory에 저장하고 `Authorization: Bearer`로 전달한다.
- access token을 localStorage/sessionStorage에 저장한다.
- access token과 refresh token을 모두 HttpOnly cookie로 전달한다.
- refresh token 원문을 DB에 저장한다.
- refresh token hash만 DB에 저장한다.

### 결정

이번 MVP에서는 cookie 기반 인증을 사용한다.

저장 위치:

| 대상 | 저장 위치 |
|---|---|
| access token 원문 | HttpOnly cookie |
| access token hash | 저장하지 않음 |
| refresh token 원문 | HttpOnly cookie |
| refresh token hash | DB |
| csrf token 원문 | 일반 cookie + request header |

Access token은 JWT로 만든다.

Refresh token은 opaque random token으로 만든다.

### 이유

`localStorage`와 `sessionStorage`는 JavaScript에서 읽을 수 있으므로 XSS가 발생하면 token 원문 탈취 위험이 크다.

HttpOnly cookie는 JavaScript에서 읽을 수 없으므로 token 원문 탈취 위험을 줄인다.

Access token은 짧게 살고 JWT 서명과 만료 시간으로 검증할 수 있으므로 서버 DB에 저장하지 않는다.

Refresh token은 오래 사는 장기 자격 증명이므로 서버에서 revoke/rotation을 통제해야 한다.
따라서 DB에 hash를 저장하고, 원문은 저장하지 않는다.

### 코드 영향

Login 성공 시 response body에 token을 직접 내려주지 않는다.

대신 response header에 아래 cookie를 설정한다.

```text
access_token
refresh_token
csrf_token
```

Protected endpoint는 `Authorization: Bearer` header가 아니라 cookie의 access token을 읽어 인증한다.

Refresh endpoint는 cookie의 refresh token을 읽어 인증한다.

Refresh/logout처럼 인증 cookie가 포함되는 변경 요청은 `csrf_token` cookie와 `X-CSRF-Token` header가 일치해야 한다.

## D-0014. Access Token JWT 정책

### 문제

Access token은 보호 API 접근에 사용되는 짧은 수명의 인증 수단이다.
MVP라도 JWT를 장난감처럼 구현하면 이후 보안 구조가 흔들린다.

### 선택지

- 최소 claim으로 `sub`, `exp`만 넣는다.
- `sub`, `type`, `exp`, `iat`, `jti`를 넣는다.
- access token도 DB에 저장해 매 요청마다 조회한다.

### 결정

Access token은 JWT로 구현한다.

Algorithm:

```text
HS256
```

Claim:

- `sub`: user id
- `type`: `access`
- `exp`: 만료 시각
- `iat`: 발급 시각
- `jti`: token id

만료 시간:

```text
local/test 기본값: 15초
운영 권장값: 900초
```

만료 시간은 코드에 하드코딩하지 않고 환경변수로 관리한다.

### 이유

`type`을 넣으면 refresh token이나 다른 token을 access token으로 오용하는 실수를 막을 수 있다.

`iat`는 발급 시각 추적에 유용하다.

`jti`는 나중에 blacklist, audit, debugging, token 추적 기능을 확장할 때 사용할 수 있다.

학습 중에는 만료를 빠르게 확인하기 위해 15초를 사용한다.
운영에서는 15분에 해당하는 900초를 권장한다.

### 코드 영향

환경변수는 아래 이름을 사용한다.

```text
ACCESS_TOKEN_EXPIRE_SECONDS
```

JWT 검증 시 아래를 확인한다.

- signature
- `exp`
- `type == "access"`
- `sub`
- `jti`

## D-0015. Refresh Token 정책

### 문제

Refresh token은 access token보다 오래 사는 장기 자격 증명이다.
따라서 logout, revoke, rotation, 탈취 감지를 고려해야 한다.

### 선택지

- JWT refresh token을 DB 없이 사용한다.
- JWT refresh token에 `jti`를 넣고 DB에서 revoke 상태를 관리한다.
- Opaque random refresh token을 만들고 DB에는 hash만 저장한다.

### 결정

Refresh token은 opaque random token으로 구현한다.

DB에는 refresh token 원문을 저장하지 않고 `sha256(refresh_token)` 결과만 저장한다.

Refresh token 만료 시간:

```text
7일
```

Refresh 요청 시 rotation을 적용한다.

### 이유

Refresh token을 제대로 logout/revoke/rotation하려면 서버가 token 상태를 기억해야 한다.
JWT refresh token을 사용하더라도 `jti`, `revoked_at`, `expires_at`을 DB에서 확인해야 하므로 DB 조회가 필요하다.

어차피 DB가 source of truth라면, refresh token 자체에 payload를 넣는 JWT보다 의미 없는 random string인 opaque token이 더 단순하다.

DB에는 hash만 저장하므로 DB가 유출되어도 refresh token 원문이 바로 노출되지 않는다.

### 코드 영향

`refresh_token` table 후보 컬럼:

```text
id
user_id
token_hash
expires_at
revoked_at
created_at
```

`POST /auth/refresh`는 cookie에서 받은 refresh token 원문을 sha256 hash한 뒤 DB의 `token_hash`와 비교한다.

유효한 refresh token이면:

1. 기존 refresh token row를 revoke한다.
2. 새 refresh token을 발급한다.
3. 새 refresh token hash를 DB에 저장한다.
4. 새 access token을 발급한다.
5. access/refresh cookie를 다시 설정한다.

## D-0016. API 에러 계약

### 문제

인증 기능은 실패 흐름이 많다.
실패 시 HTTP status, error code, message가 endpoint마다 다르면 클라이언트와 테스트가 복잡해진다.

또한 usecase/domain/repository가 FastAPI의 `HTTPException`을 직접 알게 되면 HTTP 세부사항이 하위 레이어로 새어 들어간다.

### 선택지

- FastAPI 기본 에러 응답을 그대로 사용한다.
- Endpoint마다 직접 `HTTPException`을 던진다.
- 프로젝트 공통 `AppError`와 `ErrorCode`를 만들고, FastAPI exception handler에서 HTTP 응답으로 변환한다.

### 결정

프로젝트 공통 에러 응답 형식을 사용한다.

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message."
  }
}
```

Usecase/domain/repository는 FastAPI `HTTPException`을 직접 던지지 않는다.
대신 `AppError`를 사용한다.

FastAPI exception handler가 `AppError`를 HTTP 응답으로 변환한다.

FastAPI/Pydantic validation error는 기본 422 대신 프로젝트 계약에 맞춰 `400 VALIDATION_ERROR`로 변환한다.

### 이유

에러 응답 계약이 고정되면 클라이언트와 테스트가 예측 가능해진다.

HTTP 변환을 exception handler에 모으면 하위 레이어가 HTTP를 몰라도 된다.

로그인 실패에서 email 없음과 password 틀림을 구분하지 않으면 계정 존재 여부 노출 위험을 줄일 수 있다.

### 코드 영향

초기 에러 코드는 아래를 사용한다.

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

`app/core/exceptions.py`에 `ErrorCode`, `AppError`, status/message mapping을 둔다.

`app/main.py`에 `AppError`와 `RequestValidationError` handler를 등록한다.

## D-0017. Auth MVP DB 스키마

### 문제

Signup, login, refresh, logout, current user lookup을 구현하려면 사용자와 refresh token을 저장할 DB 스키마가 필요하다.

### 선택지

- `BIGINT AUTO_INCREMENT` id를 사용한다.
- UUID id를 사용한다.
- user table 이름을 v1 문서처럼 `"user"`로 둔다.
- user table 이름을 실무 편의상 `users`로 둔다.
- status를 application에서만 검증한다.
- status를 DB CHECK 제약으로도 검증한다.

### 결정

초기 Auth MVP에는 아래 테이블을 둔다.

```text
users
refresh_token
```

`user`는 SQL 키워드와 충돌 가능성이 있고 SQL에서 quote가 필요하므로, 실무 편의상 `users`를 사용한다.

`users`:

```text
id UUID PK
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
name TEXT NOT NULL
status TEXT NOT NULL CHECK active/blocked/deactivated
is_admin BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

`refresh_token`:

```text
id UUID PK
user_id UUID NOT NULL FK -> users.id
token_hash TEXT UNIQUE NOT NULL
expires_at TIMESTAMPTZ NOT NULL
revoked_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

`refresh_token`에는 `updated_at`을 두지 않는다.
상태 변화는 `revoked_at`으로 표현한다.

### 이유

UUID는 외부 API에 노출해도 순차 id보다 추측이 어렵고, v1 문서의 방향과도 맞다.

Email은 application에서 중복 확인을 하더라도 동시성 정합성을 위해 DB unique 제약이 필요하다.

Status는 domain에서 `UserStatus`로 검증하고, DB에서도 CHECK 제약으로 잘못된 값 저장을 막는다.

Refresh token은 `token_hash`로 조회하므로 unique 제약이 필요하다.

시간 컬럼은 v1 문서 기준에 따라 `TIMESTAMPTZ`를 사용하고 UTC 기준으로 저장한다.

### 코드 영향

SQLAlchemy model은 `users`, `refresh_token` 테이블을 정의한다.

Alembic migration은 두 테이블과 필요한 제약을 생성한다.

Domain layer에는 `UserStatus`를 둔다.

Repository는 `users.email`과 `refresh_token.token_hash` 기준 조회를 제공한다.

## D-0018. Domain Entity와 ORM Model 분리

### 문제

SQLAlchemy model을 domain entity로 그대로 사용할지, domain entity와 ORM model을 분리할지 정해야 한다.

### 선택지

- SQLAlchemy model을 domain entity로 그대로 사용한다.
- Domain entity와 SQLAlchemy ORM model을 분리한다.

### 결정

이번 튜토리얼에서는 domain entity와 SQLAlchemy ORM model을 분리한다.

예상 구조:

```text
app/domains/user/domain.py
  User
  Email
  RawPassword
  PasswordHash
  UserStatus

app/domains/user/model.py
  UserModel
  RefreshTokenModel

app/domains/user/repository.py
  SQLAlchemy model <-> Domain object 변환
```

### 이유

이번 튜토리얼의 목표는 단순 구현이 아니라 DDD 방식의 경계를 이해하는 것이다.

SQLAlchemy model을 domain entity로 그대로 사용하면 빠르게 구현할 수 있지만, domain code가 ORM과 DB 세부사항을 알게 된다.

분리하면 코드와 mapper가 늘어나지만, 아래 장점이 있다.

- domain object가 FastAPI/SQLAlchemy/PostgreSQL을 몰라도 된다.
- domain 규칙을 DB 없이 테스트하기 쉽다.
- persistence model 변경이 domain model로 바로 번지지 않는다.
- endpoint -> usecase -> domain/repository -> database 경계가 더 명확해진다.

### 코드 영향

`User` domain entity는 dataclass 또는 일반 class로 구현한다.

SQLAlchemy model은 `UserModel`, `RefreshTokenModel`로 구현한다.

Repository는 domain object와 ORM model 사이의 변환을 담당한다.

## D-0019. Alembic Migration Workflow

### 문제

DB schema 변경을 어떻게 관리할지 정해야 한다.
Spring Boot의 `ddl-auto`처럼 자동으로 schema를 바꾸는 방식은 학습에는 편하지만 운영 실무의 변경 이력을 명확히 남기기 어렵다.

### 선택지

- 애플리케이션 실행 시 자동으로 table을 생성한다.
- Alembic autogenerate로 migration을 만든다.
- 초기 migration은 직접 작성하고, 이후 필요하면 autogenerate를 학습해 사용한다.

### 결정

초기 migration은 직접 작성한다.

Migration 대상:

```text
users
refresh_token
```

Migration 위치:

```text
backend/migrations/versions
```

실행:

```text
uv run alembic upgrade head
```

### 이유

초기 schema는 학습상 매우 중요하다.
UUID, UNIQUE, CHECK, FK, TIMESTAMPTZ 같은 DB 요소가 실제로 어떻게 생성되는지 직접 확인하는 편이 좋다.

Autogenerate는 편하지만, 처음부터 사용하면 migration이 어떤 의미인지 놓치기 쉽다.

### 코드 영향

`migrations/env.py`를 구성한다.

초기 migration 파일에서 `users`, `refresh_token` 테이블을 직접 생성한다.

이후 schema 변경부터는 필요하면 autogenerate도 학습하고 사용할 수 있다.

## D-0020. Security Service 책임

### 문제

Signup/login/refresh 구현에는 password hash, JWT 생성/검증, opaque refresh token 생성/hash가 필요하다.
이 로직을 domain entity에 넣으면 domain이 bcrypt, JWT, SHA-256 같은 기술 세부사항을 알게 된다.

### 선택지

- Domain object가 직접 bcrypt/JWT/SHA-256을 사용한다.
- Usecase 안에 bcrypt/JWT/SHA-256 코드를 직접 작성한다.
- 보안 기술 처리를 담당하는 service를 `app/core/security.py`에 분리한다.

### 결정

`app/core/security.py`에 아래 service를 둔다.

```text
PasswordHasher
TokenService
RefreshTokenService
```

`PasswordHasher`:

- bcrypt hash
- bcrypt verify

`TokenService`:

- access token JWT 생성
- access token JWT 검증
- `sub`, `type`, `exp`, `iat`, `jti` claim 검증

`RefreshTokenService`:

- opaque refresh token 원문 생성
- refresh token SHA-256 hash 생성

### 이유

Domain object는 비즈니스 의미와 규칙만 담당해야 한다.

보안 알고리즘과 라이브러리 사용은 기술 세부사항이므로 core/security service에 둔다.

Usecase는 보안 service를 호출해 흐름을 조립하되, bcrypt/JWT/SHA-256 내부 구현을 직접 알지 않는다.

### 코드 영향

Signup usecase는 `PasswordHasher.hash()`를 사용한다.

Login usecase는 `PasswordHasher.verify()`와 `TokenService.create_access_token()`을 사용한다.

Refresh usecase는 `RefreshTokenService.hash()`와 `RefreshTokenService.create_raw_token()`을 사용한다.

Protected endpoint dependency는 `TokenService.verify_access_token()`을 사용한다.

## D-0021. Repository와 Unit of Work

### 문제

DB 조회/저장 로직과 transaction commit/rollback 책임을 어디에 둘지 정해야 한다.

Repository가 직접 commit하면 여러 DB 작업을 하나의 usecase transaction으로 묶기 어렵다.

### 선택지

- Repository method가 직접 commit한다.
- Usecase가 SQLAlchemy session을 직접 다룬다.
- Repository는 조회/저장만 담당하고, Unit of Work가 transaction 경계를 담당한다.

### 결정

Repository는 DB 조회/저장만 담당한다.

Unit of Work가 SQLAlchemy session 생명주기와 commit/rollback을 담당한다.

초기 구현:

```text
SqlAlchemyUserRepository
SqlAlchemyRefreshTokenRepository
SqlAlchemyUnitOfWork
```

### 이유

Signup은 user 저장 하나만 포함하지만, login/refresh/logout은 여러 작업이 하나의 transaction 안에서 처리되어야 한다.

예:

```text
login:
  user 조회
  refresh token 저장
  commit

refresh:
  기존 refresh token revoke
  새 refresh token 저장
  commit
```

Repository가 직접 commit하면 이 흐름을 하나의 transaction으로 제어하기 어렵다.

### 코드 영향

Usecase는 아래처럼 Unit of Work를 사용한다.

```text
async with uow:
  ...
  await uow.commit()
```

`commit()`을 호출하지 않고 context를 빠져나가면 session은 닫힌다.
이때 명시적으로 rollback한다.
예외가 발생하면 rollback한다.

Repository는 domain object와 SQLAlchemy model 사이의 변환도 담당한다.

## D-0022. FastAPI Dependency와 Cookie 책임 분리

### 문제

초기 구현에서는 auth endpoint가 usecase 생성, cookie 설정/삭제, 요청 처리까지 함께 담당했다.
`/users/me`의 현재 사용자 조회 dependency도 user endpoint 안에 있었다.

이 구조는 동작은 하지만 endpoint가 커질수록 아래 문제가 생긴다.

- endpoint가 HTTP 입출력보다 많은 조립 책임을 가진다.
- 여러 endpoint가 같은 cookie 정책을 반복할 가능성이 생긴다.
- 다른 보호 API가 생길 때 current-user dependency를 재사용하기 어렵다.

### 선택지

- endpoint 안에 usecase 생성과 cookie 처리를 계속 둔다.
- 모든 dependency를 `core`에 모은다.
- auth domain 안에 cookie helper와 FastAPI dependency를 분리한다.

### 결정

Auth HTTP 경계에 가까운 기능은 `app/domains/auth` 안에서 분리한다.

```text
app/domains/auth/cookies.py
  set_auth_cookies
  delete_auth_cookies

app/domains/auth/dependency.py
  get_signup_usecase
  get_login_usecase
  get_refresh_usecase
  get_logout_usecase
  get_current_user
```

Endpoint는 request를 받고 usecase를 호출한 뒤 response를 반환하는 얇은 역할을 유지한다.

### 이유

FastAPI의 `Depends`는 Spring의 bean injection과 완전히 같지는 않지만, endpoint에서 필요한 객체를 조립하는 경계를 만들 수 있다.

Cookie 설정은 HTTP 세부사항이므로 usecase나 domain이 알면 안 된다.
하지만 auth endpoint와 강하게 관련되므로 `core` 전체 공통으로 올리기보다는 auth 영역에 둔다.

`get_current_user`는 user 조회를 하지만 의미상 인증된 주체를 해석하는 auth dependency다.
따라서 user endpoint가 직접 소유하지 않고 auth dependency로 분리한다.

### 코드 영향

`app/domains/auth/endpoint.py`는 아래만 담당한다.

- request schema 수신
- usecase 호출
- response schema 생성
- cookie helper 호출

`app/domains/user/endpoint.py`는 `get_current_user`를 import해서 사용한다.

새 보호 endpoint는 아래처럼 현재 사용자를 재사용할 수 있다.

```python
current_user: Annotated[User, Depends(get_current_user)]
```

## D-0023. Cookie 인증의 CSRF 방어

### 문제

HttpOnly cookie는 JavaScript가 token 원문을 읽지 못하게 해 XSS에 의한 token 탈취 위험을 줄인다.
하지만 cookie는 브라우저가 요청에 자동으로 붙이므로, 인증 cookie 기반 서비스는 CSRF를 함께 고려해야 한다.

예를 들어 사용자가 로그인한 상태에서 악성 사이트가 우리 API로 `POST` 요청을 유도할 수 있다면, 브라우저가 cookie를 자동으로 붙일 수 있다.

### 선택지

- `SameSite=Lax` cookie만 사용한다.
- 모든 상태 변경 요청에 CSRF token을 요구한다.
- access token을 cookie가 아니라 memory/localStorage에 두고 `Authorization` header로 보낸다.

### 결정

MVP에서는 아래 두 방어를 함께 사용한다.

1. Cookie 기본값은 `SameSite=Lax`로 둔다.
2. 인증 cookie가 포함되는 refresh/logout 요청에는 double-submit CSRF token을 요구한다.

구현 방식:

```text
csrf_token cookie
X-CSRF-Token header
```

서버는 두 값이 없거나 서로 다르면 `403 CSRF_TOKEN_INVALID`를 반환한다.

### 이유

`SameSite=Lax`는 cross-site POST에서 cookie 전송을 줄여주는 1차 방어다.
하지만 future frontend 구조, 배포 도메인, browser 정책 변화까지 고려하면 명시적인 CSRF 검증 경계를 두는 편이 안전하다.

CSRF token cookie는 JavaScript가 읽을 수 있도록 `HttpOnly=false`로 둔다.
클라이언트는 이 값을 읽어 `X-CSRF-Token` header에 넣어 보낸다.

이 token은 access/refresh token처럼 인증 자격 증명이 아니다.
목적은 "요청을 만든 쪽이 우리 origin의 JavaScript인가"를 확인하는 것이다.

### 코드 영향

`app/domains/auth/cookies.py`는 아래를 담당한다.

- `access_token` HttpOnly cookie 설정/삭제
- `refresh_token` HttpOnly cookie 설정/삭제
- `csrf_token` 일반 cookie 설정/삭제
- `csrf_token` cookie와 `X-CSRF-Token` header 비교

`POST /auth/refresh`:

- refresh token cookie가 없으면 `REFRESH_TOKEN_INVALID`
- refresh token cookie가 있으면 CSRF 검증 후 refresh usecase 실행

`POST /auth/logout`:

- auth cookie가 없으면 멱등적으로 성공하되 cookie 삭제 header를 내려주지 않는다.
- auth cookie가 있으면 CSRF 검증 후 logout usecase를 실행하고 auth cookie를 삭제한다.

## D-0024. CORS 설정 경계

### 문제

Cookie 기반 인증을 브라우저 frontend에서 사용하려면 CORS와 credential 설정이 맞아야 한다.
특히 frontend와 API origin이 다르면 browser가 credential cookie와 custom header인 `X-CSRF-Token`을 보내도록 서버가 허용해야 한다.

하지만 현재는 frontend origin이 아직 확정되지 않았다.

### 선택지

- CORS를 전혀 구성하지 않는다.
- 모든 origin을 허용한다.
- 설정값으로 허용 origin을 주입하고, 기본값은 비워둔다.

### 결정

CORS 설정 경계를 코드에 추가하되, 기본값은 비활성으로 둔다.

환경변수:

```text
CORS_ALLOWED_ORIGINS=[]
CORS_ALLOW_CREDENTIALS=true
```

`CORS_ALLOWED_ORIGINS`가 비어 있으면 CORS middleware를 등록하지 않는다.
값이 있으면 해당 origin에 대해서만 credential 요청을 허용한다.

### 이유

모든 origin 허용은 cookie 인증과 함께 쓰기 위험하다.
반대로 CORS 설정 지점이 아예 없으면 frontend 연결 시 app 구조를 다시 손봐야 한다.

따라서 지금은 구조만 준비하고, 실제 origin 값은 frontend 개발/배포 주소가 정해지는 시점에 결정한다.

### 코드 영향

`app/core/config.py`:

```text
cors_allowed_origins
cors_allow_credentials
```

`app/main.py`:

```text
register_middlewares()
CORSMiddleware
allow_headers = ["Content-Type", "X-CSRF-Token"]
```

## D-0025. Auth Audit Log 정책

### 문제

인증 기능은 보안 사고 조사, 운영 모니터링, brute force 탐지, 사용자 문의 대응을 위해 성공/실패 기록이 필요하다.

하지만 audit log에 민감 정보를 과하게 저장하면 로그 DB가 유출되었을 때 피해가 커진다.
특히 password, JWT, refresh token, refresh token hash, raw cookie, raw Authorization header는 절대 로그에 남기면 안 된다.

### 선택지

- audit log를 남기지 않는다.
- application log에 문자열로만 남긴다.
- DB에 구조화된 audit log를 남긴다.
- raw email, raw IP, raw User-Agent를 모두 저장한다.
- 원문 대신 hash를 저장한다.

### 결정

Auth MVP에서는 DB에 구조화된 audit log를 남긴다.

테이블:

```text
auth_audit_log
```

기록 대상:

```text
auth.signup
auth.login
auth.refresh
auth.logout
```

결과:

```text
success
failure
```

저장하는 값:

```text
event_type
result
user_id
email_hash
client_ip_hash
user_agent_hash
reason
created_at
```

저장하지 않는 값:

```text
plain password
password_hash
access token 원문
refresh token 원문
refresh token hash
csrf token
raw cookie
raw Authorization header
raw email
raw IP
raw User-Agent
```

`email_hash`, `client_ip_hash`, `user_agent_hash`는 `JWT_SECRET_KEY`를 key로 사용하는 HMAC-SHA256 결과로 저장한다.

### 이유

운영에서 필요한 것은 "같은 이메일로 실패가 반복되는가", "같은 IP 계열 요청이 반복되는가", "어떤 auth 이벤트가 실패했는가"를 추적하는 것이다.
이를 위해 원문 개인정보를 반드시 저장할 필요는 없다.

단순 SHA-256은 email/IP처럼 후보 범위가 작은 값에 대해 dictionary 공격이 가능하다.
따라서 secret key를 사용하는 HMAC-SHA256으로 hash한다.

Login 실패처럼 usecase transaction이 rollback되는 경우에도 audit log는 남아야 한다.
따라서 audit writer는 auth usecase의 Unit of Work와 분리된 별도 DB session을 사용한다.

### 코드 영향

모델:

```text
app/domains/audit/model.py
```

Writer:

```text
app/core/audit.py
```

Migration:

```text
20260418_0002_create_auth_audit_log.py
```

Endpoint는 auth 이벤트 성공/실패를 잡아 `AuthAuditLogger`로 기록한다.
Audit log는 HTTP response body에는 노출하지 않는다.
