# Worship 프로젝트 10/8 회의 기반 핵심 설계 원칙

이 문서는 2026년 10월 8일 회의에서 논의한 내용을 바탕으로, Worship 서비스의 백엔드·AI Agent·인프라·개발 Harness를 설계할 때 지속적으로 적용해야 하는 핵심 원칙을 정리한 것이다.

백엔드 설계 시 참고해야 하는 원칙.

단순히 현재 기능을 구현하기 위한 일회성 기준이 아니라, 향후 기능 추가·기획 변경·개발 인원 및 역할 변화에도 구조가 쉽게 무너지지 않도록 하기 위한 장기 설계 원칙으로 사용한다.

## 1. 정상 흐름만이 아니라 시나리오의 끝까지 설계한다

기능을 설계할 때 단순히 “요청 → 처리 → 저장 → 성공”의 정상 흐름만 정의하지 않는다.

각 기능에 대해 최소한 다음 상황까지 고려한다.

- 정상 실행
- 잘못된 입력
- 권한 부족 또는 실행 중 권한 회수
- 중복 요청
- 요청 만료
- 동시에 여러 사용자가 수정하는 경우
- DB Transaction 실패 및 rollback
- Deadlock 또는 lock 충돌
- 외부 API의 timeout·부분 성공·응답 유실
- 요청 재시도에 따른 중복 실행
- 서버 또는 Worker 중단
- 서버 재시작 후 작업 복구
- 운영자가 수동으로 복구해야 하는 상황

즉, 기능 구현 가능 여부가 아니라 **데이터와 시스템 상태가 실패 이후에도 어떻게 유지되고 복구되는지까지 설계**한다.

특히 DB Transaction, 외부 Provider, Object Storage, 이메일, YouTube, AI Worker 등 서로 원자성을 보장할 수 없는 영역 사이에서는 실패 경계를 명확하게 정의한다.

---

## 2. Agent Tool Calling을 고려한 Ontology를 설계한다

Ontology는 단순히 변수명이나 테이블명을 보기 좋게 통일하는 작업이 아니다.

Worship의 AI Agent가 Tool Calling을 할 때 서비스의 구조와 의미를 정확하게 이해할 수 있도록,

**Domain → Java → DB → API → Agent Tool → Error → Status**

전 영역에서 동일한 개념과 용어를 일관되게 사용하는 것을 목표로 한다.

예를 들어 같은 의미의 진행 상태를 어떤 영역에서는

`CREATED → IN_PROGRESS → COMPLETED`

라고 사용하면서 다른 영역에서는

`STARTED → PROCESSING → FINISHED`

처럼 임의로 다르게 표현하지 않는다.

단, 이름이 비슷하다는 이유만으로 의미가 다른 상태를 하나의 공통 Enum으로 강제로 통합해서도 안 된다.

다음 기준을 지킨다.

- 같은 개념에는 같은 용어 사용
- 같은 역할의 field에는 같은 이름 사용
- FK 이름만 보더라도 어떤 Entity를 참조하는지 파악 가능해야 함
- 관계 테이블은 어떤 Entity 사이의 관계인지 이름만으로 이해 가능해야 함
- Domain과 DB, API, Tool에서 서로 다른 별칭을 만들지 않음
- Status는 실제 상태축과 전이 의미를 기준으로 정의
- Agent가 DB 내부 구현을 몰라도 Tool의 의미와 관계를 이해할 수 있도록 설계

Ontology의 최종 목적은 **사람과 Agent 모두가 같은 서비스 모델을 이해하도록 만드는 것**이다.

---

## 3. Error 처리는 사용자 화면과 운영 복구까지 설계한다

Error Enum이나 HTTP Status를 정의하는 수준에서 끝내지 않는다.

각 주요 오류는 다음 흐름 전체를 설계한다.

**원인 → Domain Error → HTTP/API 표현 → Frontend UX → 재시도/복구 → 로그·모니터링 → 테스트**

예를 들어 동시 수정 충돌이라면 단순히 `409 Conflict`를 반환하는 것으로 끝내지 않고,

- 사용자가 입력한 값은 어떻게 보존할지
- 최신 값과 어떻게 비교할지
- 자동 재시도가 가능한지
- 재시도하면 위험한 작업인지
- 운영 로그에 무엇을 남길지

까지 정의한다.

오류 메시지 차이를 통해 존재 여부나 권한 정보를 추측할 수 있는 보안 문제도 함께 고려한다.

