# DB와 Migration

이 문서는 PostgreSQL, SQLAlchemy, Alembic 관련 결정을 정리한다.

## 개발 환경 결정

패키지 관리는 `uv`를 사용한다.

PostgreSQL은 로컬 설치가 아니라 Docker Compose로 실행한다.

구현 위치는 아래로 정한다.

```text
sj-draft/backend
```

로컬 DB와 테스트 DB는 분리한다.

```text
local database:
  worship_support_auth

test database:
  worship_support_auth_test
```

## 초기 테이블

MVP 테이블:

```text
users
refresh_token
auth_audit_log
```

후반부 확장 테이블:

```text
rate_limit
```

## Auth MVP 스키마

### `users`

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

### `refresh_token`

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

### `auth_audit_log`

```text
id UUID PK
event_type TEXT NOT NULL
result TEXT NOT NULL
user_id UUID NULL FK -> users.id ON DELETE SET NULL
email_hash TEXT NULL
client_ip_hash TEXT NULL
user_agent_hash TEXT NULL
reason TEXT NULL
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

Audit log에는 password, token, raw cookie, raw email, raw IP, raw User-Agent를 저장하지 않는다.

## 스키마 결정

### ID

`users.id`, `refresh_token.id`, `auth_audit_log.id`는 UUID를 사용한다.

### User table 이름

v1 문서에서는 `"user"`를 사용했지만, 이번 구현에서는 실무 편의상 `users`를 사용한다.

이유:

- `user`는 SQL 키워드와 충돌 가능성이 있다.
- SQL에서 quote가 필요해질 수 있다.
- `users`가 ORM과 SQL 작성 시 더 편하다.

### Email

`email`은 unique not null로 둔다.

Application에서 중복 확인을 하더라도 DB unique 제약을 둔다.
동시 signup 요청에서 마지막 정합성 방어선은 DB 제약이다.

### Status

`status`는 `TEXT + CHECK 제약`으로 둔다.

허용 값:

```text
active
blocked
deactivated
```

Domain layer에서도 `UserStatus`로 검증한다.

### Refresh token hash

`refresh_token.token_hash`는 unique not null로 둔다.

Refresh 요청 시 cookie에서 받은 refresh token 원문을 SHA-256 hash로 바꾼 뒤 `token_hash`로 row를 찾는다.

### Timestamp

시간 컬럼은 `TIMESTAMPTZ`를 사용한다.

DB 저장 기준은 UTC로 통일한다.

## 아직 정하지 않은 것

- audit log 보관 기간
- audit log archive/delete batch 전략

## SQLAlchemy model과 domain entity

SQLAlchemy model과 domain entity는 분리한다.

SQLAlchemy model은 DB table mapping을 담당한다.

Domain entity는 비즈니스 의미와 규칙을 담당한다.

Repository가 두 모델 사이를 변환한다.

## Repository와 Unit of Work

Repository는 DB 조회/저장만 담당한다.

Unit of Work는 SQLAlchemy session 생명주기와 transaction 경계를 담당한다.

초기 repository:

```text
SqlAlchemyUserRepository
SqlAlchemyRefreshTokenRepository
```

초기 Unit of Work:

```text
SqlAlchemyUnitOfWork
```

Spring의 `@Transactional`에 해당하는 책임은 repository가 아니라 Unit of Work/usecase 경계에 둔다.

## Alembic workflow

초기 migration은 직접 작성한다.

대상:

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

이후 schema 변경부터는 필요하면 Alembic autogenerate를 학습하고 사용할 수 있다.

## 초기 Migration 적용 기록

초기 migration:

```text
20260418_0001_create_auth_tables.py
```

실행:

```text
uv run alembic upgrade head
```

결과:

```text
성공
```

생성된 테이블:

```text
alembic_version
users
refresh_token
auth_audit_log
```

현재 Alembic version:

```text
20260418_0002
```

확인된 주요 제약:

```text
users.email unique
users.status check active/blocked/deactivated
refresh_token.user_id -> users.id foreign key
refresh_token.token_hash unique
auth_audit_log.user_id -> users.id foreign key on delete set null
```

## Audit Log Migration 적용 기록

Audit log migration:

```text
20260418_0002_create_auth_audit_log.py
```

실행:

```text
uv run alembic upgrade head
```

결과:

```text
성공
```

## UUID 생성 위치

SQLAlchemy model에는 `default=uuid.uuid4`를 둔다.

즉 ORM을 통해 row를 생성할 때 application이 UUID를 만든다.

초기 migration에는 DB `gen_random_uuid()` default를 두지 않았다.

따라서 raw SQL로 직접 insert할 때는 `id`를 명시해야 한다.

이 튜토리얼에서는 repository/ORM을 통한 생성을 기준으로 하므로 application-generated UUID를 사용한다.

나중에 DB default UUID가 필요하다고 판단되면 `pgcrypto` extension과 `gen_random_uuid()` default를 추가하는 migration을 만들 수 있다.
