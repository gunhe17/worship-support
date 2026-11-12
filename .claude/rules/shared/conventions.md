---
paths:
  - "worship_support/**/*.py"
---

# 공통 코드 컨벤션

`worship_support/` 전 앱(api·cli·mcp…) 공통 Python 코드 스타일. 레이어/앱별 패턴은 각 규칙 문서를 참고 — 이 문서는 그와 무관한 시각/포맷 규칙만 담는다.

적용 범위: `worship_support/` 전 앱 공통 (api 레이어 패턴은 [rules/api/](../api/)).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **파일 구조** | docstring 없음. 절차 순서 = 읽기 순서(호출자 위), 모듈 상수 블록 피함 |
| **섹션 마커** | `# #` 시그니처로 논리 영역, 인라인 `# label`로 메서드 단계 |
| **네이밍** | 폴더/파일 컨텍스트 중복 금지, 준말 금지(`id`만 예외) |
| **반환값** | happy path는 named variable, 자명한 표현식은 inline(괄호 펼침) |
| **호출 스타일** | 인자 all-or-nothing, `*` 키워드 전용, nested call·삼항식 인자·메서드 체인 펼침 |
| **Import** | 표준→서드파티→로컬, 도메인 클래스 한 줄씩, registry는 모듈 namespace import |
| **비동기** | DB 접근 `async`, 트랜잭션은 `@asynccontextmanager` |
| **포맷팅** | 4칸, 함수 사이 2줄, flat dict 삼항식은 괄호+줄바꿈 |
| **주석 언어** | 라벨/마커 영어, 라벨 뒤 한국어 부연은 why/계약/주의만(what 재서술 금지) |

---

## 파일 구조

**모듈 docstring 작성하지 않는다.** 파일명, `# #` 섹션, 최상위 함수가 의도를 드러낸다.

**절차 순서 = 읽기 순서.** 호출자가 위, 피호출자가 아래. 최상위 함수가 파일 맨 위. 타입(`@dataclass` 등)은 그 단계 섹션 안에 동거. 전방 참조용 `from __future__ import annotations` 사용.

모듈 수준 상수 블록(`MAX_X = ...`)은 피한다. 별도 `config.py`로 분리(`ABC` + `@property @abstractmethod` + 환경별 서브클래스 + 팩토리 함수 — [reference/singleton-config.md](../api/singleton-config.md) "Config 클래스" 참고). 단일 파일 lab/script의 `# config` 섹션은 fallback이지 권장 아님.

```python
from __future__ import annotations

import argparse
import asyncio


# #
# orchestrate

async def generate(*, ...) -> list[ScoredSong]:
    # fetch
    metadatas = await fetch_all_metadata(...)
    # score
    scored = [score(...) for m in metadatas]
    # select
    generated = select(scored=scored, size=size)

    return generated


# #
# fetch
# (SongMetadata 타입, fetch 관련 함수들)

# #
# score
# (ScoredSong 타입, score 관련 함수들)

# #
# select
# (select 관련 함수들)
```

---

## 섹션 마커

`# #` 시그니처로 파일/클래스 내부 논리 영역 구분.

```python
# #
# factory

@classmethod
def new(cls, ...): ...
```

라벨 예:
- 모듈: `# route`, `# run`, `# cli`, `# client`, `# model`, `# repository`, `# orchestrate`, `# fetch`, `# score`, `# select`
- 클래스 내부: `# factory`, `# query`, `# command`, `# create`, `# read`, `# update`, `# delete`
- 싱글톤 블록은 PascalCase 클래스명 — [reference/singleton-config.md](../api/singleton-config.md) "싱글톤" 참고

인라인 라벨(`# label`, 단일 `#`) 로 메서드 내부 단계 표기.

```python
# type
if not isinstance(value, str):
    raise  # InvalidError

# format
if not re.match(...):
    raise  # InvalidFormatError
```

라벨 예: `# type`, `# format`, `# value`, `# length`, `# hint`, `# cap`, `# normalize`, `# components`, `# weighted sum`, `# fan-out`, `# filter`, `# backoff retry`, `# rank`, `# fallback`.

---

## 네이밍

식별자에 폴더/파일 컨텍스트를 중복하지 않는다. 호출부 `from foo.bar import X`에서 경로 `foo.bar`가 이미 컨텍스트를 제공함. `X` 안에 `foo`나 `bar`를 다시 담으면 import 라인이 `bar의 BarX`처럼 stutter.