---

## 4. 기능 증가를 전제로 계층과 모듈 경계를 설계한다

서비스 기능이 증가하면 하나의 기능이 여러 Domain과 계층을 동시에 참조하는 경우가 많아진다.

이를 Repository 직접 참조나 순환 의존으로 해결하지 않는다.

기본 구조는 다음을 지향한다.

- 기능별 응집도가 높은 Modular Monolith
- 명확한 Application Capability
- Module 내부 Entity/Repository를 다른 Module에서 직접 접근하지 않음
- 여러 Module을 하나의 업무 흐름으로 묶어야 할 경우 명시적인 Orchestration 계층 사용
- 범용 `common`, `workflow`, `integration` 모듈에 업무 로직을 몰아넣지 않음

기능이 증가해도 기존 Domain 경계와 의존 방향이 유지될 수 있는 구조를 만든다.

---

## 5. AI/CPU/GPU Worker와 비동기 실행 경계를 고려한다

AI 연산처럼 실행 시간이 길거나 CPU/GPU 자원을 사용하는 작업을 일반 HTTP 요청이나 DB Transaction 안에서 장시간 기다리게 하지 않는다.

예를 들어 하나의 사용자 요청 안에서도

1. 필요한 DB 상태를 먼저 안전하게 확정하고
2. AI 작업이 필요하다는 durable intent 또는 event/job을 남기고
3. Transaction을 종료한 뒤
4. Worker가 CPU/GPU 연산을 수행하고
5. 결과를 다시 Backend를 통해 반영

하는 구조를 고려한다.

단순한 `AFTER_COMMIT` callback만으로 중요한 작업의 전달을 보장했다고 간주하지 않는다. 서버가 중단되어도 다시 처리해야 하는 작업이라면 durable Job, Outbox, retry, lease, fencing, reconciliation 등의 필요성을 검토한다.

AI 연산은 CPU/GPU Worker로 분리될 수 있으며, Kaggle 등 외부 연산 자원의 활용 가능성도 고려한다.

다만 Kaggle, Google Cloud, AWS 등 특정 인프라를 설계 단계에서 임의로 고정하지 않는다. 실제 AI 기능, 비용, 운영 방식, 접근 권한, 배포 구조가 AI 개발자와 확정된 뒤 구체화한다.

CI/CD 역시 AI 개발자와의 역할 분담 및 실제 Worker 배포 구조가 확정된 뒤 연결한다.

---

## 6. Agent가 호출할 Function/Tool의 계층 위치와 추상화 수준을 아키텍처 차원에서 설계한다

사용자가 자연어로 요청하면 Agent는 사용자의 의도를 해석하고, 필요한 Tool 또는 Function을 선택한 뒤 여러 Tool을 어떤 순서로 호출할지 결정한다.

따라서 Backend에서는 단순히 “Agent에게 어떤 기능을 제공할 것인가”만 정하는 것이 아니라, **각 Function이 백엔드 아키텍처의 어느 계층에 위치해야 하는지, 어느 수준의 추상화로 제공되어야 하는지까지 명확하게 설계해야 한다.**

Agent Tool 설계가 잘못되면 Agent가 DB 구조나 내부 구현 세부사항에 지나치게 의존하게 되고, 권한 검증·Transaction·동시성·보안·데이터 정합성을 우회할 위험이 생긴다.

### 기본 구조

Agent가 사용하는 Function은 다음과 같은 흐름을 기본으로 한다.

`사용자 자연어 요청`  
→ `Agent: 의도 해석·계획·Tool 선택`  
→ `Agent Tool Adapter / Tool Gateway`  
→ `Application Capability`  
→ `Domain / Repository / External Adapter`

각 계층의 책임은 다음과 같이 구분한다.

- **Agent**
  - 자연어 해석
  - 작업 계획
  - 필요한 Tool 선택
  - Tool 호출 순서 결정
  - 여러 Tool 결과 조합

- **Tool Adapter / Tool Gateway**
  - Agent에게 노출할 Function 정의
  - Tool input/output schema
  - Agent Tool allowlist
  - delegation/approval 전달
  - 내부 구현 세부사항 은닉

- **Application Layer**
  - 실제 Use Case 수행
  - 권한 검증
  - Transaction 경계
  - Version 및 동시성 검증
  - 여러 Domain 규칙 조합
  - 외부 작업 시작 및 결과 상태 관리

