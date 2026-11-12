---
paths:
  - "worship_support/api/behavior/*.py"
  - "worship_support/api/behavior/**/*.py"
---

# behavior

`behavior/`는 한 요청(unit of work)을 감싸는 cross-cutting 능동 정책 레이어 — 트랜잭션 경계·인증·인가·테넌트 스코프·이벤트가 산다. 엔드포인트는 필요한 정책(action)을 조립해 FastAPI `Depends`로 끌어쓴다.

---

## 두 축 — 봉투(method) vs action

> 온톨로지 · noun/verb: 봉투(명사)와 action(동사)은 환원 불가한 두 범주라 이름꼴로 갈린다. 봉투 정직성은 essence/accident: 필수 입력만 담고 우연을 본질로 위장하지 않는다.

섞지 않는다. 이름꼴(명사 vs 동사)로 구분된다.

| 축 | 무엇 | 표현 | 이름꼴 |
|---|---|---|---|
| 봉투 (Server method) | 파이프라인이 프레임워크에서 바인딩하는 **라우트-가변 필수 입력** | dep 시그니처 | 명사 — `request`, `request_team` |
| 정책 (Action) | 무엇을 한다 (인증·인가·이벤트…) | `*requires` 인자 | 동사+목적어 — `AuthorizeMember` |

action은 다시 둘로 갈린다:

| 종류 | base | 이름꼴 | 예 |
|---|---|---|---|
| **조립형 action** | `Action` + `act(memory)` | 동사+목적어 | `AuthenticateAccount` · `AuthorizeMember` · `AuthorizeOwner` · `OpenEventGroup` · `DispatchEvents` |
| **pure-op** (조립형이 호출) | 없음 (plain class) | 명사 | `EventGroup` · `Tenant` · `Job` |

`Action` 상속은 **조립형에만**. pure-op이 `Action`을 상속하면 base 마커처럼 보여 오독된다 — 붙이지 않는다.

---

## 구조

```
behavior/
├── __init__.py     facade — behavior 싱글톤 + 조립형 action + worker UoW
├── server.py       Server(CoreBehavior) — request/request_team, RequestScope·RequestTeamScope, behavior 싱글톤
├── worker.py       이벤트 처리 UoW — use_postgresql_with_action (Job.claim → tenant scope = event_groups.team_id → scope, 예외면 롤백 후 Job.fail로 재시도 판정·삼킴 — retry.md) · use_postgresql (claim 없는 세션, 스위퍼용)
├── context/        신원 DTO (+ .setup) — 마커 Context
│   ├── access.py   AccountContext / TeamAccessContext / OwnerAccessContext
│   └── event.py    EventGroupContext
└── action/
    ├── access.py   AuthenticateAccount / AuthorizeMember / AuthorizeOwner   (조립형)
    ├── event.py    OpenEventGroup / DispatchEvents (조립형) · EventGroup (pure-op)
    ├── tenant.py   Tenant (pure-op — RLS, server·worker 공유)
    └── job.py      Job (pure-op — worker·DispatchEvents, dispatch 대기열 claim/fail/queued + event origin 조회. fail은 예외의 retryable로 판정, succeed는 dispatch usecase)
```

- 조립형 action = `act(memory)` classmethod 하나. 입출력은 요청별 `memory`.
- pure-op = repo/session/notify에 얇게 위임하는 helper. 조립형의 `act` 또는 worker가 호출.

---

## 봉투 분리 원칙

봉투는 **파이프라인이 소비하는 프레임워크 입력 중, 라우트마다 존재 여부가 갈리는 필수 입력의 조합**으로만 나뉜다. 정책은 봉투를 늘리지 않는다.

이유 — dep 입력은 FastAPI가 정적 시그니처로 해소한다:
- 모든 라우트에 동일하게 주입되는 입력(`Authorization` header 등) → 공유 시그니처. 분리 축 아님.
- 일부 라우트에만 있는 필수 입력(path param) → 없는 라우트에 강요 불가 → 별도 봉투.

판별:
- 프레임워크가 요청 framing에서 주입하고 **라우트마다 갈리는** 값 → 봉투(시그니처)
- "무엇을 할지", 또는 이미 바인딩된 것·다른 action이 `memory`에 넣은 값에서 읽는 것 → action

정직성 — 봉투는 자기가 실제 요구하는 필수 입력만 시그니처에 담는다. "다 optional로 한 봉투"는 금지(phantom 파라미터 + 필수-검증 상실).

```
# 새 라우트 결정 절차
파이프라인이 읽을 입력 중 "모든 라우트에 있진 않은 필수 입력"이 있나?
  없음 → request
  있음 → 그 입력 조합을 시그니처로 갖는 request_<scope>
나머지(정책) → 전부 action
```

---

## 봉투 네이밍

`request` + `_<scope>` — 접미사는 봉투가 바인딩하는 **라우트-가변 path scope(명사)**. 정책 아님.