준말(축약) 금지 — 단 `id`는 예외. 식별자는 풀어 쓴다(`config`은 OK인 통용어 제외). `id`만은 `identifier`의 관용 축약으로 허용 — 조회 키 파라미터는 `identifier` 대신 `id`로 짧게 쓴다(예: `get_by_identifier(*, session, id: str)`). 단 메서드명의 의미 구분은 보존: base의 `find_by_id`(UUID pk)와 도메인의 `find_by_identifier`(name-or-uuid)는 다른 개념이라 메서드명은 유지하고 파라미터만 `id`로 축약(메서드명까지 `_by_id`로 바꾸면 base와 충돌·LSP 위반).

폴더 컨텍스트 중복 금지:

```
infrastructure/database/postgresql/client.py
  class PostgresqlClient        →  class Postgres
```

파일 컨텍스트 중복 금지:

```
setlist_generator.py
  def generate_setlist()        →  def generate()

usecase/secret_create.py
  def create_secret()           →  def create()

domain/user/email.py
  def from_email_str()          →  def from_str()
```

예외 — 파일 안에 동종 다중 식별자가 있어 분별 단어가 필요한 경우:

```
domain/secret/secret_repository.py
  class SecretModel, class SecretRepository       # "Model"/"Repository" 보존
```

분별 단어(`Cache`, `Model`, `Repository`)는 유지하되 폴더 prefix(`Secret`, `Postgres`)는 유지/생략 모두 가능. 베이스 ABC가 일반 이름(`Repository`, `Entity`)일 때만 서브에 도메인 prefix 부여로 충돌 회피.

| 대상 | 형태 | 예 |
|------|------|-----|
| 클래스 | PascalCase | `Secret`, `SecretRepository` |
| 함수/메서드/변수 | snake_case | `from_str`, `find_by_name` |
| 비공개 (모듈/필드) | `_` 접두 | `_value`, `_fetch_metadata` |
| Config 프로퍼티 | UPPER_CASE | `POSTGRES_USER` |
| 힌트 클래스 필드 | `_` + `# hint`, dataclass면 `ClassVar` ([value-object.md](../api/value-object.md) "hint") | `_format: ClassVar[str] = "%Y-%m-%d"` |

---

## 반환값

**Happy path는 named variable에 담은 뒤 return.** 함수의 정상 출력을 함수 이름을 만족하는 변수에 담고 반환.

```python
metadata = SongMetadata(...)
return metadata
```

예외 — inline return:
- 가드/에러 early return: inline (`return None`, `return 0.0` 등)
- 순수 위임(passthrough): `return await delegate(...)` inline 허용 (CLI 진입점 등)
- 자명한 출력 표현식: 최종 반환이 그 자체로 자명한 단일 표현식(comprehension, dict/list literal 등)이면 변수에 담지 말고 바로 반환. 변수명이 표현식을 단순 재진술할 뿐이면(`listed = [...]; return listed`) noise. 단 여는 괄호는 `return` 줄에 두고 본문은 줄바꿈해 펼친다(한 줄에 욱여넣지 않음 — 호출 인자 펼침 규칙과 동일 결).

```python
# bad: 이름이 표현식 재진술 — noise
listed = [s.to_dict() for s in secrets]
return listed

# bad: 한 줄에 욱여넣기
return [s.to_dict() for s in secrets]

# good: 변수 없이 바로 반환 + 괄호 펼침
return [
    s.to_dict() for s in secrets
]
```

| 함수 | 변수명 |
|------|--------|
| `fetch_all_metadata` | `metadatas` |
| `_fetch_metadata` | `metadata` |
| `score` | `scored` |
| `select` | `selected` |
| `generate` | `generated` |

규칙: 이름은 표현식이 못 주는 의미를 줄 때만 단다 — 생산 함수 출력에 의미 부여(`metadatas`)나 다단계 흐름의 중간값일 때 named variable, 표현식이 곧 의도면(자명한 변환·literal·passthrough) inline. intermediate 변수는 생산 함수 출력 의미, 최종 return 변수는 enclosing 함수 출력 의미.

---

## 호출 스타일

**인자 표기는 all-or-nothing.** 한 호출 안에서 keyword/positional 혼용 금지.