- **Domain Layer**
  - 핵심 비즈니스 규칙
  - 상태 전이
  - 불변식
  - 권한·정책 계산 등 순수한 Domain 판단

- **Infrastructure / Adapter**
  - DB Repository 구현
  - S3, YouTube, Email 등 외부 Provider 연동
  - 기술적인 입출력 처리

### Function을 어느 Layer에 둘지 판단하는 기준

Function의 위치는 이름이나 구현 편의로 결정하지 않는다.

다음 질문을 순서대로 검토한다.

#### 1. 사용자의 의미 있는 행동 단위인가?

예:

- 곡 검색
- 콘티 줄 이동
- Key 변경
- 회차 생성
- 재생목록 생성

처럼 사용자의 의도가 직접 드러나는 행동이라면 일반적으로 **Application Capability**가 중심이 된다.

예:

`searchSongs()`  
`moveSetlistRow()`  
`updateSetlistItem()`  
`createServiceOccurrence()`

Agent Tool은 이 Application Capability를 외부에 노출하는 Adapter 역할을 한다.

#### 2. Function 자체가 비즈니스 규칙을 표현하는가?

예:

- 이 사용자가 이 문서를 수정할 수 있는가
- 마지막 관리자를 제거할 수 있는가
- 이 Score를 현재 Document에서 사용할 수 있는가
- 현재 상태에서 소유권 이전이 가능한가

처럼 업무 규칙이나 불변식을 판단하는 Function이라면 **Domain Policy 또는 Domain Service**에 위치하는 것이 적절하다.

예:

`canEditDocument()`  
`canTransferOwnership()`  
`validateScoreUsage()`

이러한 규칙을 Agent Tool이나 Controller 내부에 중복 구현하지 않는다.

#### 3. DB 또는 외부 시스템의 기술적인 작업인가?

예:

- JPA Entity 저장
- SQL 조회
- S3 Object 업로드
- YouTube API 호출
- Email Provider 호출

같은 작업은 **Infrastructure / Adapter Layer**의 책임이다.

예:

`SetlistRepository.save()`  
`S3Storage.upload()`  
`YouTubeClient.createPlaylist()`

Agent가 이러한 Function을 직접 호출하지 않는다.

#### 4. 여러 Application Capability 또는 Module을 하나의 업무로 묶어야 하는가?

예를 들어 회원탈퇴에는 단순히 User 상태 변경만 필요한 것이 아니라,

- Workspace Member 종료
- Team 관계 정리
- Document ownership 처리
- Session 폐기
- YouTube authorization revoke
- 알림 및 감사 기록

등 여러 Module이 함께 동작할 수 있다.

이처럼 하나의 사용자 행동이 여러 Module의 Capability를 묶어야 한다면 **Application Orchestration** 계층을 사용한다.

Orchestrator는 여러 Module의 public Application Capability를 조합하지만, 직접 Repository나 Entity를 소유하지 않는다.

예:

`WithdrawUserOrchestrator`  
`RemoveMemberOrchestrator`  
`CloseWorkspaceOrchestrator`

#### 5. Agent에게 노출하기에 적절한 추상화 수준인가?

Tool이 너무 저수준이면 Agent가 많은 내부 절차를 직접 조합해야 하므로 자유도가 지나치게 커지고, 오류와 보안 위험이 증가한다.

예를 들어 다음과 같은 Function은 Agent에게 직접 노출하지 않는다.

`updateRow()`  
`saveEntity()`  
`runSql()`  
`deleteFromTable()`

반대로 Tool이 지나치게 고수준이면 작은 기능 변경마다 새로운 Tool이 필요해지고 재사용성이 떨어질 수 있다.

따라서 Agent Tool은 가능한 한 다음 조건을 만족해야 한다.

- 사용자의 의미 있는 행동 단위
- 명확한 권한 경계
- 명확한 Transaction 경계
- 입력과 결과를 명확한 schema로 표현 가능
- 실패 조건이 명확함
- 기존 Application Capability와 직접 연결 가능
- 여러 Tool을 Agent가 필요한 경우 조합할 수 있을 정도의 적절한 크기

### 판단 기준 요약

Function의 위치를 결정할 때 다음 순서를 기본 판단식으로 사용한다.

**사용자 행동인가? → Application Capability**

**업무 규칙 자체인가? → Domain Policy / Domain Service**

**DB·외부 기술 처리인가? → Infrastructure / Adapter**

