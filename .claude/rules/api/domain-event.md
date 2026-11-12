---
paths:
  - "worship_support/api/**/*_event.py"
  - "worship_support/api/domain/event/**"
  - "worship_support/api/core/event.py"
---

# Domain Event 패턴

도메인 행위가 낳는 이벤트를 세 군데로 분업 — source event(domain·순수 데이터) / 기록(`usecase/event_record`) / 조정(usecase). source event는 `record`를 직접 호출하지 않는다.

용어 — `Event` = aggregate 하나에 일어난 사실. `EventGroup` = usecase 1회 실행(tx 1개)에서 생긴 Event들의 묶음 + 공유 맥락(actor·team·name). 인과 사슬을 잇는 correlation과는 다르다(group은 tx 1개로 닫힘).

도메인 `event`(`domain/event/`)는 루트 `EventGroup` aggregate다 — 폴더는 도메인 이름, 루트는 묶음([repository.md](repository.md) "aggregate 폴더" 예외). 감사와 큐가 함께 산다 — 성격은 다르다:

| 자식 | 무슨 정보 | 언제 |
|------|-----------|------|
| `event` (`domain/event/event/`) | 무엇이 바뀌었나 (act·entity·payload) | 동기, 도메인 변경과 같은 트랜잭션 |
| `reaction` (`domain/event/reaction/`) | 그 사건에 무슨 후속작업을 했나 (name·status·시각) | 비동기, worker가 나중에 재시도하며 |

감사(루트 `EventGroup` + `Event`)는 append-only 성공 로그다. 실패/거부(인증·권한)는 롤백되어 남지 않으니 트랜잭션 밖 logger의 몫 — 이 테이블에 섞지 않는다.

스키마 문법은 주어-동사-목적어: `EventGroup.actor_account_id`(주어)가 `EventGroup.team_id`에서 `act`(동사)를 `entity_name`/`entity_id`(목적어)에 했고, 한 Event는 `event_group_id`로 어느 `EventGroup`에 묶이며 그 group의 `name`이 묶음 이름(= usecase 식별, 예 `"secret_create"`)이다.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · entity: [entity.md](entity.md) · repo: [repository.md](repository.md) · 흐름: [usecase-flow.md](usecase-flow.md)

> 온톨로지 · essence/accident(Event는 자기 aggregate+평문만 [INV-7], actor·team·묶음은 emit이 스탬프) · type/instance(`EventGroup.name`=type, `EventGroup.id`=instance) · noun/verb(주어-동사-목적어).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| source event (domain) | core `Event[E]` 상속 순수 데이터 — `act`/`entity`/`payload` 필드. IO·async·타 aggregate 의존 0 — [INV-7] |
| 어휘 | act = core 단일 `Act` VO(CRUD, `core/value_object.py`) — source·저장본 Event 공용. entity_name = entity 클래스에서 파생. aggregate별 act 목록·entity_name 목록 없음 |
| 기록 | `event_record.record`/`tenanted_record`가 EventGroup(감사 루트)+Event(자식)를 쓰고, 등록된 reaction을 pending으로 동기 적재 |
| 조정 (usecase) | 도메인 변경 + source event + `record`(같은 session) + `Output(data, event)` — [INV-8] |
| reaction (큐) | reaction별 독립 재시도(입도: Event당 1행). 필드는 전부 VO — [INV-10] |

---

## source event — 순수 데이터 (domain) — [INV-7]

`{aggregate}_event.py`에 산다. core `Event[E]`(`core/event.py`, `Generic`·frozen dataclass — 필드 `act: Act`/`entity: E`/`payload: dict` + `id()`) 상속. 계약은 abstractmethod가 아니라 **필수 필드** — 안 채우면 생성 시점에 실패. IO·async·다른 aggregate 의존 0.

core `Event`는 같은 사실의 저장 전 형태, domain 자식 `Event`(`domain/event/event/event.py`)는 저장본 — core 쪽은 항상 `CoreEvent`로 import하므로([conventions.md](../shared/conventions.md) "core import") 이름이 섞이지 않는다.

