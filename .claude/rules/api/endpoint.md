---
paths:
  - "worship_support/api/endpoint/*.py"
---

# endpoint 패턴

FastAPI route handlers. usecase 호출 + HTTP 응답 변환. 비즈니스 로직 0. `endpoint/{aggregate}.py`에 산다.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · 흐름: [usecase-flow.md](usecase-flow.md) · 등록: [server.md](server.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **책임** | usecase 호출 + HTTP 응답 변환만. 비즈니스 로직 0 |
| **핸들러 네이밍** | HTTP 메서드 접두 — `post_create` / `get_reveal` |
| **등록** | endpoint가 아니라 합성 루트 `bin/server.py`에서 ([server.md](server.md)) |

---

## 책임 + 패턴

aggregate별 route handler 모음(`secret.py`). usecase 함수를 호출하고 결과(`Output`)를 `.to_dict()`로 직렬화해 HTTP 응답으로 변환만 한다 — **[INV-8]**.

```python
from fastapi import Depends
from starlette.responses import JSONResponse

from worship_support.api.behavior import use_postgresql_session_with_event
from worship_support.api.behavior import use_postgresql_context_with_event
from worship_support.api.usecase import auth_register

# #
# command

async def post_register(
    body: auth_register.Input,
    *,
    session=Depends(use_postgresql_session_with_event),
    context=Depends(use_postgresql_context_with_event),
) -> JSONResponse:
    registered = await auth_register.register(
        session=session,
        event_group_id=context.event_group_id,
        input=body,
    )
    return JSONResponse(status_code=200, content=registered.to_dict())
```

- 핸들러는 HTTP 메서드 접두 — `post_create`/`get_reveal`. 라우트 메서드를 이름에서 바로 읽는다(usecase 함수명 `create`/`reveal`과 구분)
- session·context는 behavior splitter 두 의존성으로 주입받는다 ([behavior.md](behavior.md), [INV-5]) — `session`은 usecase에 넘기고 `event_group_id`/`account_id`/`team_id`는 `context`(Scope)에서 꺼내 전달. 라우트 레벨(미인증/account/team/owner)이 splitter 이름으로 갈린다
- 검증/도메인 조작/transaction 조정은 전부 아래 레이어가 — endpoint는 얇게
- 예외는 직접 처리하지 않는다 — `ClientError`/`DevelopError`가 핸들러로 자동 분기 ([INV-4], [exception.md](exception.md))
- 등록은 endpoint가 아니라 `bin/server.py`(합성 루트)에서 — endpoint는 핸들러만 정의([server.md](server.md))

---

## 안티패턴

- endpoint에서 입력 검증·도메인 조작·transaction 조정 → 아래 레이어로, endpoint는 얇게
- 예외를 endpoint에서 try/except → 핸들러 자동 분기 ([INV-4])
- usecase 결과를 재가공/래핑 → `Output.to_dict()` 그대로 응답 ([INV-8])
- endpoint가 자기를 라우터에 등록 → `bin/server.py` 단일 출처 ([server.md](server.md))
