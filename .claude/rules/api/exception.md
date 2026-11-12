---
paths:
  - "worship_support/api/**/*exception.py"
---

# 예외 패턴

전 레이어 예외의 단일 권위 — 루트(`core/exception.py`) + 레이어별 `common/exception.py` + dialect typed 예외 + 핸들러. 모든 예외는 `ClientError`(4xx)/`DevelopError`(5xx)로 귀결한다 — **[INV-4]**.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · 핸들러 등록: [server.md](server.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 구조 | `core/exception.py` 루트(2분류) → 레이어 `common/exception.py` 구체 예외 — [INV-4] |
| 메시지 규약 | 구체 예외는 catalog `key`+`params`, base가 `core/i18n.py`로 렌더 + head·범주·위치 자동 조립 |
| 다국어 | catalog 단일 출처(`core/i18n.py`), 생성은 `DEFAULT`(ko), 응답은 `Accept-Language` 재렌더 |
| 4xx vs 5xx | `ClientError` 사용자 노출·정중체 / `DevelopError` prod 마스킹·terse 진단 |
| 핸들러 | `client()`(4xx) + `internal()`(catch-all 5xx) 2개로 완결, MRO 자동 분기 |

---

## 구조 — [INV-4]

> 온톨로지 · taxonomy: 상위 범주가 처리를 결정 — ClientError(클라 책임)/DevelopError(서버 책임)라는 "누구 책임"이 핸들러 분기(MRO)를 만든다.

예외는 레이어별 `common/exception.py`에 모으고, 모두 `ClientError`/`DevelopError`를 (직·간접) 상속한다.

```
core/exception.py                          ← 루트 전용, 직접 raise 안 함
  ApplicationError(Exception)        msg·code + __trace_back__
  ├─ ClientError                     4xx · 클라이언트 책임
  └─ DevelopError                    5xx · 서버 책임

domain/common/exception.py
  DomainClientError(CoreClientError)       레이어 베이스 (domain은 4xx만)
  ├─ InvalidError / InvalidFormatError   400
  ├─ NotFoundError                       404
  └─ AlreadyExistsError                  409

infrastructure/common/exception.py
  InfrastructureDevelopError(CoreDevelopError) 레이어 베이스 (5xx)
  InfrastructureClientError(CoreClientError)   레이어 베이스 (4xx) — 구체 예외는 어댑터 옆(아래)

infrastructure/database/common/exception.py     (어댑터-일반 typed 예외)
  DatabaseError(InfrastructureDevelopError)        500 · transactional_session 경계(SQLAlchemy)
  ListenError(InfrastructureDevelopError)          500 · asyncpg LISTEN 연결/구독 경계
  UniqueViolationError(InfrastructureClientError)  409 · _ensure_unique 사전검사
infrastructure/hash/common/exception.py  (어댑터 고유 typed 예외)
  HashError(InfrastructureDevelopError)    어댑터 베이스 (5xx)
  ├─ VerifyError                         500 · argon2 Argon2Error wrapping
  └─ UnsupportedError                    500 · 알고리즘 미지원(sha256 verify)
infrastructure/notification/common/exception.py
  NotificationError(InfrastructureDevelopError)              500 · SMTP permanent (SMTPRecipientsRefused 등)
  NotificationTransientError(NotificationError)              500 · SMTP transient — retryable = True ([retry.md](retry.md))
```

### 원칙

- 레이어 공통 예외(베이스·여러 어댑터 공유)는 `common/exception.py`에. 어댑터 고유 typed 예외는 그 어댑터 `common/`에(`database/common/exception.py`의 `DatabaseError`/`UniqueViolationError`, `hash/common/exception.py`의 `HashError`). 진짜 dialect/구현 고유 typed 예외만 그 구현 옆에
- `core/exception.py`는 루트 전용 — `ApplicationError` + `ClientError`/`DevelopError`만. 구체 예외(`message`/`code` 보유) 금지
- 레이어가 내는 각 HTTP 카테고리마다 레이어 베이스 — 베이스명 `{Layer}{Category}Error`. domain은 4xx만이라 `DomainClientError` 하나, infra는 `InfrastructureClientError`(4xx, 구체는 `UniqueViolationError` 409 — database/common) + `InfrastructureDevelopError`(500) 둘. 모든 구체 예외는 레이어 베이스 경유 — 직접 `ClientError`/`DevelopError` 상속 우회 없음
- 미처리 예외는 `internal()` catch-all — 단 raw 오류는 경계(어댑터)에서 typed 변환. 외부 lib 예외를 그 어댑터 typed로(`SQLAlchemyError → DatabaseError`, `Argon2Error → VerifyError`, `SMTPException/OSError → NotificationError`, asyncpg `PostgresError/OSError → ListenError`). 외부 시스템(DB·hash·SMTP·asyncpg LISTEN)을 만지는 어댑터는 전부 typed 경계를 갖는다 — raw 전파 0
- 재시도 가능성은 예외의 `retryable`이 선언한다 — base `ApplicationError.retryable = False`, transient 변형만 `True`(`NotificationTransientError`), raise 자리 덮어쓰기는 `retryable=` 인자([retry.md](retry.md)). 어느 raw 오류가 transient인지 판정은 어댑터 몫, permanent는 base typed 그대로
- 구체 예외만 `message`/`code` 채움 — 베이스(`...`)는 분류용 마디
- core 내부 가드(`by_factory`/`typecheck`)는 새 예외 없이 `DevelopError`를 직접 raise — 구체 예외는 레이어 `common`에만

---

## 메시지 규약 — key/params + head + message + path 3단

구체 예외는 catalog `key` + 치환 `params`만 넘긴다. base(`ApplicationError.__init__`)가 `core/i18n.py`로 메시지를 렌더하고 head·범주·위치를 자동 조립:

```python
# good: 구체 예외는 catalog key + params (메시지 문자열 직접 작성 안 함)
super().__init__(key="not_found", params={"target": "Secret", "identifier": id}, code=404)
```

```
{ErrorName} - {category} ({code})
	 message: {rendered}
	 path: {repo-relative-path}:{line}
```

- head: `type(self).__name__` + `_category()`(`ClientError`/`DevelopError`) + `code`. (core 가드처럼 `DevelopError` 직접 raise하면 `DevelopError - DevelopError (500)` — 의도된 표기)
- `message`: catalog `_CATALOG[key][locale].format(**params)` 한 줄. 형식 `{주어} {서술} (라벨: 값[, ...])` — 디테일은 전부 괄호 + 한국어 `라벨: 값` 쌍. 표준 라벨: `식별자`/`원인`/`실제`/`작업`/`조치`/`허용`
- `path` (`_origin`): 스택에서 `exception.py` 프레임 스킵하고 처음 만나는 호출자 프레임 → 실제 raise한 도메인/usecase 위치
- 예외: core 가드(`by_factory`/`typecheck`)는 catalog 없이 `message=` 직접(1회성 진단 문자열, `DevelopError` 직접 raise) — 레이어 구체 예외만 catalog 경유

### 다국어 — catalog 단일 출처 + 요청 locale 재렌더

메시지 카탈로그는 `core/i18n.py` 단일 출처. `key`마다 locale별(`ko`/`en`) 템플릿, `DEFAULT=ko`. 같은 `key`/`params`를 두 시점에 다른 locale로 렌더한다:

- 생성 시점 → `DEFAULT`(ko) 렌더. 내부용(`self.msg`/로그/dev traceback)은 항상 ko(진단 일관)
- 응답 시점 → `client()`(4xx) 핸들러가 `Accept-Language`로 locale 판정 후 같은 `key`/`params` 재렌더. 사용자 응답만 요청 언어. (5xx는 `internal()`이 prod 마스킹이라 locale 무관 — EN 항목은 4xx 사용자 노출용)
- 새 구체 예외 = catalog에 `key` 추가 동반. 없는 key는 `render`가 `KeyError` — 빈 key 금지
- `params` 키 = 템플릿 빈칸(`{target}` 등)과 정확히 같은 집합, ko·en 모두. 어긋나면 예외 생성 중 `KeyError`라 4xx가 500이 된다. `params`는 dict 리터럴로(`check_code_rules.py` hook이 검사)

### 4xx vs 5xx 스타일

| 분류 | 노출 | 문체 | 내용 |
|------|------|------|------|
| `ClientError` (4xx) | prod에서도 사용자 노출 | 정중 평서체 `~습니다`, 힌트 `(조치: unlock)` | 어휘 통일 — 타입 `타입이 올바르지 않습니다`, 형식 `형식이 올바르지 않습니다`, 미존재 `찾을 수 없습니다 (식별자: X)`, 중복 `이미 존재합니다 (식별자: X)` |
| `DevelopError` (5xx) | prod 마스킹(`error_id`만), dev/로그만 | terse 진단(정중체·마침표 없음) | 실제 타입/값/operation/reason OK — `{param} {expected} 필요 (실제: {actual})`, `DB 실패 (작업: {op}, 원인: {reason})` |

```
# ClientError (4xx) — 사용자 노출, 정중체
NotFoundError - ClientError (404)
	 message: Secret 찾을 수 없습니다 (식별자: github-token)
	 path: worship_support/api/domain/secret/secret_repository.py:128

# DevelopError (5xx) — prod 마스킹, dev/로그, terse
DevelopError - DevelopError (500)
	 message: kind <class 'Kind'> 필요 (실제: str)
	 path: worship_support/api/core/validate.py:24
```

---

## 핸들러 — 2개로 4xx/5xx 완결

핸들러 *팩토리*는 `server/exception.py`, *등록*은 `bin/server.py`([server.md](server.md)). Starlette가 `type(exc).__mro__`로 가장 구체적인 핸들러 선택.

- `client()` → `ClientError` 등록. `exc.code`(400~423) 그대로 응답, dev에서만 traceback 첨부
- `internal()` → `Exception` 등록(catch-all). `ClientError` 외 모든 예외(`DevelopError`·raw DB 오류·`RuntimeError`)를 500으로. 항상 로그(`error_id` + traceback), dev에서만 상세 노출, 그 외 마스킹 + `error_id`만

---

## 안티패턴

- 레이어 공통 예외(베이스·공유)를 어댑터에 흩뿌림 → `common/exception.py`에 집약. 어댑터 고유 typed 예외는 그 어댑터 `common/`에(`database/common/exception.py`·`hash/common/exception.py`)
- `core/exception.py`에 구체 예외 추가 → 루트엔 `ApplicationError` + 2분류만
- 구체 예외가 `ClientError`/`DevelopError`를 직접 상속 → 레이어 베이스(`{Layer}{Category}Error`) 경유
- raw DB/어댑터 오류를 그대로 전파 → 경계에서 typed 변환(`DatabaseError`/`NotificationError`/`ListenError`/`HashError`)
- 레이어 구체 예외가 `message=` 문자열 직접 작성 → catalog `key`+`params`(core 가드만 `message=` 예외)
- catalog 키를 응답 핸들러·예외 클래스에 분산 → `core/i18n.py` 단일 출처
- 예외 핸들러를 카테고리별 N개 등록 → `client()`/`internal()` 2개로 충분(MRO 분기)
