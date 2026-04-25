---
name: Controller 단일 파일 구조
description: auth Controller(FastAPI 엔드포인트)는 모든 라우트를 routes.py 한 파일에 구현
type: feedback
---

모든 Controller 엔드포인트(signup, login, logout, withdraw, verify-email)는 `routes.py` 단일 파일에 구현한다.

**Why:** 사용자가 파일 분리 없이 한 곳에서 엔드포인트 전체를 파악하길 원함.

**How to apply:** auth 도메인의 FastAPI 라우터는 `app/auth/routes.py` 한 파일에 모든 엔드포인트를 작성. 파일이 500줄을 넘지 않는 한 분리하지 않음.
