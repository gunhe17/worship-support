---
paths:
  - "worship_support/uwi/**"
---

# uwi 스택

| 역할 | 선택 |
|---|---|
| 빌드 | Vite |
| 언어 | TypeScript, React 19 |
| 라우팅 | TanStack Router (파일 기반) |
| 서버 데이터 | TanStack Query |
| 린트 | oxlint |

## 규칙

- 페이지는 `src/routes/`에 파일로 추가한다. `src/routeTree.gen.ts`는 플러그인이 생성한다 — 손으로 고치지 않고, 커밋한다(`tsc -b`가 vite보다 먼저 돈다).
- api 호출은 `/api/...` 상대 경로로. dev는 Vite proxy, prod는 리버스 프록시가 api로 보낸다.
- TanStack Table·Form·Virtual은 필요한 화면이 생길 때 추가한다. Start는 쓰지 않는다(서버는 api가 맡는다).

```
# bad → good
fetch("http://localhost:28300/songs")   →  fetch("/api/songs")
src/pages/Songs.tsx + 수동 라우트 등록    →  src/routes/songs/index.tsx
```
