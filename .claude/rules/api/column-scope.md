---
paths:
  - "worship_support/api/**/*_repository.py"
  - "worship_support/api/**/*_model.py"
  - "worship_support/api/infrastructure/database/postgresql/rls.py"
---

# 컬럼 scope · sensitive (model `info`)

model 컬럼의 두 가지를 단일 출처로 고정한다 — 누가 이 행을 보나(`scope`, 컬럼 `info`) · 이 값이 비밀인가(`sensitive`, 필드의 **VO에서 파생**). agent 쿼리·RLS·guard가 이걸 읽는다. scope는 컬럼 이름과도 맞춘다(불일치는 lint); sensitive는 이름이 아니라 VO가 정한다 — `secrets.value`처럼 이름이 비밀임을 못 드러내므로.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · repo: [repository.md](repository.md) · VO: [value-object.md](value-object.md) · RLS: `infrastructure/database/postgresql/rls.py`

> 온톨로지 · taxonomy/identity: `scope` = 이 행이 어느 테넌트 종류에 속하나(컬럼 이름이 힌트) · `sensitive` = 값의 VO 종류(이름 무관, VO가 진실). 종류가 접근·노출을 정한다.

---

## 두 축 (지금 쓰는 것)

| 무엇 | 출처 | 이름 일관성 |
|------|------|-------------|
| `scope` = 누가 보나 | 컬럼 `info={"scope": "team"\|"account"}` | 이름이 축 드러냄(`team_id`) |
| `sensitive` = 비밀 tier | **필드의 VO 타입에서 파생**(`secret`\|`salt`\|`pii`\|`plain`) | 이름 무관 — VO가 진실 |

```python
# secrets — 실제 컬럼
team_id: mapped_column(info={"scope": "team"})   # 누가 보나: team
value:   mapped_column()                          # 필드 VO = Ciphertext → sensitive=secret (파생, 컬럼에 안 적음)
# domain·service·project·field — 평범(비밀 좌표) · id — 식별자
```

sensitive를 컬럼에 안 적는 이유: `secrets.value`(Ciphertext→secret)와 `settings.value`(Value→plain)가 **같은 이름 반대 tier**라, 이름·컬럼 라벨로는 절대 못 가른다. VO가 유일한 신호.

`sensitive`는 agent 노출뿐 아니라 payload 금지([domain-event.md](domain-event.md))·로그 마스킹의 공통 출처 — 값 종류라는 본질적 사실이라 여러 규칙이 재사용.

---

## scope — 누가 이 행을 보나

- **격리 컬럼에만** `scope`. 단순 참조(누가 했나 등 기록)엔 안 붙인다.
- **이름이 축을 드러낸다** — `team_id`→`team`, `account_id`→`account`. 이름은 힌트, `info`가 권위.
- **root 예외** — `accounts`/`teams`는 `id`가 곧 주인 → `id`에 `scope`. 이름이 축을 못 드러내는 유일 케이스.
- **격리 컬럼 2개 = membership** — 둘 다 `scope`, 아무 쪽이 맞으면 보임(내 account 또는 내 team).
- **간접 scope** (`scope_via`) — 격리 컬럼 없이 부모를 따라가는 자식 행. 테이블 `info={"scope_via": "<fk>"}`, RLS는 `EXISTS (부모)`(`rls.py` `_TENANT_PARENTS`). 예: `events` → `event_group_id`.
- **완전성** — 모든 테이블은 { `scope` 컬럼 ≥1 · `scope_via` · root `id`-scope · 명시적 global } 중 하나. 무엇도 아니면 격리 안 된 테이블 = 보안 구멍(lint 에러).
- repo가 소비 — RLS 테이블 aggregate의 repo는 팀 조건 메서드를 `tenanted_*`로 노출하고, team_id 받는 usecase는 그것만 쓴다([repository.md](repository.md) "테넌트 스코프").

```python
# good: 격리 컬럼에만 (event_groups.team_id 가 행을 격리)
team_id:          mapped_column(info={"scope": "team"})
actor_account_id: mapped_column()                    # 누가 했나 — 기록일 뿐, 격리 아님

# bad: 참조에 scope 남발 (격리 안 하는데)
actor_account_id: mapped_column(info={"scope": "account"})
```

---

## sensitive — 이 값이 비밀인가 (VO에서 파생)

값의 **VO 타입**이 tier를 정한다. 이름·컬럼 라벨이 아니라 VO가 SSOT — 비밀값은 이미 전용 VO로 감싸므로([value-object.md](value-object.md)) VO가 곧 "이건 비밀"이라는 선언.

| 필드 VO | tier | agent |
|---------|------|-------|
| `Ciphertext`·`WrappedDek`·`Verifier`·`Fingerprint` | `secret` | 숨김 |
| `Salt` | `salt` | 노출 OK (공개 설계 — `auth_get_only_salts`가 반환) |
| `Email` | `pii` | 마스킹 / 정책 |
| 그 외(평범 VO) | `plain` | 노출 |