```python
# good: 전부 positional
asyncio.wait_for(coro, FETCH_TIMEOUT_SEC)
random.sample(["a", "b", "c"], 2)

# good: 전부 keyword
score(metadata=m, target_topics=topics, congregation_low=lo, congregation_high=hi)

# bad: 혼용
asyncio.wait_for(coro, timeout=FETCH_TIMEOUT_SEC)
```

stdlib 강제 혼용 예외: `sorted(iterable, /, *, key, reverse)`, `argparse.add_argument(*name_or_flags, **kwargs)`.

키워드 전용 강제. 도메인 함수는 `*` 로 모든 인자 키워드 전용화. 다인자 시그니처는 파라미터마다 줄바꿈 + trailing comma.

```python
def new(
    cls,
    *,
    name: Name,
    birth: Birth,
    email: Email,
    password: Password,
) -> "User":
```

인자 값이 nested call이면 호출을 펼친다. 인자 값이 그 자체로 팩토리/변환 호출(`Name.from_str(...)`, `Ciphertext.from_bytes(...)` 등)이면 한 줄에 욱여넣지 말고 인자마다 줄바꿈 + trailing comma.

```python
# good: nested call 인자 → 펼침
secret = await SecretRepository.find_by_name(
    session=session,
    name=Name.from_str(input.name),
)

# bad: 한 줄에 욱여넣기 — nested 변환이 묻힌다
secret = await SecretRepository.find_by_name(session=session, name=Name.from_str(input.name))
```

- 트리거는 인자 값에 nested call이 있는지 — 전부 단순 값(`session=session`, `id=secret.id`)이면 한 줄 유지 OK (단 repository 호출은 예외 — 아래)
- 펼친 형태는 정의부와 동일하게 trailing comma 유지

repository 메서드 호출은 인자가 전부 단순 값이어도 항상 펼친다. `session=` + 도메인 인자(`id`/`team_id`/`limit`/`offset` 등)가 한 줄에 묻히지 않게, 영속성 경계 호출을 시각적으로 분리. `get_by_id`/`list_all`/`search`/`add`/`update`/`remove_by_id` 등 모든 repo 메서드 호출에 적용.

```python
# good: repo 호출 — 단순 값이어도 펼침
secret = await SecretRepository.tenanted_get_by_id(
    session=session,
    id=UUID(input.id),
    team_id=team_id,
)

# bad: repo 호출을 한 줄에
secret = await SecretRepository.tenanted_get_by_id(session=session, id=UUID(input.id), team_id=team_id)
```