**여러 Module의 Capability를 하나의 업무로 조합하는가? → Application Orchestration**

**Agent에게 노출할 진입점인가? → Tool Adapter / Tool Gateway**

중요한 점은 **Agent용 Function부터 설계하지 않는 것**이다.

먼저 정상적인 Backend Application Capability와 Domain 구조를 설계하고, 그중 Agent에게 허용할 기능만 Tool Adapter를 통해 선택적으로 노출한다.

### Agent가 직접 접근하면 안 되는 영역

기본적으로 다음 접근은 허용하지 않는다.

- SQL 직접 작성·실행
- Repository 직접 호출
- Entity 직접 수정
- DB Table 직접 조작
- Provider SDK 직접 호출
- 모든 동작을 처리하는 범용 `execute(action, json)` Tool

이러한 방식은 Agent에게 지나치게 높은 자유도를 제공하고, Backend에서 설계한 Authorization·Transaction·동시성·감사·실패 복구 경계를 우회할 수 있기 때문이다.

### UI와 Agent는 같은 Business Logic을 사용한다

Agent 전용 Business Logic을 별도로 만들지 않는다.

Web UI와 Agent는 진입 방식만 다를 뿐, 최종적으로 동일한 Application Capability를 호출해야 한다.

예를 들어 사용자가

> “이번 주 콘티의 두 번째 곡을 마지막으로 옮기고 Key를 D로 바꿔줘.”

라고 요청한 경우 Agent는 DB의 `setlist_row`를 직접 수정하지 않는다.

대신 Backend에서 미리 정의된 Capability를 Tool로 호출한다.

예:

`previewMoveSetlistRow()`  
`previewUpdateSetlistItemKey()`

필요하다면 Agent가 두 Tool을 순서대로 조합한다.

실제 권한, Transaction, Version, Revision 생성은 Backend Application Layer가 책임진다.

### 상태 변경 Tool의 승인 구조

데이터를 변경하는 Agent Tool은 필요에 따라 다음 흐름을 사용한다.

**prepare → preview → 사용자 승인 → execute**

승인에는 최소한 다음 정보가 결합되어야 한다.

- 실행 사용자
- 실행할 Action
- 정규화된 Parameters
- 대상 Resource
- 예상 Version
- 만료시간

실제 `execute` 시점에는 다음을 다시 확인한다.

- 현재 권한
- Resource lifecycle
- Version
- Approval 유효성
- Payload 변경 여부

승인 이후 Agent가 Parameter를 바꾸어 실행할 수 없어야 한다.

### 최종 원칙

Agent Tool 설계에서는 단순히

**“어떤 Function을 제공할 것인가?”**

만 결정해서는 안 된다.

반드시 다음 네 가지를 함께 결정한다.

**1. 이 Function은 어떤 책임을 가지는가**  
**2. Backend의 어느 Layer에 위치하는가**  
**3. 어느 수준의 추상화로 Agent에게 노출하는가**  
**4. 어떤 Authorization·Transaction·Version·Approval 경계를 통과해야 하는가**

즉, Agent Tool Calling은 AI 기능만의 문제가 아니라 **Backend Architecture의 Application Layer와 Module Boundary를 설계하는 문제**로 다룬다.

---

## 7. Community 기능은 현재 Core 설계에서 제외한다

Community 기능은 현재 범위에서 보류한다.

다른 Workspace 간 데이터 공유, 공개 Song/Score Catalog, 사용자 간 콘텐츠 교환 등의 기능을 현재 Domain이나 권한 모델에 미리 넣지 않는다.

향후 실제 요구가 확정되었을 때 별도 설계한다.

---

## 8. 기획 변경에도 흔들리지 않는 Harness를 설계한다

Harness는 현재 기획을 그대로 코드로 생성하기 위한 일회성 Prompt 모음이 아니다.

기획과 기능이 변경되더라도 다음과 같은 핵심 구조를 지속적으로 강제할 수 있어야 한다.

- Module dependency
- Architecture boundary
- DB/Flyway 규칙
- Transaction 규칙
- Authorization
- Agent Tool 경계
- Error 계약
- 테스트 기준
- Git 안전 규칙
- 실제 검증 결과와 작업 상태 기록

문서에 “지켜라”라고 적는 것만으로 통제했다고 간주하지 않는다.

가능한 영역은 Spring Modulith, ArchUnit, Testcontainers, CI, Hooks, Permissions, 검증 스크립트 등으로 자동 검증한다.