- **이름은 tier를 못 정한다** — `secrets.value`(Ciphertext→secret) vs `settings.value`(Value→plain)가 동명 반대 tier. 파생 출처는 VO뿐.
- **fail-closed** — 비밀값은 반드시 전용 crypto VO로. raw `str`에 비밀을 담으면 파생이 `plain`으로 새므로(= 안티패턴), "비밀 = crypto VO"가 [INV-10]과 함께 강제한다.
- 파생 불가·예외만 `info={"sensitive": ...}`로 명시 오버라이드(드묾).
- `personal_lock`(공개 key)과 `personal_locked_key`(비밀 wrapped key)는 이름이 1글자 차이지만 tier가 반대 — 이름 말고 각자의 VO가 판정.

---

## FK 이름 규칙 — 2종

모든 FK는 **대상 테이블을 referent로 담는다**(역할·맥락은 qualifier로 앞에). 이름만으로 무엇을 가리키는지 드러나고 map이 edge를 추론한다.

- **table-named** (기본) — `[{qualifier}_]{referent}_id`. referent = `_id` 앞 마지막 세그먼트 = 대상 테이블 스템, 대상 = `{referent}s`. 역할은 qualifier로: `actor_account_id`(actor 역할 → accounts) · `actor_team_id`(→ teams) · 미래 `owner_account_id`·`inviter_account_id`. 불규칙 복수만 `info={"ref": "<table>"}`.
- **polymorphic** — 대상이 행마다 달라 단일 테이블이 없다(형제 판별자가 타입 지목). `act_entity_id` + `act_entity_name` → `info={"ref_by": "act_entity_name"}`, map은 정적 edge 안 만든다.

역할 이름만 쓰고 대상을 빠뜨리지 않는다 — `actor_id`(대상 없음) → `actor_account_id`. **role FK를 위한 별도 종류·`ref`는 없다** — 대상을 이름에 담으면 table-named로 흡수된다. `ref`/`ref_by`는 오직 대상 테이블을 이름에 담을 수 없는 경우(불규칙 복수·polymorphic)에만.

---

## 이름 ↔ 라벨 일관성 (lint)

| 조건 | 결과 |
|------|------|
| `scope` 있음 ⟺ 이름에 축 referent (`*team_id`) | root `id`만 예외 |
| 축 이름(`*team_id`)인데 `scope` 없음 | 경고 (격리냐 참조냐 확인) |
| FK(`*_id`)인데 referent가 테이블 아님 + `ref`/`ref_by` 없음 | 에러 (`actor_id` 류) |
| 비밀 후보 값이 raw `str`(crypto VO 아님) | 경고 (파생 실패 → fail-open) |
| 격리 안 된 비-global 테이블 | 에러 (완전성) |

---

## 확장 — 미래 케이스 (지금 자리만, 코드 0)

스키마에 아직 없지만 규칙이 미리 문 열어둔다(생길 때 소급 없이). **어휘만 정의, 지금 아무도 안 쓴다** — 미래 케이스를 코드로 구현하는 건 그 테이블이 실제 생길 때([Simplicity First]).

- **축 레지스트리 · 계층** — 축을 하드코딩 대신 등록(name → root table → parent). 예: `org`가 `team`의 parent → org 관리자가 산하 team 관통. `org` 축 추가 = 레지스트리 1줄(축이 실제 늘 때 `core/`에).
- **결합자** (`scope_combine`: `any` \| `all`, 기본 `all`) — 격리 컬럼 여럿일 때. membership/공유는 `any` 명시. 기본 `all`은 fail-closed(깜빡하면 너무 좁게, 안 샌다).

---

## 안티패턴

- 참조 컬럼에 `scope`(격리 안 하는데) → 격리 컬럼에만
- 역할 이름만 쓰고 대상 테이블 누락(`actor_id`) → 대상을 referent로(`actor_account_id`), role FK 별도 취급 안 함
- 비밀값을 raw `str` 컬럼에(전용 VO 없이) → crypto VO(`Ciphertext` 등)로 감싸 tier 파생 ([INV-10])
- sensitive를 컬럼 이름으로 판단 → VO가 SSOT (`value`가 secret일 수도 plain일 수도)
- `personal_lock`(공개)/`personal_locked_key`(비밀)처럼 crypto스러운 이름에 기대 tier 추론 → 각자의 VO로 판정, 이름 신뢰 금지
- 격리 안 된 비-global 테이블 → scope / root / global 중 하나(lint 에러)
- 미래 어휘(`org`·`scope_combine`)를 지금 코드로 구현 → 자리만, 테이블 생길 때
