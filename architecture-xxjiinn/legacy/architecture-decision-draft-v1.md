# Architecture Decision Draft v1

> 작성일: 2026-04-11
> 목적: 회의 전 아키텍처 설계 기준과 담당 도메인 API 초안을 정리한다.
> 참고: 기존 architecture 문서 형식을 기준으로 하되, 현재 논의에서 수정된 방향을 반영한다.

---

## 1. 기술 스택

| 레이어            | 기술                                   | 비고                         |
| ----------------- | -------------------------------------- | ---------------------------- |
| 백엔드 프레임워크 | FastAPI (Python)                       | 비동기(async) 중심           |
| ORM               | SQLAlchemy async                       | asyncpg 드라이버             |
| DB                | PostgreSQL                             | Supabase 이전 방향은 폐기    |
| 인증              | JWT                                    | access token + refresh token |
| 비밀번호 해싱     | passlib bcrypt 또는 동등한 해싱 도구   | 구현 시 확정                 |
| 프론트엔드        | Flutter Web                            | 앱은 추후                    |
| 파일 저장         | S3 호환 스토리지 또는 Supabase Storage | 이미지/PDF, 추후 확정        |
| 외부 연동         | YouTube, Slack, Kakao 등               | 실제 범위는 회의 후 확정     |
| CI/CD             | GitHub Actions                         | CI 우선, CD는 단계적 도입    |

---

## 2. 기준 문서

우선 기준 문서:

```text
test/project.md
test/architecture.md
```

---

## 3. 시스템 아키텍처

### 전체 구성

```text
Flutter Web Client
  │
  │ HTTPS / JSON
  ▼
FastAPI Backend
  │
  ├── Auth / User / Admin / Project / Template / Block
  │
  ├── PostgreSQL
  │     ├── user
  │     ├── project
  │     ├── template
  │     ├── block
  │     ├── refresh_token
  │     └── audit_log
  │
  ├── File Storage
  │     └── image / pdf, 추후 확정
  │
  └── External APIs
        ├── YouTube Data API, 추후
        ├── Slack, 추후
        └── Kakao, 추후
```

### 아키텍처 다이어그램

```text
+--------------------+
| Flutter Web Client |
+--------------------+
          |
          | HTTPS / JSON
          v
+--------------------+
|   FastAPI Backend  |
+--------------------+
          |
          v
+--------------------+       +---------------------+
|      endpoint      | ----> |  exception handling |
+--------------------+       +---------------------+
          |
          v
+--------------------+
|      usecase       |  <-- transaction boundary
+--------------------+
          |
          v
+--------------------+       +---------------------+
|   domain / repo    | ----> |      audit_log      |
+--------------------+       +---------------------+
          |
          v
+--------------------+
|    PostgreSQL      |
+--------------------+
          |
          +-----------> File Storage, 추후
          |
          +-----------> External APIs, 추후
```

### 주요 데이터 흐름

```text
인증:
  auth endpoint
    -> auth usecase
    -> user / refresh_token 저장
    -> JWT 발급

프로젝트/템플릿 변경:
  endpoint
    -> get_current_user
    -> usecase transaction 시작
    -> repo를 통해 project/template 변경
    -> 사용자 의미가 있는 주요 행위만 audit_log 기록
    -> commit

외부 연동:
  endpoint
    -> usecase
    -> 외부 API 호출
    -> 실패 시 graceful error
    -> 사용자가 선택한 결과만 DB에 저장
```

### 아키텍처 원칙

```text
HTTP 처리는 endpoint에서 담당한다.
비즈니스 흐름과 트랜잭션 경계는 usecase에서 담당한다.
repo는 DB 조회/저장만 담당하고 commit/rollback은 직접 하지 않는다.
하위 레이어는 HTTP 응답을 직접 만들지 않고 애플리케이션 예외를 던진다.
초기에는 render/export/publish 같은 후속 기능을 과하게 확정하지 않는다.
```

---

## 4. 디렉토리 구조 & 레이어

초기 요청 흐름은 아래를 기준으로 한다.

```text
endpoint -> usecase -> domain/repo -> database
```

권장 구조:

```text
backend/
└── app/
    ├── main.py
    ├── core/
    │   ├── config.py
    │   ├── database.py
    │   ├── deps.py
    │   └── security.py
    └── domains/
        ├── auth/
        │   ├── endpoint.py
        │   ├── schema.py
        │   ├── usecase.py
        │   ├── repo.py
        │   └── model.py
        ├── user/
        ├── admin/
        ├── project/
        ├── template/
        └── block/
```

