---
paths:
  - "worship_support/api/infrastructure/hash/**/client.py"
  - "worship_support/api/infrastructure/token/**/client.py"
  - "worship_support/api/infrastructure/database/**/client.py"
  - "worship_support/api/config.py"
---

# 인프라 어댑터 패턴

외부 시스템 어댑터(`hash`/`token`/`database`)의 구조·싱글톤(`db_client`/`argon2`/`token`)·환경별 설정. `infrastructure/{adapter}/` + `config.py`에 산다.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · repo: [repository.md](repository.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **어댑터 구조** | 카테고리(`hash`/`token`/`database`) = `common/`(추상 ABC+예외) + 구현 폴더(`argon2`/`postgresql`…) |
| **싱글톤** | 모듈 수준 직접 인스턴스화. factory wrapper 금지(환경분기·lazy만 예외) |
| **섹션 마커** | `# client` 고정 — `client.py`의 싱글톤 인스턴스 블록(진입점) |
| **Config** | `ABC` + 환경별 서브클래스 + `get_*_config()` 팩토리, `api/config.py`에 위치 |
| **암호 경계** | 서버는 인증 해시(`hash`) + 토큰(`token`)뿐. 시크릿/키 암복호는 클라(E2EE) |

---

## 어댑터 구조 — category / common / 구현

외부 시스템 어댑터는 카테고리 폴더로 묶고, 그 안에서 추상과 구현을 가른다.

```
infrastructure/{adapter}/
  common/client.py      추상 ABC (구현 무지 계약)
  common/exception.py   어댑터-일반 typed 예외 ([exception.md](exception.md))
  {impl}/client.py      구체 구현 + 싱글톤 진입점
```

| 어댑터 | 추상(`common/`) | 구현 | 싱글톤 |
|--------|----------------|------|--------|
| `hash` | `Hash`(hash/verify) | `argon2`·`sha256` | `argon2`·`sha256` |
| `token` | `Token`(generate) | `secrets` | `token` |
| `database` | `Repository`·`Database`·session 경계 | `postgresql` | `db_client` |

- `common/`은 구현이 공유하는 추상 — ABC + 어댑터-일반 예외. 구현이 하나여도 seam으로 둔다. 계약이 깨끗하면 실제 메서드(`Hash`/`Token`/`Repository`), 명목 분류뿐이면 빈 마커(`Database`)
- 구현 폴더 = 알고리즘/dialect 이름(`argon2`/`sha256`/`secrets`/`postgresql`), 그 `client.py`가 진입점
- 싱글톤명 — 호출자가 구현을 고르면 구현명(`argon2`/`sha256`), 역할만 쓰면 역할명(`db_client`/`token`)
- `common/`은 구현을 import하지 않는다 — 추상이 구현을 알면 seam이 무의미. introspect(`map`/`schema`)는 어댑터가 아니라 설계-맵 툴링이라 이 틀 밖

---

## 싱글톤 — 모듈 수준 직접 인스턴스화

factory 함수 wrapper 금지 — 호출 시 `()` 깜빡 버그 제거.

```python
# infrastructure/database/postgresql/client.py
# #
# client
db_client = Postgres(get_postgres_config().database_url())

# infrastructure/hash/argon2/client.py
# #
# client
argon2 = Argon2()
```

```python
# 호출
from worship_support.api.infrastructure.database.postgresql.client import db_client
db_client.method(...)
```

- 섹션 마커는 `# client` 고정 — `client.py`의 싱글톤 인스턴스 블록(진입점)을 가리키는 구조 마커. 한 `client.py` = 싱글톤 하나
- factory 함수 wrapper 금지 — 예외: ① 환경별 인스턴스 선택(Config) ② lazy 초기화 비용 큰 인스턴스

```python
# bad: 불필요한 wrapper — 호출 시 () 빠뜨리면 AttributeError silent
_argon2 = Argon2(...)
def argon2() -> Argon2:
    return _argon2
```

> repository는 싱글톤이 아님 — classmethod 모음이라 인스턴스 없이 클래스 자체로 호출 (**[INV-6]**, [repository.md](repository.md)).

---

## Config 클래스

모듈 수준 상수 블록(`MAX_X = ...`) 대신 환경별 분기를 캡슐화.

- 위치: `worship_support/api/config.py` — config는 `infrastructure/` 하위가 아니라 api 루트(여러 infra 어댑터가 공유)
- `ABC` + `@property @abstractmethod` 인터페이스 (`PostgresConfig(ABC)`)
- 프로퍼티명 = 환경변수 키와 동일한 UPPER_CASE
- 환경별 서브클래스 (`DevelopPostgresConfig`/`ProductionPostgresConfig`)
- 모듈 수준 팩토리 (`get_postgres_config()`) — Develop/Production 분기라 factory 정당
- `Env`는 프로세스를 띄우는 모드뿐 — 띄우지 않는 환경은 선언하지 않는다(일부 팩토리만 분기하면 부팅 시 raw `NotImplementedError`). 테스트 자원은 환경이 아니라 분기 밖 독립 config + 팩토리(예: `get_test_postgres_config()`)

---

## 암호 경계 — 서버는 평문/키를 안 본다 (E2EE)

서버 암호는 **인증 해시 + 토큰**만 담당한다. 시크릿·팀키의 암복호는 전부 클라가 하고, 서버는 평문도 평문키도 어떤 시점에도 보유하지 않는다.

- 서버가 소유하는 것뿐: `hash/argon2`(password 단방향), `hash/sha256`(token fingerprint), `token`(불투명 토큰 발급) — 전부 도메인 무지(`value`만 받음)
- 시크릿 `value`는 **클라가 team_key로 암호화한 ciphertext(base64)** — 서버는 `Ciphertext.from_str(...)`로 받아 그대로 저장, 복호화 안 함
- 도메인은 blob을 단일 VO(`Ciphertext`)로 감쌀 뿐 — 내부 포맷(nonce/AEAD)은 클라 소유라 서버가 모름
- 서버측 DEK 캐시·복호화 경로는 없다 — E2EE라 서버가 lock/unlock할 평문키 자체가 없음

---

## 안티패턴

- factory 함수 wrapper로 (인프라) 싱글톤 노출 → 직접 모듈 변수 (환경 분기/lazy 비용일 때만 예외)
- 모듈 수준 상수 블록 → `config.py` ABC + 환경별 서브클래스 + 팩토리
- 서버에서 시크릿/키 복호화 시도 → 서버는 ciphertext 그대로 저장만(E2EE), 도메인은 blob VO(`Ciphertext`)로 감싸기만
