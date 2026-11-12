---
paths:
  - "worship_support/api/domain/**/*.py"
  - "worship_support/api/core/value_object.py"
---

# ValueObject 패턴

도메인 값을 감싸는 frozen dataclass + 검증 팩토리. `domain/{aggregate}/{value}.py`에 산다.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · 공통 스타일: [conventions.md](../shared/conventions.md) · 베이스: [repository.md](repository.md)는 별개

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **Dataclass + Factory** | `@dataclass(frozen=True, kw_only=True)`, 필드 `_` 접두, `by_factory` 가드로 직접 생성 차단 — **[INV-2]** |
| **팩토리 종류** | `from_str`/`from_dict`/`from_datetime`/`from_bool`/`from_int`/`from_bytes`, 단일 `value` positional |
| **검증 순서** | type(`InvalidError`) → format(`InvalidFormatError`) → range/규칙 |
| **raw primitive 금지** | 도메인 값은 전부 VO로. 예외는 UUID id/FK + audit datetime뿐 — **[INV-10]** |

---

## Dataclass + Factory 강제 — [INV-2]

> 온톨로지 · identity: 값은 구조로 동일(내용이 같으면 같음) — `by_factory`는 검증된 구성만 그 값이 되게 하는 동일성 게이트. Entity(참조 동일성)와 다른 종류.

`@dataclass(frozen=True, kw_only=True)`, 필드명 `_` 접두. 베이스(`core/value_object.py`)가 `by_factory`로 직접 생성을 차단하므로 서브클래스는 `cls.from_*(...)` 팩토리만 쓴다.

```python
@dataclass(frozen=True, kw_only=True)
class ValueObject:                       # core/value_object.py
    by_factory: InitVar[bool] = False
    def __post_init__(self, by_factory: bool):
        if not by_factory:
            raise  # DevelopError (core 가드는 새 예외 없이 직접 raise)
```

팩토리: `from_str`(단순) / `from_dict`(복합) / `from_datetime`(시간) / `from_bool`(플래그) / `from_int`(수량·금액) / `from_bytes`(blob) / `from_json`(polymorphic JSON scalar|list). 전부 `@classmethod`, 단일 `value` positional 인자(VO는 인자 하나라 positional — `Name.from_str(x)`), 반환 타입 = forward reference 문자열.
변환: `to_str` / `to_dict` / `to_bool` / `to_int` (+ 시간 VO는 DB용 native `to_datetime`, blob VO는 `to_bytes`).
검증 순서: type (`InvalidError`) → format (`InvalidFormatError`) → range/규칙. (예외 → [exception.md](exception.md))

### hint — `ClassVar`로 선언

hint(`_allowed_list`·`_pattern`·`_max_length`·`_sensitivity` 등)는 그 VO 종류 전체가 공유하는 상수다(type 쪽 사실). 값마다 다른 건 `_value`뿐.

- `@dataclass`는 타입 힌트가 붙은 이름을 **전부 인스턴스 필드로** 만든다 — 생성자 인자·`repr`·`==`·`hash`·`replace()`에 포함. 그냥 `_pattern: str = ...`로 쓰면 상수가 값마다 덮어쓸 수 있는 입력칸이 된다
- `ClassVar[...]`로 감싸면 dataclass가 필드에서 제외 → 클래스 변수로 남는다. 읽기는 그대로(`cls._pattern`)
- `from __future__ import annotations`라 힌트가 문자열이어도 dataclass가 `ClassVar`를 알아보려면 그 모듈에 `from typing import ClassVar` import가 있어야 한다

```python
# good: 종류 상수 — 필드 아님
_pattern: ClassVar[str] = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"

# bad: 인스턴스 필드가 됨 — Domain(_value="x", _pattern=".*", by_factory=True) 가능
_pattern: str = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"
```