레이어 책임:

| 레이어   | 책임                                            |
| -------- | ----------------------------------------------- |
| endpoint | HTTP 요청/응답, 인증 의존성, 예외 응답 변환     |
| usecase  | 비즈니스 흐름 조립, 트랜잭션 경계 관리          |
| domain   | entity, value object, 도메인 규칙               |
| repo     | DB 조회/저장                                    |
| database | PostgreSQL, SQLAlchemy model, Alembic migration |

초기에는 각 도메인의 API 요청/응답 코드를 `endpoint.py` 하나에서 시작한다. 파일이 비대해지면 기능별 endpoint 파일로 분리한다.

---

## 5. 요청 흐름

```text
Flutter Client
  │
  ▼
FastAPI
  │
  ├── 공개 경로
  │   └── /auth/signup, /auth/login, /auth/refresh, /shared/*
  │
  └── 보호 경로
      │
      ├── get_current_user
      │   └── JWT 검증 -> User 조회 -> status 확인
      │
      ├── get_current_admin
      │   └── get_current_user + is_admin 확인
      │
      └── endpoint -> usecase -> repo -> database
                              └── audit_log 기록(write 작업)
```

가드 종류:

| 가드                | 조건                                 |
| ------------------- | ------------------------------------ |
| 공개 경로           | 인증 없음                            |
| `get_current_user`  | JWT 유효 + `status=active`           |
| `get_current_admin` | `get_current_user` + `is_admin=true` |

---

## 6. 도메인 구조

### 도메인 책임

| 도메인   | 책임                                   | 담당      |
| -------- | -------------------------------------- | --------- |
| auth     | 회원가입, 로그인, 토큰 갱신, 로그아웃  | 성진      |
| user     | 내 계정 정보 조회/수정                 | 성진      |
| admin    | 사용자 관리, 운영 통계, audit log 조회 | 성진      |
| project  | 프로젝트 CRUD                          | 성진      |
| template | 템플릿 CRUD                            | 성진      |
| block    | 블록 CRUD, 구성, 버전 관리 후보        | 건희·성민 |

### 도메인 관계

```text
User
  ├── Project (created_by)
  └── AuditLog (actor_id)

Project
  ├── Template (1:N)
  └── Block (1:N)

Template
  └── layout/render 정보는 초기에는 독립 도메인으로 분리하지 않음

Block
  ├── txt
  ├── image
  ├── datetime
  ├── song
  ├── song_list
  └── advertisement
```

`Render`는 현재 기준에서 독립 핵심 도메인으로 보지 않는다. 초기에는 별도 API나 테이블을 만들지 않고, `Template`이 화면이나 산출물로 표현될 때 필요한 배치/표현 개념으로만 둔다.

---

## 7. 인증 & 세션

### 인증 플로우

| 기능      | 경로                 | 설명                               |
| --------- | -------------------- | ---------------------------------- |
| 회원가입  | `POST /auth/signup`  | 계정 생성, 초기 `status=active`    |
| 로그인    | `POST /auth/login`   | active 사용자만 토큰 발급          |
| 토큰 갱신 | `POST /auth/refresh` | refresh token 검증 후 새 토큰 발급 |
| 로그아웃  | `POST /auth/logout`  | refresh token revoke               |

### 사용자 상태

| 상태          | 의미                             | 로그인 |
| ------------- | -------------------------------- | ------ |
| `active`      | 정상 사용 가능                   | 가능   |
| `blocked`     | 관리자가 차단                    | 불가   |
| `deactivated` | 비활성화 또는 탈퇴에 준하는 상태 | 불가   |

초기 버전에서는 별도의 관리자 사전 승인 플로우를 두지 않는다. 회원가입 후 바로 `active` 상태로 두고, 관리자는 이후 사용자 상태를 변경할 수 있다.

단, 교회/팀 내부 전용 서비스라면 URL을 아는 외부인이 가입할 수 있는 위험이 있다. 초기에는 private deploy 또는 간단한 invite code 방식으로 가입 경로를 보호할지 회의에서 확인한다.

### 권한 단계

초기 버전에서는 일반 사용자와 관리자만 둔다.

```text
user  : 일반 서비스 기능 사용
admin : 사용자 관리, 운영 통계 조회, audit log 조회
```

