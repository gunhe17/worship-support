---
paths:
  - "worship_support/api/**/*_repository.py"
  - "worship_support/api/infrastructure/database/postgresql/repository.py"
  - "worship_support/api/infrastructure/database/common/repository.py"
  - "worship_support/api/core/model.py"
---

# Repository 패턴

영속화 — 세 조각이 한 곳에: core의 추상 계약(`Repository[T]`), infrastructure의 일반화 부모(`PostgresRepository`), domain의 wiring(`{Aggregate}Repository`). SQLAlchemy `Model`은 domain repo 파일에 동거([INV-1] 완화).

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · entity: [entity.md](entity.md) · 예외: [exception.md](exception.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **계층** | 추상 `Repository[T]`(core) → concrete `PostgresRepository`(infra) → wiring `{Aggregate}Repository`(domain) |
| **호출 규약** | stateless classmethod, 인스턴스화 금지, session은 메서드 인자 — **[INV-6]** |
| **write 계약** | base 단건 fetch/write는 `E \| None`, business 예외 raise 안 함. must-exist는 domain override — **[INV-3]** |
| **테넌트 스코프** | `tenanted_*` = team_id + repo 조건 + RLS, 접두사 없음 = 팀 경계 없음(RLS 테이블은 우회 뷰). team_id 받는 usecase는 `tenanted_*`만 |
| **query** | `_filter(where=[clause])` + `deleted_at IS NULL` 자동. 파이썬 후필터 금지 |
| **unique** | base `_ensure_unique`(`UniqueViolationError`) + domain 변환(`AlreadyExistsError`) 2계층 — **[INV-9]** |
| **KV** | `set_by_key` upsert는 domain에 직접(aggregate 1개라 일반화 안 함) |

---

## 계층 — 추상 / 일반화 / wiring

```
infrastructure/database/
  common/repository.py        Repository[T]            추상 classmethod (add/find_by_id/update/remove_by_id), 반환 E|None
  postgresql/repository.py    PostgresRepository[T,M]  query/CRUD 일반화 concrete 부모
domain/{agg}/{agg}_repository.py
                              {Aggregate}Repository    Model 동거 + class vars(model/mapper) + 커스텀 finder wiring
```

- 추상 계약(database/common): 단건 fetch/write 반환은 nullable(`Any | None`) — base는 business 예외 raise 안 함 ([INV-3])
- 일반화 부모(infra): 도메인이 2개 이상 entity에 같은 패턴을 반복하면 여기로 끌어올린다. 중간 파일(`infrastructure/database/postgresql/{agg}_repository.py`) 금지 — domain repo가 `PostgresRepository`를 직접 상속
- [INV-1] 완화의 범위는 이 상속까지. domain repo 파일은 `sqlalchemy.dialects.*`를 import하지 않는다 — 컬럼 타입은 방언 무관(`String`/`Uuid`/`DateTime`/`JSON`), 방언 문법(upsert 등)은 부모의 `_` 메서드 경유. `check_code_rules.py` hook가 검사
- wiring(domain): class variables(`model`/`mapper`)만 정의하면 base classmethod가 `cls.model`/`cls.mapper`로 동작(`__init__`/`__init_subclass__` 없음). 일반화 안 된 도메인 동작만 `@classmethod`로 직접 구현

---

## aggregate 폴더 — 루트 / 자식 엔티티

폴더 1개 = aggregate 1개. 루트는 폴더 바로 아래, 자식 엔티티는 하위 폴더. 테이블은 엔티티마다 나뉜다.

```
domain/{agg}/
  {agg}.py               루트 엔티티
  {agg}_repository.py    루트 Model + mapper + {Agg}Repository — aggregate의 유일한 repo
  {vo}.py                루트 VO
  {child}/
    {child}.py           자식 엔티티
    {child}_model.py     자식 Model(자기 테이블) + mapper — repository 없음
    {vo}.py              자식 VO
```

- 예외 — `domain/event/`는 폴더가 도메인 이름, 루트는 `EventGroup`(`event_group.py`·`event_group_repository.py`). 사실 하나(`Event`)가 아니라 묶음이 일관성 경계라서([domain-event.md](domain-event.md))
- 자식 폴더엔 `*_repository.py`가 없다 — 이것이 "별도 aggregate가 아니라 자식"이라는 표시. `check_code_rules.py` hook가 강제
- 자식은 루트 repo로만 접근. 루트 repo가 자식 Model을 import해 base 저수준 코어 `_rows_select`/`_rows_count`/`_rows_insert`/`_rows_update`에 `model=`로 넘긴다 — statement를 직접 조립하지 않는다(테넌트 규칙도 같이 적용되도록)
- 자식이냐 별도 aggregate냐 — 셋 다 yes면 자식:
  - 항상 루트와 함께 생기고 바뀌나
  - 루트(id)를 거쳐서만 조회하나
  - 루트와 함께 지켜야 하는 불변식이 있나

```
# good: 자식 — 항상 EventGroup과 함께 emit, event_group_id로만 조회, EventGroup 1건에 묶임
domain/event/event/

# good: 별도 aggregate — 로그인 때 따로 발급, 요청마다 fingerprint로 직접 조회
domain/account_token/
```

---

## 호출 규약 — stateless classmethod — [INV-6]

인스턴스/싱글톤 없이 클래스 자체로 호출. session은 모든 메서드의 `session=` kwarg(= transaction 경계, [usecase-flow.md](usecase-flow.md)).

```python
# (a) 순수 wiring
class VaultRepository(PostgresRepository[Vault, VaultModel]):
    model = VaultModel
    mapper = _to_vault

# (b) 커스텀 finder (1줄 delegation)
class SecretRepository(PostgresRepository[Secret, SecretModel]):
    model = SecretModel
    mapper = _to_secret

    @classmethod
    async def find_by_name(cls, *, session, name: Name) -> Secret | None:
        return await cls._find_by(session=session, column="name", value=name.to_str())
```

```python
# 호출 — 클래스 자체로
secret = await SecretRepository.add(session=session, entity=Secret.new(...))
found  = await SecretRepository.find_by_name(session=session, name=name)
```

- 제네릭이 타입 좁힘: `PostgresRepository[Secret, SecretModel]`라 `.add(...)` 반환은 이미 `Secret`. passthrough override 불필요
- `mapper` 바인딩: `mapper = _to_secret`은 `cls.mapper(model)` 언바운드 호출 — `self` 안 끼어 classmethod에서 안전

---

## CRUD + query 코어 (부모 제공)

- CRUD: 생성 `add`/`add_many`, 조회 public `find_by_id`/`find_by_ids`/`exists_by_id`/`list_all`, 수정 `update`/`update_many`, 삭제 `remove_by_id`
- query 코어 protected: `_filter`/`_find`/`_count`/`_page` + sugar `_find_by`/`_filter_by`/`_filter_by_all`/`_exists_by`, guard `_ensure_unique`, tenanted `_tenanted_*`, 저수준 `_rows_*(model=, tenanted=)`(아래 "테넌트 스코프") — pk 충돌 무시 삽입은 `_rows_insert(ignore_conflict=True)`(`ON CONFLICT DO NOTHING`)
- write 코어 protected: `_update(*, entity, where=[...])`/`_remove(*, id, where=[...])` — public `update`/`remove_by_id`가 위임. `where`는 `id`·`deleted_at IS NULL`에 AND로 붙는 추가 조건
- Postgres 방언(`sqlalchemy.dialects.postgresql`)은 이 부모만 import한다. domain repo에 방언 문법이 필요하면 사용처가 1곳이어도 `_` 메서드로 여기 올린다 — 끌어올리는 이유가 재사용이 아니라 계층([INV-1])이기 때문
- `_filter(*, where=[clauses], order_by, descending, limit, offset)` — `where` = SQLAlchemy boolean clause 리스트(전부 AND, `deleted_at IS NULL` 자동). plumbing(정렬/페이지/매핑/RETURNING)은 코어 소유 → 연산자 추가 시 코어 시그니처 불변

복합 쿼리 — clause 리스트: 여러 조건/연산자/OR은 모델 컬럼으로 clause를 만들어 `_filter(where=[...])`에 넘긴다:

```python
@classmethod
async def search(cls, *, session, kind=None, tag=None, query=None) -> list[Secret]:
    where = []
    if kind is not None:  where.append(SecretModel.kind == kind.to_str())
    if tag is not None:   where.append(SecretModel.tags.contains([tag]))   # JSON @>
    if query is not None: where.append(SecretModel.name.ilike(f"%{query}%"))
    return await cls._filter(session=session, where=where, order_by="name")

# OR/중첩도 SQLAlchemy 그대로
where = [sa.or_(SecretModel.name.ilike(f"%{q}%"), SecretModel.tags.contains([q]))]
```

> SQLAlchemy `Model`(`core/model.py`의 `Base` 상속)은 domain repo 파일에 동거(`SecretModel`/`SecretRepository`). mapper 함수(`_to_secret`)는 모듈 중간, 모듈 끝에 싱글톤 두지 않음.

---

## must-exist + write 반환 규약 — [INV-3]

write 메서드는 DB 반영 entity를 반환(`add -> E`, `add_many -> list[E]`, `update -> E | None`, `remove_by_id -> E | None`):

- `add`는 `flush` 후 server_default(`created_at`/`updated_at`) 채워진 model을 매퍼 변환해 반환
- `update`/`remove_by_id`는 `... RETURNING <model>`로 갱신/soft-delete 행을 한 문장에 받음(soft-delete 행은 `deleted_at IS NULL` 필터에 걸려 재조회 안 됨 → RETURNING이 정답)
- base는 `.first()`+`None`(`E | None`, raise 안 함) — 부재가 비정상인 **must-exist**면 domain repo가 `update`/`remove_by_id`를 override해 `None → NotFoundError`로 raise(반환을 `E`로 좁힘). `update`/`remove_by_id` 완전 대칭, "본문 있는 도메인 가드"라 passthrough-override 예외
  - 적용 조건: ① must-exist 의미일 때만(optional/멱등 upsert면 base 그대로, usecase가 `None` 분기) ② 본문 없는 단순 위임 금지 ③ base 계약(`E | None`)을 좁히므로 `None` 기대 호출처 없어야 함(끌어올리기 전 의존처 확인)
  - 효과: not-found 변환의 단일 발생처 = repo. usecase는 happy-path만

read도 동일 — `find_by_X`(optional, `E | None`) vs `get_by_X`(must-exist, `E`). 부재가 비정상인 조회는 도메인 repo가 `get_by_X`로 노출: `_find`(또는 base `find_by_id`) + `if None: raise` + 반환 `E`(`get_by_id`/`get_by_email`/`get_by_key`/`get_by_account_and_team`). write는 base override, read는 새 `get_` 메서드.

호출처(usecase·guard) 계약 — must-exist 조회에 `find_by_X` + `if None: raise`를 **인라인하지 않는다**. not-found 가드는 repo의 `get_by_X` 한 곳에만 산다. 필요한 `get_by_X`가 repo에 없으면 그걸 *추가*한다(guard를 호출처로 흘리지 말 것). `find_by_X`는 부재가 정상(optional·분기·멱등)일 때만 호출처가 직접 쓰고 `None`을 분기한다.

repo가 부재에 raise하는 예외는 `NotFoundError`(및 aggregate 맞춤 not-found 계열)뿐 — 401/403 같은 인증·인가 정책은 repo가 정하지 않는다. 부재가 정책 실패를 뜻하면 repo는 사실만 반환하고 호출처(behavior·usecase)가 정책 예외로 바꾼다(위 인라인 금지의 예외):

- 엔티티가 필요하면 `find_*` → `E | None`. 예: `AccountTokenRepository.find_valid_by_fingerprint`(None → behavior `UnauthorizedError`), `AccountRepository.find_by_email`(None → usecase `InvalidCredentialError`)
- 엔티티 없이 조건 충족 여부만 필요하면 `verify_*` → `bool`. 예: `TeamAccessRepository.verify_by_account_and_team`(False → behavior `ForbiddenError`)

`verify_*` vs `exists_by_X`: 둘 다 `bool`. `exists_by_X`는 단일 컬럼 존재, `verify_*`는 도메인 조건이 붙은 질문(멤버십·유효기간 등). 호출처가 엔티티를 쓰면 `verify_*` 후 재조회하지 말고 `find_*` 하나로.

usecase는 반환 entity를 `to_dict()` — 생성/수정 응답에도 타임스탬프 일관. exists는 의도대로 `bool` 유지.

---

## 테넌트 스코프 — `tenanted_*` / 접두사 없음

테넌트 격리는 이중 방어 — repo의 팀 조건 + DB RLS(`infrastructure/database/postgresql/rls.py`). repo 메서드는 두 종류뿐이고, 이름이 종류를 드러낸다. 읽기·쓰기 모두 같다:

| 이름 | team_id | repo 팀 조건 | RLS | 의미 |
|------|---------|-------------|-----|------|
| `tenanted_*` | 받음 | 건다 | 받는다(테이블 직접) | 팀 경계 안 |
| 접두사 없음 | 안 받음 | 없음 | RLS 테이블이면 우회 뷰 경유 | 팀 경계 없음 |

- 모든 repo에 같은 규칙. 팀 없는 aggregate(account·setting 등)는 원래 팀 경계가 없으니 기존 이름 그대로가 곧 규칙 준수
- `tenanted_*`는 RLS 테이블의 aggregate에만 — team_id로 거르지만 RLS 없는 테이블(team_access 등)은 접두사 없이 둔다
- 기준은 "WHERE에 팀 조건이 걸리나" — 팀은 인자(`team_id`)로도, entity(`entity.team_id`)로도 온다
- 접두사 없는 동작은 정상 경로일 수 있다 — 팀 없는 기록(비로그인·admin), worker의 claim/succeed/fail 등. 누가 부를 수 있나는 behavior 인가가 정한다
- **`team_id`를 받는 usecase 함수 안에서는 RLS repo를 `tenanted_*`로만 부른다** — 팀 맥락에서 접두사를 빠뜨리면 두 방어선이 한 번에 사라지므로(fail-open) `check_code_rules.py` hook가 강제

```python
# good: 팀 경계 안 — repo 조건 + RLS
secret = await SecretRepository.tenanted_get_by_id(
    session=session,
    id=UUID(input.id),
    team_id=team_id,
)

# bad: team_id 받는 usecase에서 RLS repo를 접두사 없이 — repo 필터도 RLS도 없음 (봉인 테스트 실패)
secret = await SecretRepository.find_by_id(
    session=session,
    id=UUID(input.id),
)
```

tenanted 헬퍼(부모 제공, 팀 조건을 스스로 붙임):

- 읽기 `_tenanted_filter`/`_tenanted_find`/`_tenanted_count(*, team_id, where=[...])`
- 쓰기 `_tenanted_add(*, entity)`/`_tenanted_update(*, entity, team_id)`/`_tenanted_remove(*, id, team_id)`
- update의 팀 조건은 소유권 이동 방지 — `to_model()`이 `team_id`까지 SET하므로 WHERE가 `id`만이면 team_id가 바뀐 entity가 행을 다른 팀으로 옮긴다. 팀 조건이 있으면 불일치 → `NotFoundError`

### 메커니즘 — RLS 테이블마다 우회 뷰

`apply_rls`가 RLS 테이블마다 정책과 우회 뷰 `untenanted_{table}`(`CREATE VIEW ... AS SELECT * FROM {table}`)를 만든다. 단순 뷰는 읽기·쓰기가 원래 테이블로 전달되고, RLS는 뷰 소유자 기준으로 판정된다(`security_invoker` 꺼짐, 기본값).

```
base 저수준 코어 _rows_select / _rows_count / _rows_insert / _rows_update (model=, tenanted=)
  tenanted=True  또는 RLS 아닌 테이블 → {table}              RLS 적용
  tenanted=False 이고 RLS 테이블      → untenanted_{table}   우회
```

- 정책 대상은 두 종류 — 팀 컬럼을 가진 테이블(`_TENANT_COLUMNS`: `team_id IS NOT DISTINCT FROM 현재 팀`)과 부모를 따라가는 자식 테이블(`_TENANT_PARENTS`: `EXISTS (부모에서 id = 자식.fk)`, 부모 RLS가 그대로 적용됨)
- 부모 헬퍼(`_filter`/`_count`/`add`/`_update` 등)는 `cls.model`로, 자식 테이블은 루트 repo가 `_rows_*`에 `model=`을 넘겨 같은 규칙으로 다룬다
- 뷰 이름은 infra만 안다 — `rls.py`·`postgresql/repository.py` 밖에 나오면 `check_code_rules.py` hook가 막음
- 뷰는 만들 때의 컬럼으로 고정 — `apply_rls`가 부팅마다 DROP 후 CREATE. `drop_rls`는 테이블 drop 전에 뷰와 정책을 지운다(자식 정책이 부모 테이블에 의존)
- 계정 분리 — DDL(테이블·정책·뷰)은 관리자 연결이 만든다(`python -m ...postgresql.client`, `*_POSTGRES_USER`). 같은 DDL이 앱 일반 계정(`*_POSTGRES_APP_USER`, NOSUPERUSER·NOBYPASSRLS)을 만들고 권한을 준다(`role.py`). 런타임(`db_client`·LISTEN)은 일반 계정 — 그래야 RLS가 실제로 걸린다. 뷰 소유자는 관리자라 우회가 성립한다
- 테스트도 일반 계정으로 돈다 — 하네스가 기본 팀(`DEFAULT_TEAM_ID`) 맥락을 걸고, 다른 팀은 `in_team(session, team_id)`로 바꾼다(behavior가 운영에서 하는 일)
- 우회 범위 — 뷰는 읽기·쓰기 모두 우회한다. 쓰기 우회가 필요한 aggregate(event)가 있어서 치르는 대가이고, 호출 경로는 이름(`tenanted_*` 유무)과 봉인 테스트로 좁힌다

---

## unique 강제 — 2계층 — [INV-9]

유일성은 base 사전검사 guard + 도메인 변환의 2계층. domain repo가 `{action}_unique_by_{col}`로 노출한다.

- base `_ensure_unique(*, session, entity, unique: list[str | tuple], exclude_id=None) -> None`: `unique`의 각 원소 = 제약 1개 — `str`은 단일 컬럼, `tuple`은 복합(그룹 내 컬럼 AND). 제약마다 `_count` 검사, 있으면 infra `UniqueViolationError`(`database/common/exception.py`, 409) raise. update 자기 행은 `exclude_id`로 제외. `deleted_at IS NULL` 자동(soft-delete된 이름 재사용 허용, partial unique index와 일치)
- domain 변환: `try/except`로 `UniqueViolationError`(infra) → `AlreadyExistsError`(domain). base는 도메인 예외를 모른다
- 식별자: 단일 키는 값 그대로(`entity.name.to_str()`), 복합 키는 raise 자리에서 f-string으로 `/` 연결. join 헬퍼 함수를 따로 두지 않는다
- 메서드명에 유일 컬럼 명시(`add_unique_by_name`/`update_unique_by_name`), 복합키는 tuple로 묶는다 — `add_unique_by_name_and_kind` + `unique=[("name", "kind")]` (`["name", "kind"]`는 두 컬럼을 *각각* 검사하는 OR이라 복합 아님)
- write는 `_ensure_unique` 밖에서 호출 — `cls.add`는 `-> E`, `cls.update`는 도메인 must-exist override라 `-> E`. update는 `exclude_id=entity.id`로 자기 행 제외
- 경합은 안 잡는다 — 무결성 단일 출처는 테이블 partial unique index, guard는 1차 방어(흔한 충돌에 깔끔한 메시지). 뚫은 동시 삽입은 raw `IntegrityError` → 500

```python
@classmethod
async def add_unique_by_name(cls, *, session, entity: Secret) -> Secret:
    try:
        await cls._ensure_unique(session=session, entity=entity, unique=["name"])
    except UniqueViolationError:
        raise AlreadyExistsError("Secret", entity.name.to_str())
    return await cls.add(session=session, entity=entity)

# good: 복합 키 — raise 자리에서 f-string
raise AlreadyExistsError("TeamAccess", f"{entity.account_id}/{entity.team_id}")

# bad: 복합 키 식별자용 모듈 헬퍼
raise AlreadyExistsError("Secret", _path(entity))
```

---

## KV 패턴

`setting` aggregate가 실례. entity `.new(*, key, value)` + `.with_value(value)`, model `key` 컬럼(active partial unique index) + `value` JSON. `set_by_key`(upsert)는 domain repo에 직접 — `find_by_key` → 있으면 base `update`, 없으면 base `add`. upsert라 충돌 reject 안 하므로 `_ensure_unique` 안 씀(중복 키는 갱신). KV aggregate가 1개뿐이라 base로 끌어올리지 않는다(위 "일반화 부모": 2개 이상일 때 일반화). 2번째 KV 생기면 `set_by_key`(+배치 `set_by_keys`)를 `PostgresRepository`로 일반화.

---

## 부모 vs 자식 판정

- entity 1개에만 쓰이고 일반화 어려움 → domain repository classmethod로
- 2개 이상 entity에 패턴 반복 → `PostgresRepository`로 끌어올리기 + entity 컨벤션(`with_X`/`new(*, key, value)`) 합의

---

## 안티패턴

- domain repo가 `select(...).where(...)` 문 전체 작성(plumbing 재구현) → 코어 위임. 단 `Model.col == v` clause를 `_filter(where=[...])`에 넘기는 건 정석
- fetch 후 파이썬 후필터/정렬/슬라이싱(`[x for x in ...]`, `sorted`, `[:n]`) → `_filter(where=[...])` + `order_by` + `limit`/`offset`(페이지는 `_page`)
- 존재 확인을 `find_by_X(...) is not None`(entity 전체 fetch) → `exists_by_X`(`_exists_by`, count 기반 `bool`)
- must-exist 조회를 호출처에서 `find_by_X` + `if None: raise` 인라인 → repo의 `get_by_X`(`find` + `if None: raise` + `-> E`). 없으면 repo에 추가, usecase는 happy-path만 ([INV-3])
- repo가 부재를 401/403으로 raise(`get_valid_*`/`verify_*`가 예외 던짐) → repo는 `find_*`(`E | None`)/`verify_*`(`bool`), 정책 예외는 호출처
- RLS 테이블 repo에 팀 조건 메서드를 접두사 없이(`get_by_id(id, team_id)`) → `tenanted_get_by_id`. 이름이 종류를 드러내야 봉인 테스트가 가른다
- team_id 받는 usecase에서 RLS repo를 접두사 없이 호출 → `tenanted_*` (`check_code_rules.py` hook)
- tenanted 조회를 `_filter(where=[Model.team_id == t])`로 구현 → `_filter`는 RLS 테이블에서 우회 뷰를 타므로 RLS가 빠진다. `_tenanted_filter(team_id=t)`
- 우회 뷰(`untenanted_{table}`)를 repo 밖에서 직접 쿼리 → 접두사 없는 repo 메서드 경유 (`check_code_rules.py` hook)
- 자식 테이블을 루트 repo에서 `session.add_all`/`select(ChildModel)`로 직접 → `_rows_*(model=ChildModel, tenanted=...)`
- domain repo `__init__`/`__init_subclass__` → `model`/`mapper` class variable만
- domain repo 메서드를 인스턴스 메서드(`self`)로 / repo 싱글톤·인스턴스화 → 전부 `@classmethod`, 클래스 자체 호출 ([INV-6])
- base CRUD passthrough override(`async def add(...): return await super().add(...)`) → 제네릭이 타입 좁힘. 본문 있는 도메인 가드일 때만 override
- `infrastructure/database/postgresql/{agg}_repository.py` 중간 파일 → domain repo가 `PostgresRepository` 직접 상속
- unique 충돌을 usecase에서 검사·raise → domain `{action}_unique_by_{col}` ([INV-9])
