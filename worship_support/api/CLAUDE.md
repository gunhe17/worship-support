# CLAUDE.md

## 0. code

작성된 규칙을 잘 준수해서 api server를 구현해라.

## 1. 레이어 의존 방향 — [INV-1]

의존은 한 방향 — 하위만 의존하고 상위는 모른다. 어댑터(`server/`·`worker/`)는 도메인 무지(`Callable`만).

    bin/  →  server/ worker/  →  endpoint/(internal/)  →  behavior/
      →  usecase/  →  { domain/ , infrastructure/ }  →  core/  ·  config.py

- 왼→오 방향으로만 import. 역방향(`domain`이 `usecase`를, `core`가 무엇이든) 금지.
- `core/`는 내부 import 0 — 상위·타 레이어를 모른다. 서드파티는 허용 화이트리스트만(프레임워크 베이스 — ORM `DeclarativeBase`·입력 스키마 `BaseModel`). `domain/` ⊥ `infrastructure/` — 서로 모른다(usecase가 주입).
- 완화 1건: `domain/*_repository.py`가 `infrastructure/database/postgresql/repository.py`의 `PostgresRepository`를 상속(repository.md). 완화는 상속까지 — domain은 `sqlalchemy.dialects.*`를 import하지 않는다.

## 2. INV 레지스트리

`[INV-N]` 인용의 단일 해소처. 한 줄 정의는 여기가 권위, 패턴은 확장 rule이 소유.

| INV | 한 줄 정의 | 성격 | 확장 |
|---|---|---|---|
| INV-1 | 레이어 의존 방향 — 하위만 의존, 상위 모름 | 공리 | (위) |
| INV-2 | VO = frozen dataclass + `by_factory` 팩토리 강제 | 공리 | value-object.md |
| INV-3 | must-exist 조회는 repo가 `None→raise`, usecase 가드 금지 | 관례 | repository.md |
| INV-4 | 모든 예외는 `ClientError`/`DevelopError`로 귀결 | 공리 | exception.md |
| INV-5 | 같은 session=transaction, usecase 1개=1 트랜잭션 | 관례 | usecase-flow.md |
| INV-6 | repository는 stateless classmethod (인스턴스화 안 함) | 관례 | repository.md |
| INV-7 | 도메인 이벤트(Event)는 순수 (자기 aggregate만, IO 0) | 공리 | domain-event.md |
| INV-8 | usecase는 항상 `Output(data, event)` 반환 | 관례 | usecase-flow.md |
| INV-9 | unique 충돌은 domain repo가 강제 (usecase 사전검사 금지) | 관례 | usecase-flow.md |
| INV-10 | 도메인 값은 전부 VO (예외: UUID id/FK·audit datetime) | 공리 | value-object.md |

- 공리(종류·동일성·본질)를 어기면 종류 체계가 바뀐다 → 국소 판단 말고 설계 재검토.
- 관례(코드 위치·모양)를 어기면 일관성 손해 → 국소 판단 가능하나 사유를 남긴다.

## 3. 새 요소 판단 절차

파일 위치를 묻기 전에:

1. identity — 무엇이 둘을 같게 하나? 값이면 Value(frozen+factory), 참조면 Entity(UUID), 발생이면 `event_id`(멱등).
2. noun/verb — 존재냐 행위냐? 섞였으면 가른다(명사=봉투/pure-op/VO, 동사=action/usecase).
3. essence/accident — 개체가 본질로 아는 것만 담았나? 맥락값(actor·team·묶음)은 경계(emit·behavior)가 스탬프.
