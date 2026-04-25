# Meeting Architecture Summary

## 목적

- 1차 목표는 `auth`를 예시로 전체 서비스 아키텍처 기준을 고정하는 것이다.
- 최종 서비스는 개인 자산형이 아니라 `ChurchWorkspace` 중심 협업 서비스로 본다.

## 핵심 구조

- 비즈니스 API는 기본적으로 `presentation -> usecase -> domain/repository` 흐름을 따른다.
- `usecase`는 업무 흐름을 조립하고, `domain`은 규칙을 담고, `repository`는 추상화로 둔다.
- transaction은 기본적으로 쓰기 usecase에만 열고, 기준은 "같이 성공/실패해야 하는가"이다.

## 에러/응답

- 하위 레이어는 `AppError + ErrorCode`만 사용한다.
- HTTP status, message, log level은 전역 매핑으로 관리한다.
- 성공 응답은 기본적으로 `{"data": ...}` 형식을 사용한다.
- 에러 응답은 `{"error": {"code": ..., "message": ..., "request_id": ...}}` 형식을 사용한다.

## 인증

- 초기 auth 범위는 `signup / login / refresh / logout / me`
- 가입 정책은 공개 signup으로 시작한다.
- 세션 전달은 `HttpOnly cookie + refresh token`
- 계정 상태는 `active / blocked / deactivated`
- signup과 login은 분리한다.
- access 만료 후 기본 경로는 refresh다.
- refresh token은 rotation하고, 원문 대신 hash만 저장한다.

## 협업 모델

- `User`는 개인 계정 주체다.
- `ChurchWorkspace`는 교회/팀 작업공간이며 프로젝트의 소유 주체다.
- `Membership`이 사용자와 작업공간을 연결하고 역할을 부여한다.
- 초기 역할은 `owner / admin / editor / viewer`
- 프로젝트 접근 기본 기준은 프로젝트 개별 초대가 아니라 workspace 소속과 역할이다.

## 권한 기준

- `viewer`: 조회 전용
- `editor`: 프로젝트 생성/수정 가능
- `admin`: 프로젝트 생성/수정/삭제 가능
- `owner`: workspace 최고 관리 권한

## 데이터 정책

- 기본 삭제 철학은 soft delete
- 식별자는 애플리케이션에서 생성
- 저장 시간은 UTC 통일
- 핵심 참조 관계는 FK를 기본으로 둔다.

## 구현 순서

1. `Auth + User`
2. `RefreshToken + AuthAuditLog`
3. `ChurchWorkspace + Membership + WorkspaceInvite`
4. `Project`
5. 이후 `Template / Render`

## 문서 역할

- `meeting-architecture-summary.md`: 회의 설명용 요약
- `meeting-auth-architecture-explained.md`: 회의 설명용 결정 이유 + 코드 연결 문서
- `architecture-decisions.md`: 구현 시 참고하는 상세 결정 기록