```python
# 단순 값 — from_str / to_str
@dataclass(frozen=True, kw_only=True)
class Name(CoreValueObject):
    _value: str
    @classmethod
    def from_str(cls, value) -> "Name":
        if not isinstance(value, str) or not value.strip():
            raise InvalidFormatError("Name")
        return cls(_value=value, by_factory=True)
    def to_str(self) -> str:
        return self._value

# enum 성격 — 허용값을 _allowed_list hint로 분리 (로컬/inline 튜플 금지)
@dataclass(frozen=True, kw_only=True)
class Role(CoreValueObject):
    _value: str

    # hint
    _allowed_list: ClassVar[tuple[str, ...]] = ("super_admin", "viewer")

    @classmethod
    def from_str(cls, value) -> "Role":
        if not isinstance(value, str):
            raise InvalidError("Role")
        # format
        if value not in cls._allowed_list:
            raise InvalidFormatError("Role")
        return cls(_value=value, by_factory=True)
    def to_str(self) -> str:
        return self._value

# 시간 값 — from_datetime / to_str(API) + to_datetime(DB)
@dataclass(frozen=True, kw_only=True)
class OccurredAt(CoreValueObject):
    _value: datetime
    @classmethod
    def from_datetime(cls, value) -> "OccurredAt":
        if not isinstance(value, datetime):
            raise InvalidError("OccurredAt")
        return cls(_value=value, by_factory=True)
    def to_str(self) -> str:            # API 직렬화 (to_dict)
        return self._value.isoformat()
    def to_datetime(self) -> datetime:  # DB 저장 (to_model)
        return self._value

# bool 플래그 — isinstance(1, bool) == False → int 거부
@dataclass(frozen=True, kw_only=True)
class IsChecked(CoreValueObject):
    _value: bool
    @classmethod
    def from_bool(cls, value) -> "IsChecked":
        if not isinstance(value, bool):
            raise InvalidError("IsChecked")
        return cls(_value=value, by_factory=True)
    def to_bool(self) -> bool:
        return self._value

# 복합 값 — from_dict / to_dict (dict(value)로 방어적 복사)
@dataclass(frozen=True, kw_only=True)
class Address(CoreValueObject):
    _text: str
    _latitude: float
    _longitude: float
    @classmethod
    def from_dict(cls, value) -> "Address":
        if not isinstance(value, dict):
            raise InvalidError("Address")
        text = value.get("text")
        if not isinstance(text, str) or not text.strip():
            raise InvalidFormatError("Address.text")
        latitude = float(value.get("latitude"))
        if not (-90.0 <= latitude <= 90.0):
            raise InvalidFormatError("Address.latitude")
        return cls(_text=text, _latitude=latitude, _longitude=float(value.get("longitude")), by_factory=True)
    def to_dict(self) -> dict:
        return {"text": self._text, "latitude": self._latitude, "longitude": self._longitude}
```

---

## raw primitive 금지 — [INV-10]

> 온톨로지 · identity: 도메인 값 = 검증된 종류라 VO. raw primitive는 종류를 흐린다. UUID·audit만 예외 — 이미 강타입/프레임워크 필드라 감싸도 종류가 안 는다.

도메인 값(`str`/`int`/`bool`/`datetime`/`dict`)은 전부 VO로 승격. Entity 필드도 마찬가지([entity.md](entity.md)). 예외는 둘뿐:

- `UUID` (id / FK / `request_id` / `idempotency_key`) — 생성자가 형식을 보장하는 이미 검증된 강타입이라 raw 유지. `isinstance(x, UUID)` 가드는 동어반복. FK별 별도 타입(`SecretId`/`VaultId`)·단일 공용 `Id` VO는 복잡도 대비 이득 없어 보류 — id 혼동은 리뷰/테스트로 커버
- `created_at`/`updated_at`/`deleted_at` — read-only audit 필드, DB 소유([entity.md](entity.md) "id/audit")

세부 규칙:
- aggregate 무관 공용 VO는 `core/value_object.py`에 — `Act`(이벤트 동작, 닫힌 집합), `Id`(UUID 참조 기반, aggregate별 하위 타입이 상속). core는 domain 예외를 모르므로 둘 다 `DevelopError`
- datetime은 raw stdlib로 두지 않는다 — aggregate별 VO(`occurred_at.py` → `OccurredAt`). 시간 VO만 `to_datetime`(DateTime 컬럼)으로 갈림, 단순/복합 VO는 String/JSON라 `to_model`도 `to_str()`/`to_dict()` 그대로
- enum 성격 VO는 `_allowed_list` hint(`ClassVar[tuple[str, ...]]`)로 분리 — 불변 공유 상수라 튜플. `Role._allowed_list`로 테스트·API enum 재사용
- bool도 VO로 — `from_bool`/`to_bool`. 단 repo finder가 DB 컬럼 직접 조회 시(`_filter_by(column="is_checked", value=False)`)는 원시 bool(VO는 도메인 경계용, 쿼리 파라미터는 컬럼 타입)
- freeform `dict`도 복합 VO로 — `dict(value)`로 방어적 복사(raw dict는 unhashable → frozen 불변성 깨짐)
- polymorphic JSON 값(scalar 또는 list)은 `from_json`/`to_json` — `Setting.Value`처럼 `str`/`dict` 어느 표준 변환자에도 안 맞는 union을 JSON에 저장할 때 쓰는 전용 변환자. list는 불변성 위해 `tuple`로 보관, `to_json`에서 `list`로 복원. dict/None 등 중첩은 거부
- 식별 키성 str(`idempotency_key`)은 non-empty VO + 모델은 `nullable=True` + partial unique index(`WHERE col IS NOT NULL`)

---

## 안티패턴

- `Name(_value="x")` 직접 생성 → `Name.from_str("x")` 팩토리 (**[INV-2]**)
- 도메인 값을 raw `str`/`datetime`/`dict`로 Entity 필드에 → VO로 승격 ([INV-10], UUID·audit만 예외)
- enum 허용값을 inline 튜플/로컬 변수로 → `_allowed_list` hint
- 다인자 VO 팩토리(`from_x(a, b)`) → 단일 `value` 인자(복합값은 `from_dict`)
