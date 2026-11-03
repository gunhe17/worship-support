---
paths:
  - "worship_support/api/domain/**/*.py"
  - "worship_support/api/core/entity.py"
---

# Entity 패턴

aggregate 루트 — frozen dataclass + `new` 팩토리 + `to_dict`(API)/`to_model`(DB) + `with_X` evolve. `domain/{aggregate}/{aggregate}.py`에 산다. 자식 엔티티는 `domain/{aggregate}/{child}/{child}.py`([repository.md](repository.md) "aggregate 폴더").

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · VO: [value-object.md](value-object.md) · 영속화: [repository.md](repository.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **베이스** | `Entity` 상속 → `by_factory` 가드(**[INV-2]**) + raw `UUID id` + audit datetime 자동 소유 |
| **팩토리** | `@classmethod @typecheck def new(*, ...)` |
| **변환** | `to_dict`(API, id 포함) / `to_model`(DB, `id` 필수) |
| **evolve** | `with_X`(immutable 교체) / 상태 전이는 동사 메서드. mutating 금지 |
| **필드** | 도메인 값은 전부 VO — **[INV-10]** ([value-object.md](value-object.md)) |

---

## 베이스가 정하는 것 — id / audit datetime

> 온톨로지 · identity: Entity는 참조로 동일(같은 id면 같은 개체, 필드가 달라도) — 값(VO, 구조 동일성)과 다른 종류라 raw `UUID id`를 지닌다.

`Entity`(`core/entity.py`)가 raw `UUID id`와 `created_at`/`updated_at`/`deleted_at`(raw `datetime`)을 "보이지 않게" 소유한다. 둘 다 도메인 VO가 아니라 프레임워크 필드라 raw 유지(**[INV-10]** 예외):

- `id` — `UUID`, 생성자가 형식 보장하는 강타입. `to_dict`에서만 `str(self.id)`, `to_model`은 native
- audit datetime — write는 DB 소유(`server_default`/soft-delete), `to_model`에선 제외. 매퍼가 로드 시 채우고 `to_dict`는 `.isoformat()`로 직렬화(이 셋 + `id`만 직접 호출 허용). fresh entity(`new()`/`with_*`)에선 `None`, DB-로드/RETURNING 결과에서만 채워짐

---

## 패턴

- `Entity` 상속 필수 → `by_factory=True` 가드, UUID id 자동
- 팩토리: `@classmethod @typecheck def new(*, ...)` — 키워드 전용
- `to_dict()`: API 응답용 (id 포함, UUID → str, datetime VO → `to_str()`)
- `to_model()`: DB 저장용 (**`"id": self.id` 반드시 포함** — model의 id 컬럼은 DB default 없어 INSERT 시 필수. UUID/datetime은 native)
- `with_X()`: immutable evolve. 단순 필드 교체는 `with_value`, 도메인 상태 전이는 동사 메서드(예: `decide(*, status, decided_at, ...)` — 결정 필드 필수로 받아 부분 업데이트 데이터 유실 방지). frozen이라 mutating(`.update_value(...)`) 금지

```python
@dataclass(frozen=True, kw_only=True)
class Secret(CoreEntity):
    name: Name
    expires_at: ExpiresAt | None = None

    @classmethod
    @typecheck
    def new(cls, *, name: Name, expires_at: ExpiresAt | None = None) -> "Secret":
        return cls(name=name, expires_at=expires_at, by_factory=True)

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name.to_str(),
            "expires_at": (
                self.expires_at.to_str() if self.expires_at else None
            ),
        }

    def to_model(self):
        return {
            "id": self.id,
            "name": self.name.to_str(),
            "expires_at": (
                self.expires_at.to_datetime() if self.expires_at else None
            ),
        }
```

변환 메서드 요약:

| 방향 | ValueObject | Entity |
|------|-------------|--------|
| 입력 | `from_str` / `from_dict` / `from_datetime` / `from_bool` / `from_int` / `from_bytes` | `new` |
| 출력 | `to_str` / `to_dict` / `to_bool` / `to_int` (시간 VO `+ to_datetime`, blob VO `+ to_bytes`) | `to_dict`, `to_model` |

> `@typecheck`(`core/validate.py`)는 인자 런타임 타입 검사 데코레이터 — 불일치 시 `DevelopError`. 팩토리·usecase에 부착([conventions.md](../shared/conventions.md)).

---

## 안티패턴

- `Secret(name=...)` 직접 생성 → `Secret.new(...)` ([INV-2])
- Entity에 `.update_value(value)` mutating → `.with_value(value)` evolve(frozen)
- `to_model`에서 `id` 누락 → INSERT 실패(DB default 없음)
- 도메인 값을 raw primitive로 → VO ([INV-10], [value-object.md](value-object.md))
- id/FK를 별도 VO로 감쌈 → raw `UUID` 유지