또한 검증을 실행하지 않은 상태를 `PASS`라고 기록하지 않는다.

---

## 9. 장기적으로 Frontend/Backend 분업이 아니라 기능 단위 분업을 가능하게 한다

현재는 Frontend와 Backend 담당자가 나뉘어 개발하지만, 장기적으로는 이 방식에만 의존하지 않는다.

목표는 각 영역의 Architecture와 Harness를 충분히 정교하게 만들어 AI Coding Agent에게 기능 단위로 작업을 맡길 수 있는 상태다.

예를 들어 하나의 기능을

- Schema
- Backend Application Capability
- API
- Frontend
- Agent Tool
- Test

까지 하나의 Vertical Slice로 맡길 수 있어야 한다.

이를 가능하게 하려면 AI가 코드를 작성할 때도 이미 정의된 Architecture를 벗어나지 않는다는 보장이 필요하다.

따라서 먼저

**Architecture를 결정하고 → 이를 자동으로 강제할 Harness를 구축하고 → 이후 기능 단위 개발로 전환**

하는 순서를 따른다.

Harness의 최종 목적은 단순 자동화가 아니라 **사람과 AI가 동일한 아키텍처 규칙 아래에서 기능 단위로 안전하게 협업할 수 있도록 만드는 것**이다.

---

## 10. 모든 기술 선택에는 근거와 검증 방법이 있어야 한다

“보통 이렇게 한다”, “Spring에서는 일반적이다”, “AI가 추천했다”는 이유만으로 구조를 확정하지 않는다.

각 중요한 기술·아키텍처 선택은 다음을 설명할 수 있어야 한다.

- 현재 Worship 요구사항에서 왜 필요한지
- 다른 대안은 무엇인지
- 선택하지 않은 대안은 왜 제외했는지
- 비용·성능·복잡도·운영 리스크
- 향후 변경 가능성
- 어떤 테스트나 지표로 선택이 맞는지 검증할지

실측하지 않은 성능은 사실처럼 표현하지 않는다.

---

## 11. 설계 완료와 구현·검증 완료를 명확하게 구분한다

문서에 구조가 설계되었다고 실제 시스템에서 동작하는 것이 아니다.

상태를 최소한 다음처럼 구분한다.

- **DESIGNED**: 설계 완료
- **IMPLEMENTED**: 코드 적용 완료
- **VERIFIED**: 실제 테스트·검증 완료
- **BLOCKED**: 외부 결정 또는 조건 대기

예를 들어 MySQL 동시성 설계를 완료했더라도 실제 Testcontainers 테스트를 하지 않았다면 `VERIFIED`라고 표현하지 않는다.

Harness 역시 실제 Repository에 설치하고 의도적인 위반을 차단하는 Challenge Test를 통과하기 전까지는 “Harness 설계 완료”일 뿐이다.

---

## 12. 과설계를 피하되 미래 확장 경로는 막지 않는다

현재 필요한 문제를 해결하기 위해 지나치게 큰 구조를 먼저 만들지 않는다.

특히 명확한 근거 없이 다음을 도입하지 않는다.

- Microservice
- Redis
- Message Broker
- 범용 Workflow Engine
- Event Bus
- CRDT/OT
- 대규모 Multi-Agent Framework
- 범용 Permission Engine
- 범용 Tool Dispatcher

다만 향후 실제 요구가 발생했을 때 현재 구조를 전부 폐기하지 않고 확장할 수 있도록 **명확한 경계와 Port**는 유지한다.

핵심 원칙은 다음과 같다.

> 현재 필요한 만큼만 구현하되, 미래 요구 때문에 현재의 핵심 Domain과 데이터 정합성을 다시 뜯어고쳐야 하는 구조는 피한다.

---

# 최종 목표

Worship의 백엔드 아키텍처와 Harness는 단순히 “현재 기능이 돌아가는 코드”를 만드는 것이 목적이 아니다.

최종적으로 다음을 만족해야 한다.

**기획이 변경되어도 Domain과 아키텍처의 핵심 경계가 유지되고,  
사람과 AI Agent가 동일한 Ontology와 Application Capability를 사용하며,  
실패·동시성·외부 연동·AI 연산까지 예측 가능한 방식으로 처리하고,  
Harness가 그 구조를 자동으로 검증하여,  
향후 팀이 Frontend/Backend 역할 구분을 넘어 기능 단위로 안전하게 개발할 수 있는 기반을 만드는 것.**
