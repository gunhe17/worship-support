---
paths:
  - "worship_support/api/bin/server.py"
  - "worship_support/api/server/**"
---

# server + bin 패턴 (합성 루트)

프레임워크 프리미티브(`server/`) + 합성 루트(`bin/server.py`). FastAPI 앱을 조립한다 — 미들웨어·라우터·예외 핸들러 등록 + `app` 빌드. 비즈니스 로직 0, 도메인 의존 0.

루트: [api/CLAUDE.md](../../../worship_support/api/CLAUDE.md) · endpoint: [endpoint.md](endpoint.md) · 예외: [exception.md](exception.md)

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| **프레임워크 프리미티브** | `Server`(등록 큐) + `Router`/`Middleware`/`Lifecycle`/`ExceptionHandler`(`register(app)` 어댑터) |
| **합성 루트** | `bin/server.py`에서 라우터/핸들러 등록 + `app = server.app()` |
| **예외 핸들러 등록** | `exception.client()` + `exception.internal()` 2개로 4xx/5xx 완결 ([exception.md](exception.md)) |

---

## 프레임워크 프리미티브 (`server/`)

> 온톨로지 · essence: 어댑터의 본질 = 도메인 무지(`Callable`만, [INV-1]) — 도메인을 알면 "어댑터"라는 종류가 아니다.

도메인을 모르는 순수 어댑터 — `Callable` endpoint를 받아 FastAPI에 꽂는다.

| 파일 | 내용 |
|------|------|
| `server/server.py` | `Server` — 등록 큐(`middleware`/`router`/`lifecycle`/`exception_handler`) + `app()`(전부 `register(app)` 호출). `worship_support_api()` 팩토리 |
| `server/router.py` | `Router` — `path`/`methods`/`endpoint`/`dependencies` 래퍼, `register(app)`로 `APIRouter` 추가 |
| `server/middleware.py` | `Middleware` 래퍼 + 팩토리(`cors()`/`proxy_headers()`) |
| `server/lifecycle.py` | `Lifecycle` 래퍼 — startup/shutdown lifespan |
| `server/exception.py` | `ExceptionHandler` 래퍼 + 팩토리 `client()`(4xx) / `internal()`(catch-all 5xx) |

모든 래퍼는 동일 형태: 생성자에 설정 받고 `register(app: FastAPI)` 하나 — `Server.app()`이 등록 큐를 순회하며 호출.

---

## 합성 루트 — `bin/server.py`

라우터·핸들러 등록이 일어나는 단 한 곳. endpoint 핸들러를 `Router`로 감싸 `server.router(...)`.

```python
from worship_support.api.server.server import worship_support_api
from worship_support.api.server.router import Router
from worship_support.api.server import middleware
from worship_support.api.server import exception
from worship_support.api.endpoint import secret      # 모듈 namespace import

# #
# server
server = worship_support_api()

server.middleware(middleware.cors())
server.middleware(middleware.proxy_headers())

# #
# router
server.router(
    Router(path="/secret", methods=["POST"], endpoint=secret.post_create)
)

# exception handler
server.exception_handler(exception.client())
server.exception_handler(exception.internal())

# app
app = server.app()
```

- endpoint는 모듈 namespace로 import (`from ...endpoint import secret` → `secret.post_create`). 한 모듈 2개+ 핸들러 등록 규칙 — [conventions.md](../shared/conventions.md) "라우터/registry"
- 핸들러 이름은 HTTP 메서드 접두([endpoint.md](endpoint.md))
- `# server` / `# router` / `# run` 섹션 마커로 구획, `app`은 모듈 끝에서 빌드
- 조립은 전부 `bin/server.py`에 — endpoint/usecase는 자기를 등록하지 않는다(등록의 단일 출처)

---

## 예외 핸들러 등록 — 2개로 완결

`exception.client()` + `exception.internal()` 둘만 등록하면 Starlette가 `type(exc).__mro__`로 자동 분기. 핸들러 본문·예외 트리·메시지 규약의 단일 권위는 [exception.md](exception.md)([INV-4]) — 여기선 *등록*만.

---

## 안티패턴

- endpoint/usecase가 자기를 라우터에 등록 → `bin/server.py` 단일 출처
- `bin/server.py`에 라우팅/검증/예외 본문 인라인 → 본문은 `server/` 래퍼·핸들러 팩토리에, bin은 등록 호출만
- `server/`가 도메인/usecase를 import → 프레임워크 어댑터는 도메인 무지(`Callable`만) — **[INV-1]**
- 예외 핸들러를 카테고리별 N개 등록 → `client()`/`internal()` 2개(MRO 분기)
