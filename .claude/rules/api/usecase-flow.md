---
paths:
  - "worship_support/api/usecase/*.py"
  - "worship_support/api/core/usecase.py"
---

# UseCase 흐름 패턴

비즈니스 흐름 — deps + input → output. transaction 경계를 책임진다. `usecase/{aggregate}_{action}.py`에 산다(폴더 없이 평탄, 한 파일 = 한 동작).

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · repo: [repository.md](repository.md) · 이벤트 조정: [domain-event.md](domain-event.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 파일 구조 | `Input`(`In` 상속) + `Output`(`Out` 상속) + `@typecheck async def {action}(*, session, input) -> Output` + `# cli` |
| 시그니처 | `(*, session, input[, context]) -> Output`. 테넌트·actor context는 behavior가 주입(Input 밖), repo는 클래스로([INV-6]) |
| 본문 라벨 | `# find → # {동작} → # persist → # return` 흐름 단계 마커 |
| Session = Transaction | 같은 session을 모든 repo 호출에 주입 = atomic. usecase 1개 = 1 트랜잭션 — [INV-5] |
| 응답 | `Output(data, event)` 반환, endpoint가 `to_dict()` — [INV-8] |

---

## 파일 구조 — Input + 함수 + CLI

```python
from __future__ import annotations
import argparse, asyncio
from worship_support.api.core.usecase import In as CoreIn
from worship_support.api.core.usecase import Out as CoreOut
from worship_support.api.core.validate import typecheck
from worship_support.api.infrastructure.database.postgresql.client import db_client
from worship_support.api.infrastructure.database.common.session import transactional_session

# #
# input
class Input(CoreIn):
    password: str

# #
# output
class Output(CoreOut):
    pass

# #
# usecase
@typecheck
async def unlock(*, session, input: Input) -> Output:
    ...

# #
# cli
def _parse_args():
    return argparse.ArgumentParser().parse_args()
async def _main():
    args = _parse_args()
    async with transactional_session(db_client.SessionLocal) as session:
        print(
            await unlock(
                session=session,
                input=Input(password=args.password),
            )
        )
if __name__ == "__main__":
    asyncio.run(_main())
```

### Input / Output 모델 — `In`/`Out` 상속

core(`core/usecase.py`)에 추상 `In`(pydantic `BaseModel` marker)·`Out`(`new`/`to_dict` 보유 dataclass). 각 usecase는 둘을 상속한 `Input`/`Output`을 자기 파일에 둔다 — `# input`/`# output` 섹션.

- `class Input(CoreIn)` — boundary 입력 스키마. 도메인 VO와 달리 `by_factory` 가드 없음. 필드 없어도 항상 정의(`class Input(CoreIn): pass`), 호출 시그니처 일관(`input=Input()`)
- `class Output(CoreOut): pass` — 빈 상속. `Output(data=..., event=...)`로 직접 생성(frozen dataclass), `to_dict()`는 `CoreOut`에서 상속. 반환 어노테이션 `-> Output`은 로컬 타입
- 클래스명 `Input`/`Output` 고정 — 파일명(`{aggregate}_{action}`)이 컨텍스트 제공
- bulk 입력은 sub-model 남발 말 것 — 항목이 (키, 값) 쌍이면 `dict[str, str]` 맵으로 평탄화(예: `team_rotate`의 `secrets`/`members`)

### 함수 시그니처

```python
@typecheck
async def {action}(*, session, input: Input, ...context) -> Output:
```

- `@typecheck` 필수, kwarg-only(`*`)
- `session`(트랜잭션 경계) + `input`(boundary 스키마)이 뼈대 — repo는 클래스로([repository.md](repository.md), [INV-6]), 인프라 싱글톤(`argon2`/`token` 등)은 모듈 import로 직접
- 횡단 신원(테넌트·actor)은 별도 context kwarg — Input에 넣지 않고 endpoint가 behavior splitter의 `context`(Scope)에서 꺼내 주입한다([behavior.md](behavior.md)). 명사(신원)라 boundary 스키마가 아니다. 인증 없는 경로(CLI 등)에선 actor가 없을 수 있어 optional
- sync/async는 IO 유무 — 순수 in-memory면 sync 가능(DB 조회·저장 있으면 async)

```python
# good: 테넌트(team_id)·actor(account_id)는 context kwarg — Input 밖
async def reveal(*, session, input: Input, team_id: UUID, account_id: UUID | None = None) -> Output:
```

### action 네이밍 — 동사

> 온톨로지 · noun/verb: usecase는 행위(동사)라 action 이름도 동사 — 명사(반환 대상)로 지으면 행위라는 종류가 흐려진다.

`{action}`은 동사다(`create`/`update`/`delete`/`remove`/`reveal`/`get`/`search`/`rotate`…). 명사(반환 대상)로 짓지 않는다 — `account_public_key`(명사) → `account_get_only_public_key`().

- aggregate 전체 조회: 평범한 동사 — `setting_get`(`get`), `secret_reveal`(`reveal`)
- read-many(컬렉션 조회)는 `search`로 통일 — 필터 유무 무관(`secret_search`는 필터 조회, `setting_search`는 전체). bare `list`/`set`은 파이썬 빌트인을 가려(함수명 shadowing) 쓰지 않는다 — 같은 결로 upsert는 `put`
- 같은 "제거"라도 대상이 동사를 가른다: `delete` = 엔티티 영구 삭제(`secret_delete`), `remove` = 접근/멤버십 회수(`team_remove` — team_access 행). 엔티티냐 관계/접근이냐가 동사로 드러나므로 둘을 섞지 않는다
- 특정 필드/projection 하나만 반환하는 조회: `{aggregate}_get_only_{field}` — `account_get_only_public_key`(`get_only_public_key`), `auth_get_only_salts`(`get_only_salts`). 무엇을 돌려주는지 `field`가 드러내되 동작은 `get_only_` 동사가 받는다

#### prefix `{aggregate}` = 라우트 그룹, 만지는 엔티티 아님

prefix는 엔드포인트/라우트 묶음을 따른다(만지는 엔티티가 아니라). 한 엔드포인트 그룹의 동작들은 내부에서 다른 aggregate를 건드려도 같은 prefix를 쓴다 — 그래야 파일이 라우트 단위로 모인다.

- `team_invite`/`team_remove`/`team_get_only_key`는 전부 TeamAccess 엔티티를 만지고 TeamAccessEvent를 발생시키지만 `/teams/...` 라우트라 prefix는 `team_`
- `membership_get_only_key`(엔티티를 따라감 → invite/remove와 어긋남) → `team_get_only_key`(라우트 그룹)

#### `{field}`는 개념적 projection 이름 — 리터럴 반환 키 아님

`get_only_{field}`의 `field`는 "무엇을 돌려주는지"의 개념명이지 반환 dict의 리터럴 키가 아니다. 반환 모양이 바뀌어도 개념명은 유지.

- `account_get_only_public_key` → 실제 반환은 `{account_id, personal_lock}`("public_key"는 개념)
- `auth_get_only_salts` → `{personal_unlock_salt, login_salt}`(묶음 개념, 복수)
- `team_get_only_key` → `{team_locked_key}`(prefix가 "어느 key"인지 한정 → 개념명 단수 `key`로 충분)

### 본문 라벨

본문은 "조회 → 변경 → 저장 → 응답" CRUD 흐름이라 각 단계 머리에 한 단어 `# label`(목차처럼). 한 phase = 한 라벨.

- 뼈대는 `# find`(조회)로 열고 `# return`(응답)으로 닫는다. 사이 핵심 단계 라벨 = usecase 동작 동사(파일명과 일치) — `update.py`면 `# update`, `reveal.py`면 `# reveal`
- 있는 phase만 라벨 — 쓰기 있으면 `# persist`, read-only(`reveal`)는 생략. 외부 연동류는 도메인 맞춤(`# state`·`# exchange`·`# cache`)
- persistence helper(`_upsert`)는 함수 안에 두지 말 것 → domain repo 메서드(`set_by_key`)로

```python
@typecheck
async def update(*, session, event_group_id: UUID, input: Input) -> Output:
    # find
    found = await SecretRepository.get_by_identifier(session=session, id=input.id)
    updated = found

    # update (제공된 필드만 evolve, None = 미변경)
    if input.name is not None:
        updated = updated.with_name(Name.from_str(input.name))
    if input.expires_at is not None:
        updated = updated.with_expires_at(ExpiresAt.from_datetime(input.expires_at))

    # persist (name 유일성은 repo가 강제 — 충돌 시 AlreadyExistsError)
    secret = await SecretRepository.update_unique_by_name(session=session, entity=updated)

    # return
    return Output(
        data=secret.to_dict(),
        event=[
            event.to_dict()
            for event in (
                await event_record.record(
                    session=session,
                    id=event_group_id,
                    name="secret_update",
                    sources=[SecretEvent.updated(secret=secret)[0]],
                )
            )
        ],
    )
```

read(조회) — 쓰기 없지만 성공 접근 이벤트는 기록하고, write처럼 응답에 echo한다. source event가 fetch 를 감싼다([domain-event.md](domain-event.md)):

```python
@typecheck
async def reveal(*, session, event_group_id: UUID, input: Input, team_id: UUID, account_id: UUID | None = None) -> Output:
    # find
    event, secret = SecretEvent.read(
        secret=(
            await SecretRepository.tenanted_get_by_id(
                session=session,
                id=UUID(input.id),
                team_id=team_id,
            )
        )
    )

    # return
    return Output(
        data={**secret.to_dict(), "value": secret.value.to_str()},
        event=[
            event.to_dict()
            for event in (
                await event_record.record(
                    session=session,
                    id=event_group_id,
                    name="secret_reveal",
                    sources=[event],
                    actor_account_id=account_id,
                    actor_team_id=team_id,
                )
            )
        ],
    )
```

### 응답 shape — `Output(data, event)` (INV-8)

usecase는 **언제나 `Output(data=..., event=...)`를 반환**한다(로컬 `Output`, `Out` 상속). `to_dict()`가 `{"data", "event"}` 두 키를 항상 내므로 read/write 무관하게 shape 동일. endpoint는 `result.to_dict()`로만 직렬화(재가공·래핑 금지 — [endpoint.md](endpoint.md)).
`event`는 read/write 모두 emit한 이벤트를 echo한다 — shape 일관.
- write: `Output(data=..., event=[...])` — 저장된 이벤트 echo
- read: `Output(data=..., event=[...])` — read 이벤트(`act="read"`)도 동일하게 echo
- list: `Output(data=[...], event=[...])` — `data`에 맨몸 `list` OK(`Output`이 `{"data": [...]}`로 감쌈), usecase가 dict로 직접 래핑 금지

### CLI 섹션

- `_parse_args` — argparse 빈 생성자, input 필드와 1:1 `--flag`
- `_main` — 항상 async(session이 async). usecase가 sync여도 `_main`은 async + `async with transactional_session(...)`. 리소스 셋업은 `_main` 안 `async with`로 인라인
- `print(await {action}(...))`는 [conventions.md](../shared/conventions.md) "nested call 펼침"대로 줄바꿈. `print(await {action}(` 병합형 금지
- 섹션 내부는 함수 사이 빈 줄 1줄(모듈 기본 2줄의 예외)

---

## Session = Transaction — [INV-5]

Repository는 stateless classmethod 모음, session은 모든 호출의 첫 kwarg. 같은 session = 같은 transaction.

```
transactional_session(SessionLocal)
   │ BEGIN
   ├─ yield session                              ← usecase 실행 구간
   │     ├─ SecretRepository.add(session=session, ...)
   │     ├─ event_record.record(session=session, ...)
   │     └─ 같은 session = 같은 transaction
   │ COMMIT (정상) / ROLLBACK (예외)
```

contract:
- `session`을 인자로 받음 — usecase 안에서 새로 만들지 말 것
- 모든 repo 호출에 같은 session 주입 → atomic
- usecase 내부 `session.commit()`/`begin()`/`begin_nested()` 금지 — outer `transactional_session`이 관리. 실패를 잡아 판정하지도 않는다 — 재시도 판정은 트랜잭션을 여는 UoW([retry.md](retry.md))
- 생성 위치: endpoint는 behavior 세션 의존성이 주입([behavior.md](behavior.md)), CLI `_main`은 `async with transactional_session(db_client.SessionLocal)`. usecase는 만들지 않고 받기만

transaction에 안 들어가는 것(DB 밖 side-effect는 rollback 안 됨): 외부 호출(이메일 발송·결제 등). side-effect → DB 순서로 두면 DB 실패 시 outer state 일관.

왜 session을 인자로: repo가 session-바인딩 인스턴스면 매 요청 `Repo(session=...)` 필요 → classmethod 불가. session-per-method면 stateless → 클래스 자체 호출 + transaction boundary가 호출부에서 보임.

---

## 안티패턴

- usecase에 `_upsert` 같은 persistence helper → domain repo 공개 메서드(`set_by_key`)로
- 존재 확인을 `find_by_X(...) is not None` → repo `exists_by_X`(count 기반 `bool`)
- unique 충돌을 usecase에서 검사·raise → domain `{action}_unique_by_{col}` 호출만 ([INV-9], [repository.md](repository.md))
- must-exist write 후 `if x is None: raise` 가드 → domain repo override ([INV-3]). optional/멱등이라 부재가 정상이면 usecase가 `None` 분기
- repo 호출 시 `session=` 빠뜨림 → 모든 호출에 명시 ([INV-5])
- 응답을 맨몸 dict로 → `Output(data=..., event=...)` 반환 ([INV-8])
- repo 인스턴스화 → 클래스 자체로 ([INV-6])