| 파이프라인이 요구하는 라우트-가변 필수 입력 | 봉투 |
|---|---|
| 없음 | `request` |
| team_id | `request_team` |

- 접미사는 scope 명사(`team`, 미래 `org`) — action 동사와 시각적으로 구분.
- 여럿이면 outer→inner (`request_org_team`).
- 핸들러만 쓰는 path param(`secret_id`)은 파이프라인이 안 쓰므로 봉투에 안 셈.

```python
# good: 봉투(명사)=path scope, 정책=action
scope=Depends(behavior.request_team(AuthorizeMember(), OpenEventGroup(), DispatchEvents()))

# bad: 정책을 봉투 이름에 (인가는 action이지 봉투가 아님)
behavior.request_member(...)
```

---

## action 네이밍

- **조립형** = `동사 + 목적어`(PascalCase). 동작이 드러나야 한다.
  - 동사: 보안 `Authenticate`/`Authorize`, 생명주기 `Open`/`Dispatch`.
  - 목적어: 대상 개념 — `Account`·`Member`·`Owner`·`EventGroup`·`Events`.
  - `Require*` 균일 접두사 금지 — 게이트·셋업·후처리가 안 갈린다.
- **pure-op** = 명사(`EventGroup`·`Tenant`·`Job`). 조립형 동사와 구분. `Act`처럼 base 마커(`Action`)와 동음인 이름 금지.

```python
# good
AuthorizeOwner(), DispatchEvents()        # 조립형(동사+목적어)
Tenant.set_tenant_scope(...), Job.claim(...)   # pure-op(명사)
# bad
RequireOwner(), RequireDispatch()         # 접두사 균일
class Act(Action): ...                     # Action 동음 + pure-op에 base
```

---

## 흐름 — 정본 순서는 서버가 소유

봉투 method가 `*requires`를 받아 dep(`request_flow`)를 반환한다. 서버가 넘어온 action에서 active 집합을 만들고(`set_action`), 정본 사다리에서 하나씩 확인해 실행한다(`run_action`) — 엔드포인트가 어떤 순서로 넘겨도 실행은 고정.

```python
# 정본 순서: event group → (tx) 인증 → 인가 → tenant scope → yield → (커밋 후) dispatch
await self.run_action(memory, action=OpenEventGroup)
async with postgresql_transactional_session() as session:
    memory.session = session
    await self.run_action(memory, action=AuthenticateAccount)
    await self.run_action(memory, action=AuthorizeMember)
    yield self.RequestTeamScope(...)
await self.run_action(memory, action=DispatchEvents)
```

- `set_action`/`run_action`은 base `Behavior`(core)에 숨김 — Server엔 봉투 flow만.
- 봉투마다 로컬 `class RequestMemory(CoreMemory)` + `async def request_flow`. base `Memory`(core, `@dataclass`)가 `actions` 필드를 지니므로 로컬 클래스는 `@dataclass` 없이 필드만 선언한다.
- action 입출력은 요청별 `memory`로 주고받는다(요청 격리). `apply`/`is_active` 레지스트리 안 씀.
- 인가를 tenant scope보다 먼저 — 비멤버 team_id로 스코프 걸기 전 차단.

---

## Scope / facade

- dep가 yield하는 scope는 봉투별 subclass — `request`→`RequestScope`(session·account_id·event_group_id), `request_team`→`RequestTeamScope`(+team_id). 봉투가 실제 산출하는 필드만 담는다(없는 필드는 타입에 없음 — 로컬 `RequestMemory`와 같은 결, 출력에 적용한 봉투 분리 원칙). 공통 base는 core 빈 마커 `Scope`(method 반환 타입). worker UoW도 같은 base 상속 `WorkerScope`를 yield.
- 엔드포인트는 `scope` 하나로 받아 usecase엔 primitive로 푼다. scope 타입은 behavior 내부.
- facade(`__init__.py`) 노출: `behavior` 싱글톤 + 조립형 action + worker UoW(`use_postgresql_with_action`·`use_postgresql`). `RequestMemory`·scope 타입·pure-op은 내부.

---

## 조립 — 라우트 ↔ 봉투 + action

| 라우트 | 봉투 | action |
|---|---|---|
| auth (register·login·salts) | `request` | OpenEventGroup · DispatchEvents |
| account 조회, team 생성 | `request` | AuthenticateAccount · OpenEventGroup · DispatchEvents |
| team 멤버 작업 (secret, team key) | `request_team` | AuthenticateAccount · AuthorizeMember · OpenEventGroup · DispatchEvents |
| team owner 작업 (초대·삭제·로테이션) | `request_team` | AuthenticateAccount · AuthorizeOwner · OpenEventGroup · DispatchEvents |

- read/write 무관하게 전 라우트가 OpenEventGroup·DispatchEvents를 단다(현행 유지, dispatch는 이벤트 없으면 no-op).
