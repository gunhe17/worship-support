---
paths:
  - "worship_support/api/endpoint/internal/*.py"
---

# internal endpoint 패턴

내부 이벤트(NOTIFY)로 트리거되는 핸들러 — HTTP endpoint([endpoint.md](endpoint.md))의 worker 짝. 비즈니스 로직 0, payload→business 바인딩만. `endpoint/internal/{channel}.py`에 산다.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · external: [endpoint.md](endpoint.md) · UoW: [behavior.md](behavior.md) · 등록: [worker.md](worker.md)

---

## external vs internal — endpoint = "라우터가 디스패치하는 진입점"

endpoint는 트리거 무관, 라우터가 디스패치하는 진입점이다. external(HTTP)이 기본(`endpoint/` 루트), 내부 이벤트로 트리거되는 건 `internal/`로 가른다.

| | external (`endpoint/`) | internal (`endpoint/internal/`) |
|---|---|---|
| 트리거 | HTTP 요청 (외부 주소, pull) | NOTIFY 이벤트 (내부, push) |
| router | `Router(path, endpoint)` | `Work(channel, handler)` |
| 응답 | `JSONResponse` | 없음 (fire-and-forget) |
| 등록 | `bin/server.py` | `bin/worker.py` |

→ "internal endpoint"는 모순이 아니라 외부 주소가 아닌 **내부 이벤트로 트리거되는 진입점**(webhook 핸들러 결).

## 책임 — business 바인딩만 (얇게)

payload 파싱 + business(usecase)를 worker UoW에 바인딩. action(claim, 예외 시 롤백·fail 판정)은 UoW가, business(실행·성공 기록)는 usecase가 소유 — internal endpoint는 둘을 잇기만 한다.

```python
# good: payload 파싱 + worker UoW(use_postgresql_with_action) 안에서 business 호출
async def on_event_group(raw: str) -> None:
    payload = json.loads(raw)
    await _dispatch(UUID(payload["id"]))


async def on_sweep() -> None:
    async with use_postgresql() as scope:
        ids = await event_dispatch.search_claimable(session=scope.session)
    for id in ids:
        await _dispatch(id)


async def _dispatch(id: UUID) -> None:
    async with use_postgresql_with_action(id=id) as scope:
        if scope is None:
            return
        await event_dispatch.dispatch(session=scope.session, id=id)
```

- 핸들러 네이밍 `on_{channel}` — 트리거(채널)를 접두(HTTP `post_create`가 메서드를 접두하듯, 출처를 이름에서)
- NOTIFY 핸들러 인자는 raw payload(`str`) — `json.loads`로 풀어 `id`만 꺼낸다. 팀·행위자는 claim한 reaction의 `event_groups` 행이 권위(UoW가 읽음)
- 스위퍼 핸들러 `on_sweep()`은 인자 없음 — 재처리 대상 id를 usecase로 조회해 NOTIFY와 같은 경로(`_dispatch`)로 보낸다
- UoW(claim→business, 예외 시 롤백·fail 판정 후 삼킴)는 `behavior/worker.py`의 `use_postgresql_with_action`가 소유 — 성공 기록은 business(`event_dispatch.dispatch`), 재시도 판정은 UoW([retry.md](retry.md)) — internal endpoint는 그 컨텍스트 *안에서* business(usecase)만 호출(action 직접 호출 금지). `scope is None`(claim 실패 = 다른 worker 선점)이면 no-op
- 등록은 `bin/worker.py`의 `Work`(합성 루트) — 핸들러는 정의만 ([worker.md](worker.md))

## 안티패턴

- internal endpoint가 claim/fail(action) 직접 호출 → `behavior/worker.py` UoW가 ([behavior.md](behavior.md))
- 라우팅·reaction 등 비즈니스 로직 작성 → usecase(`event_dispatch`)로
- `JSONResponse`/응답 반환 → internal은 fire-and-forget
- 핸들러가 자기를 라우터에 등록 → `bin/worker.py` 단일 출처 ([worker.md](worker.md))