인자 값이 삼항식(`... if ... else ...`)이면 괄호로 감싸 줄바꿈. 한 줄 삼항식은 분기가 인자 사이에 묻힌다. 괄호 + 줄바꿈으로 "이 인자는 분기가 있다(예외적 경우)"를 시각적으로 분리한다 — flat dict 값의 삼항식 규칙([포맷팅](#포맷팅) "삼항식은 괄호로 감싸 줄바꿈")과 동일 원칙, 호출 인자에도 적용.

```python
# good: 삼항식 인자 → 괄호 + 줄바꿈
secrets = await SecretRepository.search(
    session=session,
    kind=(
        Kind.from_str(input.kind) if input.kind is not None else None
    ),
    tag=input.tag,
    query=input.query,
)

# bad: 한 줄에 삼항식 — 분기가 묻힌다
kind=Kind.from_str(input.kind) if input.kind is not None else None,
```

- 단순 값(`tag=input.tag`)은 한 줄 유지 — 삼항 분기가 있을 때만 적용
- 닫는 괄호 `)` 다음 trailing comma 유지

메서드 체인은 세로로 펼친다. 메서드/속성이 여러 단계 이어지는 fluent 체인을 인자/반환에 인라인하면 한 줄에 두지 말고 리딩 닷(`.`) 세그먼트마다 줄바꿈. 체인 head의 호출 인자도 펼친다(위 nested call 규칙과 동일 결). single-use 중간 변수(`path = ...`)는 두지 않는다 — 표현식을 그대로 인라인.

```python
# good: 체인 세로 펼침 — 리딩 닷 세그먼트마다 한 줄
return FileResponse(
    Path(
        __file__
    )
    .resolve()
    .parent.parent / "domain" / "schema.html"
)

# bad: 한 줄 체인 — 단계가 묻힌다
return FileResponse(Path(__file__).resolve().parent.parent / "domain" / "schema.html")

# bad: single-use 중간 변수
path = Path(__file__).resolve().parent.parent / "domain" / "schema.html"
return FileResponse(path)
```

- 세그먼트 = 리딩 닷으로 시작하는 한 단계. `.parent.parent / "a" / "b"`처럼 속성 접근 + 경로 결합(`/`)은 한 세그먼트로 묶어 같은 줄(예시대로)
- 단발 호출(`x.to_str()`, `Name.from_str(...)`)은 체인이 아님 — 여러 단계가 이어질 때만 적용

---

## Import

순서: 표준 → 서드파티 → 로컬. 그룹마다 한 줄 공백. 로컬은 패키지 루트부터 절대경로 `from worship_support.api.xxx`. 도메인 클래스는 한 줄에 하나씩 별도 import.

```python
import re
from dataclasses import dataclass

from worship_support.api.core.value_object import ValueObject

from worship_support.api.domain.secret.name import Name
from worship_support.api.domain.secret.kind import Kind
from worship_support.api.domain.secret.tags import Tags
```

### core import

`worship_support.api.core`에서 가져오는 클래스는 항상 `Core{Name}` 별칭으로 — core 내부끼리도. 호출부에서 core 출처가 보이고, 도메인 동명(`Event` 등)과 충돌하지 않는다. 함수(`typecheck` 등)는 별칭 없음. `check_code_rules.py` hook이 강제.

```python
# good
from worship_support.api.core.value_object import ValueObject as CoreValueObject
from worship_support.api.core.validate import typecheck

class Name(CoreValueObject): ...

# bad
from worship_support.api.core.value_object import ValueObject
```

### 라우터/registry — 모듈 namespace import

여러 핸들러를 한 모듈에서 등록할 때는 `from package import module` 형태로 import하고 `module.func`로 접근. alias 노이즈 제거 + namespace 의도 명확. (등록이 일어나는 합성 루트 = `bin/server.py` — [reference/server.md](../api/server.md) "합성 루트".)

```python
# good: 모듈 namespace — 한 모듈에서 N개 함수 등록 (bin/server.py)
from worship_support.api.endpoint import secret

server.router(Router(path="/secret",         methods=["POST"], endpoint=secret.post_create))
server.router(Router(path="/secret/{id}",    methods=["GET"],  endpoint=secret.get_reveal))
```

```python
# bad: alias 패턴 — endpoint 추가마다 import 늘어남
from worship_support.api.endpoint.secret import post_create as secret_post_create
```

적용 기준:
- 한 모듈에서 2개 이상 함수 import → 모듈 namespace (`from pkg import mod`)
- 한 모듈에서 1개만 import → 함수 직접 (`from pkg.mod import func`)
- 적용 위치: FastAPI router 등록, CLI dispatcher, MCP tool registry 등 "여러 핸들러를 외부 시스템에 등록"하는 파일
- 도메인/usecase/repository 호출처에는 적용 안 함 — 도메인 클래스 한 줄당 import 규칙 그대로

---

## 비동기 + 데코레이터

- DB 접근 메서드는 `async`
- 트랜잭션은 `@asynccontextmanager` 헬퍼로 래핑
- 추상 비동기 메서드 본문도 `...`
- `@typecheck` (`core/validate.py`) — 인자 런타임 타입 검사. 불일치 시 `DevelopError`(새 예외 없이 직접 raise). Entity/VO 팩토리(`new`)·이벤트 팩토리·usecase 함수에 부착. `@classmethod`와 함께 쓸 땐 `@classmethod` 위, `@typecheck` 아래 순서

```python
@asynccontextmanager
async def transactional_session(session_factory):
    session = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
```

트랜잭션 경계의 의미(같은 session = atomic)는 [reference/usecase-flow.md](../api/usecase-flow.md) "Session = Transaction" 참고.

---

## 포맷팅

- 들여쓰기 4칸
- import 블록 후 두 줄 공백
- 모듈 함수 사이 두 줄 공백 (`# cli` 섹션 내부는 한 줄 예외 — [reference/usecase-flow.md](../api/usecase-flow.md) CLI 섹션 참고)
- 메서드 사이 한 줄 공백
- 긴 함수 시그니처: 파라미터마다 줄바꿈 + trailing comma
- `if __name__ == "__main__":` 는 파일 하단 `# cli` 또는 `# run` 섹션

flat dict return의 삼항식은 괄호로 감싸 줄바꿈. `to_dict` / `to_model`처럼 한 줄 = 한 키인 딕셔너리에서, 값에 `... if ... else ...`가 들어가면 키 라인이 길어진다. 괄호 + 줄바꿈으로 "이 키는 분기가 있다"를 시각적으로 분리.

```python
# bad: 한 줄에 삼항식
return {
    "expires_at": self.expires_at.to_str() if self.expires_at else None,
}

# good: 괄호 + 줄바꿈
return {
    "expires_at": (
        self.expires_at.to_str() if self.expires_at else None
    ),
}
```

- 단순 값(`"name": self.name.to_str()`)은 한 줄 유지 — 분기 문법이 있을 때만 적용
- 닫는 괄호 `)` 다음 trailing comma 유지

---

## 주석 언어

- 코드 라벨/섹션 마커: 영어 (`# factory`, `# query`)
- 도메인 의미가 강한 docstring (MCP tool 설명 등): 한국어 허용

### 라벨 뒤 부연 — 라벨만 기본, 형태부터 금지

인라인 라벨은 영어 한 단어(`# find`, `# event`). 부연은 코드가 드러내지 못하는 것 — 비자명한 의도(why)·입력 계약·주의(gotcha) — 일 때만, 그리고 `# label (…)`/`# label — …` 형태가 **아니라** plain 한 줄(메서드 단계) 또는 트레일링 인라인(선언)으로. 코드가 이미 보여주는 동작(what)을 재서술하지 않는다.

> **기본은 라벨만 — 부연을 적으려는 손을 멈춰라.** 대부분은 코드·시그니처·타입·docs가 이미 말하는 재서술이다. "어디에도 없는 why/계약/함정인가?"에 확실히 yes일 때만, 그때도 라벨 부연이 아니라 plain 줄/트레일링으로.

[check_label_comments.py](../../hooks/check_label_comments.py) 훅이 세 형태를 기계적으로 잡는다 — `# label (괄호)`, `# label — em-dash`, 선언(`name: type`) 바로 위 산문 주석. 살아남는 부연은 그 형태를 피해야 한다.

- **메서드 단계 why/계약**: `# label (frag)`가 아니라 **plain 한 줄**로(`# 이메일/증명 어느쪽 오류인지 구분 노출 안 함`). 라벨은 라벨대로(`# find`).
- **선언(field/var) 계약**: 별도 줄이 아니라 **트레일링 인라인**(`field: str  # 단서`). 단 도메인 VO로 매핑되는 필드는 의미가 VO·필드명에 있으니 **무주석**.
- 냄새 신호 (가장 흔함): `# label (호출/의존성이 하는 일 요약)` — `Depends(...)`·메서드가 *이미 하는 일*을 푼 것. 시그니처가 말하므로 라벨만. "엔드포인트 흐름 요약"·"usecase 단계 설명"은 거의 다 이 부류.
- 냄새 신호: `# label (… 없음/안 함/미전달)` — 부재·생략은 호출부에 이미 보인다. *왜* 부재인지가 어디에도 없을 때만, plain 줄로.
- 설계 근거는 docs에, 코드 주석에 복제하지 않는다. 패턴이 문서화된 컨벤션이면 메서드는 시그니처·코드로 자기설명(예: `get_*`의 `-> E` + `if None: raise`)되므로 주석 불필요.
- 필드/변수 선언 주석은 기본 금지 — 타입이 말하는 것(`int | None`) 재서술이거나 docs/VO 근거 복제다. 진짜 함정만 트레일링 인라인.

```python
# good: 라벨만 — 단계는 라벨이 목차
# find
# emit
# persist

# bad: 괄호·em-dash 부연(what 재서술) → 라벨만 (훅이 잡음)
# command (require_member 가 멤버십·team_id·RLS 확정)   →   # command
# verify (login_proof 를 저장된 login_verifier 와 대조)   →   # verify
# emit (미인증 — actor 없음)                              →   # emit

# good: 살아남는 why = 라벨 부연이 아니라 plain 한 줄(코드에 안 보이는 보안/계약)
# 이메일/증명 어느쪽 오류인지 구분 노출 안 함

# bad: 선언 위 산문 / 타입·VO 의미 복제 → 무주석 (타입·VO·docs 가 의미를 진다)
# team_locked_key = 가입자가 봉인한 team_key
team_locked_key: str                                     →   team_locked_key: str
sequence: int | None = None  # DB 발급 단조 커서 …        →   sequence: int | None = None
```