```python
# good: domain/secret/secret_event.py — 순수 데이터, 팩토리가 payload 투영
@dataclass(frozen=True, kw_only=True)
class SecretEvent(CoreEvent[Secret]):

    @classmethod
    @typecheck
    def created(cls, *, secret: Secret) -> tuple["SecretEvent", Secret]:
        return cls(act=CoreAct.created(), entity=secret, payload=cls._payload(secret), by_factory=True), secret
    # updated/deleted/read/read_many — act 만 다름

    @staticmethod
    def _payload(secret: Secret) -> dict:
        return {"domain": secret.domain.to_str(), ...}
```

- 팩토리 `created`/`updated`/`deleted`/`read` — `@classmethod @typecheck`, sync. 모두 `(event, entity)` 2-튜플 반환(호출부 `event, x = SecretEvent.factory(...)`, entity 불필요면 `event, _ =`)
- 직접 생성 금지 — core `Event`도 Entity·VO와 같은 `by_factory` 가드. payload 비밀값 금지가 팩토리(`_payload`)에만 기대므로 옆문을 막는다
- 배치 `read_many` — `list[tuple[event, entity]]`(단건을 list에 map). "여럿"은 payload 안의 list가 아니라 source N개 + 같은 `event_group_id`(emit이 호출당 1개 스탬프). 소비처 생길 때만 추가([Simplicity First])
- `_payload`는 그 이벤트의 투영 지식 — 클래스 staticmethod(모듈 함수 아님). 비밀값 금지, 평문 식별자만
- `entity_name`/`entity_id`는 source event에 없다 — emit이 `entity` 필드에서 파생(아래 어휘). actor·team·묶음도 emit이 스탬프([INV-7] 유지)

---

## 어휘 — act / entity_name

두 어휘의 SSOT 위치가 다르다 — act는 전역 닫힌 집합, entity_name은 각 entity 고유.

| 어휘 | SSOT | 형태 |
|------|------|------|
| act | core `Act` VO `_allowed_list` (`created`/`read`/`updated`/`deleted`) | `CoreAct.created()` 등. source·저장본 Event가 같은 타입 — 변환 없음 |
| entity_name | entity 클래스명 (snake 파생) | `EntityName.from_entity(type(entity))`, emit이 파생 |

```python
# good: EntityName 은 클래스에서 파생 — 하드코딩·_allowed_list 없음
class EntityName(CoreValueObject):
    @classmethod
    def from_entity(cls, entity_cls) -> "EntityName":
        return cls(_value=cls._snake(entity_cls.__name__), by_factory=True)

# good: Event.from_emit 이 파생 (source 는 entity 만 든다)
entity_name = EntityName.from_entity(type(source.entity))   # TeamAccess -> "team_access"
entity_id   = source.entity.id
```

- act는 순수 CRUD — 도메인 의도(회전 등)는 act가 아니라 `EventGroup.name`(usecase)이 담는다. 특수 동사를 act에 넣지 않는다(아래 rotate)
- `event.to_name()` = `"entity.act"`(예 `"secret.created"`) = dispatch source 키
- 새 aggregate 추가 시 갱신할 목록이 없다 — act enum은 고정, entity_name은 클래스에서 파생. `check_code_rules.py` hook이 `EVENT_REACTIONS` source를 이 두 집합으로 검증

---

## 기록 — `event_record.record` / `tenanted_record`

감사는 루트+자식 한 aggregate([repository.md](repository.md) "aggregate 폴더") — 루트 `domain/event/event_group.py`(`EventGroup(CoreEntity)`: name/actor_type/actor_account_id/team_id, 상태 없음)와 자식 `event/`(`Event`: event_group_id/act/entity_name/entity_id/payload/sequence). 자식은 루트 `EventGroupRepository`가 base `_rows_*`로 다룬다(자식 repo 없음). usecase는 repo를 직접 부르지 않고 `record`/`tenanted_record`로 기록한다 — 감사 + (reaction 등록 시) 큐 적재를 한 트랜잭션에.

누가·어느 팀은 요청 1건(= `EventGroup` 1건)의 맥락이라 루트에만 둔다.

