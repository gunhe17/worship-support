# Auth 튜토리얼 Overview

## 목표

이 튜토리얼의 목표는 단순히 회원가입/로그인 기능을 구현하는 것이 아니다.

목표는 Spring Boot, MySQL, MVC 방식에 익숙한 개발자가 아래 기술과 구조를 사용해 실무형 인증 흐름을 이해, 설계, 구현, 테스트할 수 있게 되는 것이다.

- FastAPI
- PostgreSQL
- SQLAlchemy async
- JWT
- 비밀번호 해시
- DDD 지향 레이어 구조

따라서 각 단계에서는 Spring MVC에서 익숙한 개념과 FastAPI + DDD 구조를 계속 비교한다.

## 진행 규칙

각 step은 아래 순서로 진행한다.

1. 개념을 학습한다.
2. Spring Boot MVC와 비교한다.
3. worship-support 프로젝트에서의 문제를 정의한다.
4. 현실적인 선택지를 나열한다.
5. 프로젝트 규칙을 결정한다.
6. 결정 이유를 문서화한다.
7. 코드 구조를 설계한다.
8. 합의된 범위만 구현한다.
9. 구현된 코드를 요청 흐름에 따라 다시 읽는다.
10. 테스트로 검증한다.

## 구현 진행 규칙

초기에는 개념과 설계를 확인한 뒤 구현했다.
이제 기본 인증 방향이 결정되었으므로, assistant는 결정이 필요한 지점에서만 멈춰 질문하고 나머지는 계속 진행한다.

각 구현 step은 아래 방식으로 진행한다.

1. assistant가 개념과 설계를 설명한다.
2. 이미 결정된 규칙 안에서 구현한다.
3. 구현된 코드 흐름을 다시 설명한다.
4. 테스트로 검증한다.
5. 새로 결정한 내용은 결정 기록에 남긴다.

## 문서 언어

튜토리얼 문서는 한국어로 작성한다.

코드, 파일명, 클래스명, 함수명, API 경로, 에러 코드는 영어를 사용한다.

## 초기 MVP 범위

첫 구현 범위는 아래 다섯 가지다.

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /users/me`

아래 기능들은 초기에 설계 방향은 잡되, 구현은 후반부로 미룬다.

- audit log
- rate limiting
- admin user management
- advanced account status management

## 튜토리얼 Phase

### Phase -1. 개발 환경과 실행 기반

FastAPI 프로젝트, 패키지 관리, PostgreSQL, 환경변수, 테스트 DB, 실행 명령을 준비한다.

### Phase 0. 튜토리얼 규칙과 기준 문서

학습 방식, 문서화 방식, 구현 승인 방식, 기준 문서를 정한다.

### Phase 1. Spring MVC에서 FastAPI DDD로 사고 전환

Controller-Service-Repository 구조와 endpoint-usecase-domain-repository-unit-of-work 구조를 비교한다.

### Phase 2. Auth 요구사항과 보안 위협 모델링

회원가입 정책, 계정 상태, 비밀번호 정책, 토큰 정책, XSS/CSRF 같은 주요 보안 위험을 정한다.

### Phase 3. Auth와 User 도메인 모델링

User, Email, Password, PasswordHash, token 관련 개념을 DDD 용어로 모델링한다.

### Phase 4. API 계약과 에러 계약

request, response, status code, application error code를 설계한다.

### Phase 5. PostgreSQL, SQLAlchemy, Migration

DB 테이블, SQLAlchemy model, async session 경계, Alembic migration을 설계한다.

### Phase 6. Signup 구현

schema, usecase, domain, repository, unit of work, database, response 흐름으로 회원가입을 구현한다.

### Phase 7. Login과 JWT 구현

credential 검증, 비밀번호 해시 검증, 사용자 상태 확인, JWT 발급을 구현한다.

### Phase 8. Current User와 보호 API

Cookie 기반 access token 추출, JWT 검증, 현재 사용자 조회, `/users/me`를 구현한다.

### Phase 9. Refresh Token과 Logout

refresh token 저장, rotation, revoke, CSRF 검증, logout을 구현한다.
이 phase는 인증 MVP에 포함한다.

### Phase 10. Audit Log와 운영 로그

application log와 audit log를 분리하고, 인증 흐름에서 추적할 행위를 정한다.

### Phase 11. 테스트와 CI

unit test, integration test, migration test, security regression test를 작성한다.
수동 검증 가이드는 `11-manual-test-guide.md`에 둔다.

### Phase 12. 리뷰와 확장

구조를 리뷰하고 같은 패턴을 project/template 도메인으로 확장하는 방법을 정리한다.