구현은 우선 `is_admin boolean`을 사용한다. `owner`, `manager`, `viewer` 같은 다단계 권한은 필요해지면 `role enum` 또는 별도 role table로 확장한다.

### Refresh Token

refresh token은 서버 DB에 저장하고, logout 또는 refresh 시 폐기/교체할 수 있게 한다.

보안 기준:

```text
refresh token 원문은 DB에 저장하지 않는다.
token hash 또는 jti를 저장한다.
```

테이블 개념:

```sql
CREATE TABLE refresh_token (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES "user"(id),
  token_hash TEXT,
  jti        TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

OAuth 소셜 로그인은 초기 구현 범위에는 넣지 않는다. 추후 Google, Kakao, Apple 등을 검토할 수 있도록 user와 auth identity 개념을 분리할 여지를 둔다.

---

## 8. DB 스키마 기준

### 공통 컬럼

```sql
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
deleted_at  TIMESTAMPTZ
```

시간 컬럼은 `TIMESTAMPTZ`를 사용하고, DB 저장 기준은 UTC로 통일한다. 사용자에게 표시할 때만 필요한 시간대로 변환한다.

soft delete 대상에는 `deleted_at`을 둔다. 누가 삭제했는지는 `audit_log`의 `actor_id`, `action`, `entity_type`, `entity_id` 조합을 기준으로 조회한다.

### 핵심 테이블 개념

```sql
CREATE TABLE "user" (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES "user"(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE project (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES "user"(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE template (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES project(id),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  layout      JSONB,
  created_by  UUID REFERENCES "user"(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

`template.layout`은 확정된 필드가 아니라 후보이다. 초기에는 비워둘 수 있고, 편집기 요구사항이 정리되면 JSONB 또는 별도 테이블 중 하나로 확정한다.

### 삭제 정책

| 대상              | 정책                               |
| ----------------- | ---------------------------------- |
| user              | hard delete보다 `status` 변경 우선 |
| project           | soft delete                        |
| template          | soft delete                        |
| block             | soft delete                        |
| block version row | 도입 시 삭제하지 않음              |
| audit_log         | 수정/삭제하지 않음                 |

기본 조회에서는 `deleted_at IS NULL` 조건을 적용한다.

순서가 있는 구성 테이블이 필요해질 경우 `UNIQUE(parent_id, sequence)`를 기본으로 두지 않는다. 재정렬 시 unique 제약 충돌이 발생할 수 있으므로, 초기에는 `sort_order` 기반 정렬과 usecase 단위 트랜잭션으로 처리하고, 강한 DB 제약이 필요할 때만 deferrable unique constraint 또는 전체 재삽입 방식을 검토한다.

---

## 9. API 컨벤션

### 응답 형식

```json
{
  "data": {}
}
```

에러:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found."
  }
}
```

### HTTP 상태 코드

| 코드 | 용도           |
| ---- | -------------- |
| 200  | 조회/수정 성공 |
| 201  | 생성 성공      |
| 204  | 삭제 성공      |
| 400  | 검증 실패      |
| 401  | 미인증         |
| 403  | 권한 없음      |
| 404  | 리소스 없음    |
| 409  | 충돌           |

### 목록 조회

```text
GET /projects?limit=50&offset=0&q=검색어&include_deleted=false
```

응답 필드는 우선 `snake_case`를 사용한다.

---

## 10. 담당 도메인 API

담당 도메인 API 경로와 주요 request/response 예시는 별도 문서에서 관리한다.

```text
v1/api-design-draft-v1.md
```

---

## 11. 핵심 패턴

### Soft Delete

```python
# 삭제
obj.deleted_at = now_utc()
# 복구
obj.deleted_at = None

# 기본 조회 필터
.filter(Model.deleted_at.is_(None))
```

삭제 주체는 `audit_log`에서 조회한다.

### Block 버전 관리

Block 버전 관리는 회의에서 실제 필요를 확인한 뒤 확정한다. 이전 버전으로 되돌리는 사용 사례가 명확하지 않다면 초기 구현에서는 full version history를 보류한다.

```text
full version history 도입 시 저장 흐름:
  1. block_<type> 테이블에 새 row INSERT
  2. block.current_version_id = 새 row id UPDATE
  3. audit_log 기록
  4. commit

되돌리기:
  1. block.current_version_id = 과거 version id UPDATE
  2. audit_log 기록
  3. commit
```

도입할 경우 버전 row는 원칙적으로 삭제하지 않는다.

### 감사 로그

사용자 의미가 있는 주요 변경 작업마다 1건 기록한다. 단순한 내부 DB write를 모두 audit log로 남기지는 않는다.

```python
# action 네이밍 규칙: <domain>.<action>
"auth.signup"
"auth.login"
"admin.user.status_update"
"admin.user.role_update"
"project.create"
"project.update"
"project.soft_delete"
"template.create"
"template.update"
"template.soft_delete"
"block.version_create"
"export.pdf"
"publish.weblink"
```

비밀번호, JWT, refresh token, 원본 인증 헤더 등 민감정보는 어떤 로그에도 남기지 않는다.

### 트랜잭션 경계

```text
기본 원칙:
  usecase 단위 1트랜잭션

commit/rollback 책임:
  usecase 또는 usecase를 감싸는 transaction manager

repo 책임:
  DB 조회/저장
  commit/rollback 직접 호출하지 않음
```

예시:

```text
블록 버전 생성
  1. block 조회
  2. 권한 확인
  3. block_<type> 버전 row 생성
  4. block.current_version_id 갱신
  5. audit_log 기록
  6. commit

중간 실패 시 전체 rollback
```

### Domain Event

초기 버전에서는 별도의 message queue나 복잡한 event bus를 도입하지 않는다.

핵심 DB 변경은 `usecase` 안에서 동기적으로 처리한다. 아래 작업은 추후 event 처리 후보로 둔다.

```text
PDF 생성
export/publish 후 알림
Slack/Kakao 전송
외부 API 연동
```

핵심 쓰기 작업은 "응답 먼저, DB 반영은 나중 이벤트 처리" 방식으로 구현하지 않는다.

### 외부 API 연동

YouTube 검색 같은 외부 API는 초기에는 단순 연동으로 시작할 수 있다. 다만 quota 초과나 외부 API 장애가 전체 핵심 DB 작업을 망치지 않도록 실패 응답과 재시도/캐싱 후보를 문서화한다.

```text
초기:
  YouTube 검색 실패 시 명확한 에러 응답
  검색 결과 저장은 사용자가 선택한 값 중심으로 최소화

추후:
  검색 결과 캐싱
  quota 초과 시 fallback 메시지
  인기 검색어 또는 최근 검색 결과 재사용
```

---

## 12. 테스트 정책

핵심 비즈니스 흐름과 DB 정합성은 실제 테스트 DB 기준으로 검증한다.

```text
운영/개발 DB와 분리된 테스트 DB 사용
테스트 실행 전 migration 적용
각 테스트에서 필요한 데이터 직접 준비
테스트 종료 후 transaction rollback 또는 truncate로 정리
강한 격리가 필요한 경우에만 임시 DB 생성 후 삭제
```

mock으로 대체하지 않을 대상:

```text
soft delete
unique 제약
foreign key
audit log
transaction rollback
```

외부 API, 파일 저장소, PDF 변환 등 외부 시스템 연동은 필요 시 테스트 대역을 사용할 수 있다.

---

## 13. CI/CD 정책

GitHub Actions를 기준으로 구성한다.

```text
PR/main push
  -> PostgreSQL service container 시작
  -> dependency 설치
  -> Alembic migration 적용
  -> lint
  -> format check
  -> test
```

CD는 초기에는 수동 배포 또는 제한적 자동화로 시작한다. staging 환경이 준비되면 staging 자동 배포와 운영 배포 승인 절차를 단계적으로 도입한다.

---

## 14. 관리자 대시보드

초기 관리자 대시보드는 서비스 운영 상태 확인과 사용자 관리를 중심으로 구성한다.

초기 범위:

```text
사용자 관리
운영 통계
audit log 조회
프로젝트/템플릿 현황 조회
```

초기 제외 범위:

```text
프로젝트 상세 편집
템플릿 상세 편집
블록 내용 직접 수정
고급 통계 차트
관리자 등급별 권한 세분화
시스템 설정 관리
외부 연동 설정 관리
```

---

## 15. 이후 회의에서 구체화할 항목

```text
block 도메인 상세 API
export/publish API
template type 최종 목록
프론트엔드 편집기에서 layout을 저장해야 하는 범위
프로젝트 협업 기능 도입 시점
외부 연동 범위
배포 대상 인프라
block version history 필요 여부
순서 재정렬 방식
```
