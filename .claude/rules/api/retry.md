---
paths:
  - "worship_support/api/behavior/worker.py"
  - "worship_support/api/behavior/action/job.py"
  - "worship_support/api/domain/event/reaction/**"
  - "worship_support/api/usecase/event_dispatch.py"
  - "worship_support/api/core/exception.py"
  - "worship_support/api/infrastructure/**/exception.py"
---

# retry

실패한 작업의 재시도 — 주체는 하나, 단위는 트랜잭션. in-process 재시도(같은 트랜잭션 안에서 sleep 후 다시)는 두지 않는다.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · 예외: [exception.md](exception.md) · 큐: [domain-event.md](domain-event.md) · UoW: [behavior.md](behavior.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 단위 | 트랜잭션 — 실패하면 전부 롤백, 새 트랜잭션에서 처음부터 다시 |
| 역할 | 분류 = 예외(`retryable`) · 판정 = 트랜잭션을 여는 UoW 한 곳 · 규칙 = `Reaction.fail` · 숫자 = `ReactionConfig` |
| `retryable` | 클래스 기본값 + raise 자리 덮어쓰기. 기본 `False`, 속성 없는 raw 예외도 `False` |
| 금지 | in-process 재시도 · usecase가 실패를 잡아 판정 · 판정 지점 둘 이상 |

---

## 단위 — 트랜잭션

트랜잭션 안에서는 다시 시도하지 않는다.

- DB 연산은 원래 불가 — 오류 한 번이면 세션이 오염(`PendingRollbackError`)
- 외부 호출도 안 함 — 대기 동안 DB 연결·lease를 쥔다. 긴 장애(분·시간)는 어차피 큐가 필요해 두 층이 곱해진다
- 실패 → UoW가 롤백 → 실패 기록만 새 트랜잭션에 커밋 → 큐가 `next_attempt_at`에 새 트랜잭션에서 재실행

## 역할 — 누가 무엇을

| 무엇 | 어디 | 하는 일 |
|------|------|---------|
| 분류 | 예외 클래스 / raise 자리 (주로 어댑터) | `retryable` — 다시 해도 되는 오류인가 |
| 판정 | 트랜잭션을 여는 UoW (`behavior/worker.py`) | 예외를 받는 유일한 곳 → `Job.fail(error=...)` 후 삼킴(로그 1줄) |
| 규칙 | `Reaction.fail(retryable, max_attempts, backoff…)` | retryable이면 attempts+1·지수 백오프·상한 시 failed, 아니면 즉시 failed |
| 숫자 | `config.py` `ReactionConfig` | 최대 횟수·백오프·lease |

- `worker/`(어댑터)는 도메인 무지라 재시도를 모른다 — 루프만 돈다([INV-1])
- usecase(`event_dispatch`·reaction)는 실행만 — 실패를 잡지 않는다
- UoW가 삼키는 이유: drain 루프가 실패 한 건에 멈추지 않고 다음 reaction으로 진행

## `retryable` — 클래스 기본값 + 인스턴스 덮어쓰기

```python
# 종류의 기본값 — 클래스 속성
class ApplicationError(Exception):
    retryable: bool = False

class NotificationTransientError(NotificationError):
    retryable = True                      # 어댑터가 일시적 오류를 이 종류로 던짐

# raise 자리에서 그 건만 덮어씀 — base __init__ 인자
raise SomeError(..., retryable=True)

# 판정 (UoW 한 곳)
retryable = getattr(error, "retryable", False)
```

- 기본은 종류로 가른다(`NotificationError` / `NotificationTransientError`). 같은 종류를 자리마다 갈라야 할 때만 인스턴스 인자 — 덮어쓰기는 분류를 아는 곳(어댑터 경계) 안에서만
- 구체 예외의 `__init__`는 필요해질 때 `retryable`을 받아 base로 넘긴다
- `ClassVar`가 아니다 — 예외는 dataclass가 아니고, 인스턴스 덮어쓰기를 허용하는 평범한 클래스 속성이라서
- raw 예외(속성 없음)는 `False` — 어댑터가 typed로 바꿨어야 할 버그([INV-4])라 반복하지 않고 즉시 failed

## 안티패턴

- 같은 트랜잭션 안에서 sleep 후 재시도(in-process) → UoW 롤백 + 큐 재실행
- usecase가 `try/except`로 실패를 잡아 fail 기록 → UoW 한 곳이 판정
- 판정·`fail` 호출 경로가 둘 이상(정상 실패/크래시 따로) → 하나로
- 재시도 가능성을 호출부 바깥 규칙(오류 메시지 문자열 매칭 등)으로 → 예외의 `retryable`
- 영구 오류(수신자 거부 등)를 `retryable=True`로 → 상한까지 헛돈다. 종류를 가른다