| 필드 | 값 |
|------|-----|
| `team_id` | 팀 맥락이면 그 팀, 아니면 `None` |
| `actor_account_id` | 인증된 account, 비로그인이면 `None` |
| `actor_type` | `person`(서비스 안 사람의 동작, 비로그인 포함) / `system`(사람 아닌 실행 — CLI·cron 등). 지금 기록 경로는 전부 `person` |

```python
# good: 팀 맥락 — team_id 받는 usecase 는 tenanted_ 만 (check_code_rules.py hook)
await event_record.tenanted_record(
    session=session,
    id=event_group_id,
    name="secret_create",
    sources=[event],
    team_id=team_id,
    actor_account_id=account_id,
)

# good: 팀 없음 — 비로그인·전역 (RLS 우회 뷰 경유)
await event_record.record(
    session=session,
    id=event_group_id,
    name="auth_login",
    sources=[event],
    actor_account_id=account.id,
)
```

- `record`는 EventGroup+Event를 쓰고, 각 Event의 `to_name()`이 `EVENT_REACTIONS[name]`의 source와 맞으면 **pending `Reaction`을 동기 생성**(입도: Event당 1행). reaction 등록 없으면 감사만
- `sources`가 비면 아무것도 안 쓴다 — 빈 EventGroup 없음
- EventGroup은 같은 id 재emit에 안전(`ignore_conflict`)
- RLS — `event_groups`는 `team_id`, `events`·`reactions`는 부모 `event_groups`를 따라간다(`scope_via`). worker의 claim/조회는 팀 경계 없음(접두사 없는 repo 메서드 → 우회 뷰). `sequence`는 DB Identity 단조 커서(`Sequence` VO, `to_model` 제외)

---

## 조정 — usecase + Output 응답 — [INV-8]

도메인 변경 + 이벤트 기록의 조정은 usecase 책임. source event + `record`를 같은 session으로 = atomic.

```python
# good: write — 도메인 변경 + source event ((event, entity) 튜플)
event, entity = SecretEvent.created(
    secret=await SecretRepository.tenanted_add_unique_by_path(session=session, entity=Secret.new(...)),
)
return Output(
    data=entity.to_dict(),
    event=[e.to_dict() for e in (await event_record.tenanted_record(
        session=session, id=event_group_id, name="secret_create", sources=[event],
        team_id=team_id, actor_account_id=account_id))],
)

# good: read — 성공 접근 기록도 write 처럼 echo
event, secret = SecretEvent.read(
    secret=await SecretRepository.tenanted_get_by_id(session=session, id=..., team_id=team_id))
```

- `id`(emit의 `EventGroup.id`, 파라미터명 `event_group_id`): behavior `Scope`가 요청당 1개 생성 → endpoint가 주입(CLI는 `uuid4()`)
- `name`: usecase가 자기 파일명 스템(`"secret_create"`)을 리터럴로 — 단일 출처, HTTP/CLI 일관
- `actor_account_id`: 인증된 account. usecase는 `account_id: UUID | None = None`로 받아 전달(비로그인·CLI는 None)
- read도 write처럼 `event=[...]` echo — 응답 shape 일관

### rotate — per-entity 효과

특수 동사를 만들지 않는다. 회전은 `EventGroup.name="team_rotate"`가 의도를 담고, Event는 실제 바뀐 것을 낸다:

```python
# good: 바뀐 것마다 source event — 합성 Event 없음
sources = [SecretEvent.updated(secret=s)[0] for s in reencrypted] \
        + [TeamAccessEvent.updated(team_access=ta)[0] for ta in rekeyed]
```

`TeamEvent`는 team_create에서만(항상 Team 보유) — entity 없는 이벤트는 없다.

---

## payload — consumer 자족, Event마다

reaction은 **기록 시점 Event의 `payload`만으로** 동작한다 — 비동기라 엔티티가 이미 바뀌었을 수 있어 재로드하지 않는다(event-carried state transfer). payload는 Event 1건 = 엔티티 1개 스냅샷이라 병합하지 않는다.

- 팩토리가 투영(`_payload` staticmethod) — 저장본 `Event`는 `Payload` VO로 감싼다(emit의 `Payload.from_dict`)
- sibling aggregate 평문은 usecase가 공급 — Event는 자기 aggregate만 안다([INV-7]). 다른 aggregate 값(초대받는이 `email`·`team_name`)은 usecase가 로드해 팩토리에 **raw**(`str`)로 넘긴다(VO면 그 aggregate 의존)
- 공급된 경우만 payload에 — 미공급이면 생략
- 민감값 금지 — value·salt·key 등은 불가(그런 값이 필요한 reaction은 없어야)

---

## reaction — 큐 (event-triggered usecase)

reaction은 EventGroup 자식(`domain/event/reaction/`)이자 **재시도 단위**다. 기록 시점에 pending으로 동기 생성되고, worker가 비동기로 처리한다.

```
record 시: EventGroup + Event들 + 매칭 reaction들(pending) — 한 트랜잭션
NOTIFY {"id"} (reaction 있을 때만) ─┐
                                    ├─→ claim(우회 뷰, lease)  pending 도래 OR claimed lease만료
스위퍼 ──────────────────────────────┘       │
                                             ▼  tenant scope = claim 결과 event_group.team_id
                                          reaction.run(payload=event.payload)
                                          성공 → succeeded / 실패 → UoW 롤백 후 retryable이면 attempts+1·백오프(max→failed), 아니면 즉시 failed
```

- **재시도 = reaction별**(입도: Event당 1행) → 독립 재시도, 성공한 reaction·payload를 다시 돌지 않는다
- `Reaction` 필드: `event_group_id`/`event_id`/`name`/`status`/`attempts`/`next_attempt_at`/`claimed_at`/`error` — FK 외 전부 VO(`reaction/` 폴더). 유일 `(event_group_id, name, event_id)`
- registry = `usecase/event_dispatch.py`의 `EVENT_REACTIONS` — `{EventGroup.name: [(source, 기록 이름, reaction)]}`. `source` = 소비할 Event(`"team_access.created"` = `event.to_name()`). reaction은 그 Event payload마다 실행
- reaction = **usecase 레이어의 event-triggered usecase** — `usecase/<reaction>.py`에 `Input(CoreIn)` + `run(*, session, input)`. 호출자만 endpoint 대신 worker
- 등록 검사 `check_code_rules.py` hook — 키는 실제 usecase 이름, source는 `Act`×entity_name 조합, 기록 이름은 group 안에서 유일
- 멱등 — DB 효과는 reaction 단위 exactly-once, 외부 부작용(메일)은 커밋 직전 크래시 시 중복 가능(at-least-once). 되돌릴 수 없는 외부 동작 1개 = reaction 1개
- 시간 정책(`MAX_ATTEMPTS`·백오프·`LEASE_SEC`·스위퍼)은 `config.py` `ReactionConfig`. 최종 실패는 stderr 한 줄 후 멈춤

---

## 안티패턴

- source event가 IO/async를 갖거나 다른 aggregate repo·entity를 호출 → 순수 데이터 (**[INV-7]**). sibling 평문은 usecase가 raw로 공급
- `act_entity_name()`/`_kind`로 이름을 하드코딩 → `entity` 필드 + emit이 `EntityName.from_entity`로 파생
- per-aggregate `EventKind` enum·aggregate별 act 목록 → core 단일 `Act` VO
- 특수 동사를 act에 (`rotated` 등) → CRUD만, 의도는 `EventGroup.name`. 회전은 per-entity 효과 Event
- reaction 필드를 "운영 상태"라며 raw/Enum으로 → VO ([INV-10])
- 재시도를 group 전체 단위로 → reaction별(Event당) 독립 — 성공분 재실행 방지
- reaction이 payload 대신 엔티티를 재로드 → event-carried state transfer, `Input.from_event(payload)`
- payload에 민감값(value·salt·key) → 평문만
- source event에 actor/team/묶음 id → emit이 스탬프. source는 act+entity+payload만
- `record(atomics=...)` → `sources=...`
- team_id 받는 usecase에서 접두사 없는 `record` → `tenanted_record` (hook)
- 응답을 맨몸 dict로 → `Output(data, event)` ([INV-8])
