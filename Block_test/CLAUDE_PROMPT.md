
# CLAUDE_PROMPT.md

# Template Editor DB & Network Simulator 구현 요청

## 1. 프로젝트 목표

템플릿 편집기의 실시간 동시 편집 구조를 이해하고 검증하기 위한 시뮬레이터를 구현해 주세요.

실제 템플릿 편집기 전체를 구현하는 것이 목적이 아닙니다.

사용자가 왼쪽 화면에서 테스트 이벤트를 발생시키면 다음 현상을 오른쪽과 하단 화면에서 실시간으로 확인할 수 있는 것이 목적입니다.

1. 사용자 이벤트 발생
2. WebSocket 요청 및 응답
3. Redis Lock 및 실시간 이벤트 처리
4. 다른 사용자에게 실시간 변경 전파
5. 1초 Debounce 예약 및 갱신
6. PostgreSQL CRUD 발생
7. 버전 생성 및 복원
8. 변경 전후 DB 데이터 비교

첨부된 DB_SCHEMA.md와 SIMULATION_SCENARIOS.md를 반드시 읽고 구현 기준으로 사용해 주세요.

문서에 정의된 DB 구조와 시나리오를 임의로 축약하거나 변경하지 마세요.

## 2. 작업 시작 전 확인 사항

먼저 현재 프로젝트의 다음 사항을 분석해 주세요.

- 프레임워크
- 언어
- 패키지 매니저
- 기존 디렉터리 구조
- UI 라이브러리
- CSS 및 스타일링 방식
- 기존 공통 컴포넌트
- 실행 및 빌드 방법

기존 프로젝트가 있다면 현재 기술 스택을 최대한 유지해 주세요.

사용하지 않는 새로운 라이브러리를 임의로 추가하지 마세요.

기존 프로젝트가 비어 있다면 적절한 React 기반 구성을 제안하고 구현해 주세요.

분석이 끝나면 간단한 구현 계획을 먼저 제시한 다음 진행해 주세요.

## 3. 구현 범위

이번 프로젝트는 프론트엔드 중심의 시뮬레이터입니다.

실제 PostgreSQL, Redis, WebSocket 서버를 구축하지 마세요.

대신 각 구성 요소의 동작을 모방하는 Mock Engine을 구현해 주세요.

다만 실제 시스템처럼 데이터 흐름과 상태 전이는 정확하게 구현해야 합니다.

실제 네트워크 연결이 없다는 사실을 화면에 명확히 표시해 주세요.

## 4. 전체 화면 구성

화면은 다음 세 영역으로 구성해 주세요.

### A. 왼쪽: 이벤트 시뮬레이션 영역

사용자가 직접 이벤트를 발생시키는 영역입니다.

다음 요소를 포함해 주세요.

#### 사용자 선택

(v1.2 변경: U001~U004 사용자 1~4, §15 참고)

- 사용자 A
- 사용자 B
- 현재 활성 사용자 표시
- 사용자별 Lock 소유 상태 표시

#### 캔버스

- 템플릿 선택 및 템플릿 이름 (v1.1: 공유 블록 시나리오용 T002 포함)
- 실제 편집기처럼 보이는 캔버스
- 텍스트 요소
- 제목 요소
- 이미지 요소
- 요소 선택 표시
- 요소 위치 표시
- 요소 크기 표시
- 현재 요소의 속성 표시

캔버스는 실제 편집기처럼 간단하게 구현하면 됩니다.

복잡한 디자인 편집 기능은 필요하지 않습니다.

#### 이벤트 컨트롤

다음 이벤트를 발생시킬 수 있도록 해 주세요.

1. 텍스트 수정
2. 글자 크기 변경
3. 글자 색상 변경
4. 요소 X 좌표 변경
5. 요소 Y 좌표 변경
6. 요소 크기 변경
7. 요소 추가
8. 요소 삭제
9. 요소 순서 변경
10. 명시적 저장
11. 과거 버전 복원
12. Lock 요청
13. Lock 해제
14. 사용자 전환

이벤트별 입력값을 조작할 수 있도록 해 주세요.

예를 들어 텍스트 수정은 input 또는 textarea를 사용하고, 글자 크기는 slider나 number input을 사용할 수 있습니다.

이벤트 버튼은 실제 상태 변경과 연결되어야 합니다.

단순히 버튼만 만들어 놓고 동작하지 않는 상태는 허용하지 않습니다.

### B. 오른쪽: DB Explorer 영역

PostgreSQL과 Redis를 탭 또는 구분된 패널로 표시해 주세요.

#### PostgreSQL

다음 테이블을 확인할 수 있어야 합니다.

- block
- block_version
- block_text
- block_title
- block_image
- block_file
- block_link
- block_song
- block_list
- block_table
- block_video
- block_embed
- block_live_state
- block_property_state
- template
- template_version
- template_element
- template_version_element
- template_live_state
- template_live_element
- template_element_property_state

각 테이블을 선택하면 다음을 표시해 주세요.

- 테이블명
- 전체 행 수
- 컬럼명
- 데이터 타입
- 현재 데이터
- PK, FK 표시
- 최근 CRUD 이력

테이블 데이터는 실제 DB 테이블처럼 행과 열로 표시해 주세요.

JSONB는 접기와 펼치기를 지원해 주세요.

#### Redis

다음 데이터를 표시해 주세요.

- Property Lock
- Lock Token
- Fencing Token
- Lock 만료 시간
- 접속 사용자
- Debounce 예약
- Redis Stream 이벤트 로그

- (v1.1) Live 상태 (live:block:*, live:template:*)
- (v1.1) 저장 실패 및 재시도 상태

Redis의 Key와 Value를 확인할 수 있어야 합니다.

Lock이 생성되거나 해제되면 즉시 화면이 변경되어야 합니다.

Debounce 예약이 갱신되면 남은 시간이 표시되어야 합니다.

### C. 하단: Network Timeline

이 영역은 네트워크 및 내부 처리 과정을 보여주는 핵심 영역입니다.

다음 구성 요소를 표시해 주세요. (v1.2: Client A/B → Client U001~U004 4개 레인, 브로드캐스트는 부모 이벤트 + 수신자별 Delivery)

Client A
→ WebSocket Server
→ Redis
→ Client B
→ Debounce Worker
→ PostgreSQL

각 이벤트가 발생하면 타임라인에 새로운 로그가 추가되어야 합니다.

각 로그에는 다음 정보가 있어야 합니다.

- 순번
- 발생 시각
- 송신 주체
- 수신 주체
- 이벤트 이름
- 요청 또는 응답 Payload
- 처리 결과
- 처리 시간
- 성공 또는 실패

예시:

14:00:00.000 PROPERTY_LOCK_REQUEST

Client A → WebSocket Server

14:00:00.010 PROPERTY_LOCK_GRANTED

WebSocket Server → Client A

14:00:00.020 PROPERTY_UPDATE

Client A → WebSocket Server

14:00:00.030 PROPERTY_UPDATED

WebSocket Server → Client B

14:00:01.030 DEBOUNCE_SAVE

Debounce Worker → PostgreSQL

14:00:01.050 PROPERTY_PERSISTED

WebSocket Server → Client A, Client B

실제 시간이 아니라 시뮬레이션 시간을 사용해도 됩니다.

각 이벤트를 클릭하면 상세 Payload를 볼 수 있게 해 주세요.

가능하다면 요청과 응답의 관계를 연결선으로 표시해 주세요.

## 5. CRUD 시각화 규칙

DB 데이터가 추가, 수정, 삭제되면 사용자가 즉시 알아볼 수 있어야 합니다.

다음 색상 규칙을 적용해 주세요.

| 상태          | 색상   | 표시      |
| ------------- | ------ | --------- |
| INSERT        | 초록색 | + INSERT  |
| UPDATE        | 파란색 | ~ UPDATE  |
| DELETE        | 빨간색 | - DELETE  |
| 변경 전 값    | 회색   | 이전 값   |
| Debounce 대기 | 주황색 | WAITING   |
| 저장 완료     | 초록색 | PERSISTED |
| Lock 보유     | 보라색 | LOCKED    |
| Lock 거부     | 빨간색 | DENIED    |
| 네트워크 전송 | 파란색 | SENT      |

색상은 해당 행 전체를 과하게 칠하기보다는 변경된 셀이나 행의 왼쪽 표시, 배경 강조 등을 활용해 주세요.

변경된 컬럼은 이전 값과 새로운 값을 비교할 수 있게 해 주세요.

예시:

| 컬럼               | 이전 값    | 새로운 값   |
| ------------------ | ---------- | ----------- |
| revision           | 2          | 3           |
| persisted_revision | 2          | 2           |
| content.body       | 안녕하세요 | 안녕하세요! |

저장 완료 시 persisted_revision도 3으로 변경되어야 합니다.

(v1.1) 위 예시의 "revision 3 / persisted_revision 2" 상태는 Redis Live 상태와 PostgreSQL을 나란히 비교하는 패널에서 보여줍니다. PostgreSQL에는 Debounce flush 1회당 UPDATE를 1회만 실행합니다. 따라서 이 예시에서는 revision=3, persisted_revision=3이 한 번에 기록됩니다.

변경 강조 효과는 일정 시간 후 사라지게 하되 CRUD 이력은 유지해 주세요.

색상과 함께 텍스트 라벨도 반드시 사용해 주세요.

## 6. Mock Simulation Engine 설계

UI 컴포넌트 안에 모든 시뮬레이션 로직을 작성하지 마세요.

다음처럼 역할을 분리해 주세요.

- MockDatabase: 테이블 데이터와 CRUD 관리
- MockRedis: Lock, Debounce 예약, 이벤트 로그 관리
- MockWebSocket: 요청, 응답, 이벤트 전달 시뮬레이션
- SimulationEngine: 이벤트 실행 순서 및 상태 전이 관리
- ScenarioManager: 시나리오 실행 및 초기화
- EventLogger: 이벤트 로그 관리

실제 프로젝트 구조에 맞게 적절한 디렉터리로 구성해 주세요.

DB 데이터의 원본은 하나의 중앙 상태에서 관리해야 합니다.

왼쪽 캔버스와 오른쪽 DB Explorer가 각각 별도의 데이터를 가지면 안 됩니다.

왼쪽 화면의 값이 바뀌면 동일한 상태를 기반으로 오른쪽 DB가 갱신되어야 합니다.

## 7. Debounce 구현 요구사항

Debounce는 이번 프로젝트의 중요한 검증 대상입니다.

기본 대기 시간은 1000ms입니다.

다음 동작을 구현해 주세요.

1. 속성 변경 이벤트 발생
2. 실시간 상태 즉시 변경
3. 다른 사용자 화면에 즉시 전파
4. DB 저장 예약 생성
5. 1초 안에 다시 변경되면 예약 시각 갱신
6. 마지막 변경 이후 1초가 지나면 DB 저장
7. 저장 완료 이벤트 발생

예를 들어 0ms, 300ms, 600ms에 변경이 발생하면 1600ms에 한 번만 저장되어야 합니다.

UI에서 Debounce 남은 시간을 확인할 수 있어야 합니다.

시뮬레이션 시간을 빠르게 진행하거나 느리게 진행할 수 있도록 해 주세요.

또한 일시정지, 재개, 단계별 진행을 지원해 주세요.

시간 제어는 실제 타이머와 분리된 가상 Clock을 사용하는 것을 우선 권장합니다.

## 8. 시나리오 실행 기능

첨부된 SIMULATION_SCENARIOS.md의 모든 시나리오를 구현해 주세요.

각 시나리오를 버튼으로 실행할 수 있어야 합니다.

특히 다음 기능을 제공해 주세요.

- 시나리오 선택
- 시나리오 실행
- 일시정지
- 재개
- 한 단계씩 진행
- 처음부터 다시 실행
- 전체 초기화
- 이벤트 속도 조절

시나리오 실행 중 각 단계가 진행될 때마다 오른쪽 DB와 하단 Network Timeline이 함께 변경되어야 합니다.

## 9. 이벤트 상세 보기

Network Timeline의 이벤트를 클릭하면 상세 정보를 표시해 주세요.

예시:

PROPERTY_UPDATE

Request Payload:

{
  "requestId": "REQ001",
  "templateId": "T001",
  "elementId": "E001",
  "propertyPath": "content",
  "baseRevision": 2,
  "value": {
    "body": "안녕하세요!"
  }
}

처리 과정:

1. 사용자 인증 확인
2. 권한 확인
3. Lock 확인
4. Fencing Token 확인
5. Revision 확인
6. 변경 승인
7. Redis 이벤트 기록
8. 실시간 전파
9. Debounce 예약

각 단계의 성공/실패를 표시해 주세요.

## 10. SQL 변경 내역

DB CRUD가 발생하면 대응되는 SQL 예시도 보여주세요.

예를 들어 block_live_state가 변경되면 다음과 같은 SQL을 표시합니다.

UPDATE block_live_state
SET content = ...,
    revision = ...,
    persisted_revision = ...,
    updated_at = NOW(),
    persisted_at = NOW()
WHERE block_id = 'B001';

명시적 저장 시에는 INSERT SQL을 보여주세요.

실제 SQL을 실행할 필요는 없습니다.

단, 화면의 Mock DB 상태 변경과 SQL 설명이 일치해야 합니다.

## 11. UI/UX 요구사항

전체 디자인은 개발자 도구와 DB 관리 도구를 결합한 느낌으로 만들어 주세요.

권장 스타일:

- 다크 테마 우선
- 밀도 높은 데이터 테이블
- 명확한 구분선
- 상태별 색상
- 모노스페이스 폰트로 ID, SQL, JSON 표시
- 작은 배지와 아이콘
- 과도한 카드 디자인 지양
- 긴 JSON은 접기/펼치기
- 화면 크기에 맞춰 패널 너비 조절
- 각 패널 스크롤 독립 지원

사용자가 데이터를 분석하기 쉬운 것이 가장 중요합니다.

단순한 대시보드보다 실제 개발 도구처럼 느껴지게 만들어 주세요.

## 12. 검증 조건

다음 조건을 반드시 검증해 주세요.

1. 텍스트 입력 즉시 다른 사용자 화면에 반영되는가?
2. DB 저장은 마지막 입력 후 1초 뒤 발생하는가?
3. 연속 입력 시 Debounce 예약이 갱신되는가?
4. 연속 입력이 DB에 한 번만 저장되는가?
5. Debounce 저장으로 block_version이 생성되지 않는가?
6. 명시적 저장 시 block_version이 생성되는가?
7. 명시적 저장 시 template_version이 생성되는가?
8. 변경되지 않은 블록 버전은 재사용되는가?
9. 템플릿 배치 정보는 template_version_element에 저장되는가?
10. 서로 다른 속성은 동시에 Lock을 획득할 수 있는가?
11. 같은 속성의 Lock 충돌이 발생하는가?
12. 구조 변경은 순차적으로 처리되는가?
13. 복원 시 기존 버전이 삭제되지 않는가?
14. DELETE가 발생해도 과거 확정 버전이 유지되는가?
15. 초기화 시 모든 상태가 최초 상태로 돌아가는가?
16. (v1.1) 속성별 flush가 다른 속성의 미저장 값을 PostgreSQL에 쓰지 않는가?
17. (v1.1) 블록·템플릿 persisted_revision이 연속 저장 완료된 최대 revision으로 계산되는가?
18. (v1.1) 복원 시 block_live_state가 변경되지 않고, 콘텐츠 불일치 경고가 표시되는가?
19. (v1.1) 복원 시 삭제된 요소의 deleted_at이 NULL로 되돌아가고 live 행이 다시 생성되는가?
20. (v1.1) 저장 실패 시 Redis Live 상태가 유지되고, 재시도 성공 시 persisted_revision이 갱신되는가?
21. (v1.1) 공유 블록의 콘텐츠 변경은 두 템플릿에 공유되고, 배치 속성은 독립적인가?
22. (v1.1) 신규 블록은 current_version_id = NULL로 생성되고, 첫 명시적 저장에서 최초 버전이 생성되는가?

검증을 위한 단위 테스트 또는 통합 테스트도 작성해 주세요.

## 13. 구현 우선순위

한 번에 모든 기능을 완성하려고 하지 말고 다음 순서로 구현해 주세요.

### Phase 1: 기본 UI

- 전체 레이아웃
- 왼쪽 캔버스
- 오른쪽 DB Explorer
- 하단 Network Timeline
- 초기 Mock 데이터

### Phase 2: 핵심 엔진

- MockDatabase
- MockRedis
- MockWebSocket
- SimulationEngine
- EventLogger

### Phase 3: 실시간 편집

- Lock
- 속성별 수정
- 다른 사용자 화면 동기화
- Debounce

### Phase 4: DB 변경 시각화

- INSERT
- UPDATE
- DELETE
- 변경 전후 비교
- SQL 미리보기

### Phase 5: 버전 관리

- 명시적 저장
- 버전 이력
- 과거 버전 복원

### Phase 6: 테스트 및 완성

- 전체 시나리오
- 오류 처리
- 초기화
- 테스트 코드
- 실행 및 빌드 확인

각 Phase가 완료되면 직접 실행하고 동작을 확인한 뒤 다음 Phase로 진행해 주세요.

## 14. 확정 정책 반영 (v1.1)

구현 전에 다음 정책을 확정했다. 세부 규칙은 DB_SCHEMA.md §7, 시나리오별 규칙은 SIMULATION_SCENARIOS.md의 "v1.1" 표시 항목을 따른다. 앞 절과 충돌하면 이 절을 따른다.

### 14.1 기술 스택

- Vite + React 18 + TypeScript(strict), npm
- 상태 관리 라이브러리 없이 단일 엔진 store와 useSyncExternalStore 사용
- CSS Modules + CSS 변수 다크 테마
- Vitest
- 엔진(src/engine)은 React를 import하지 않는 순수 TypeScript로 작성

### 14.2 데이터와 상태

- block_text.style JSONB 확장 컬럼 추가 (UI에 확장 컬럼 배지 표시)
- Redis live:* 키가 승인된 최신 상태의 원본이며, PostgreSQL Live 테이블은 Debounce 후 반영
- 왼쪽 캔버스(클라이언트 replica), 오른쪽 PostgreSQL·Redis는 모두 하나의 WorldState 안에서 엔진만 갱신
- Debounce 대기 중 캔버스와 PostgreSQL 값이 다른 것은 의도된 동작

### 14.3 추가 UI 요구사항

- 템플릿 선택 (T001, 시나리오 K의 T002)
- Redis Live vs PostgreSQL Persisted 비교 패널
  - 대상(블록 또는 템플릿 요소)별로 Redis 값과 PostgreSQL 값을 나란히 표시
  - revision, persisted_revision, 저장 대기 여부(WAITING, FAILED, PERSISTED) 표시
  - 값이 다른 필드를 강조
- 속성별 저장 상태(property_state 행 단위)와 블록·템플릿 전체 저장 상태(연속 persisted_revision)를 별도 영역으로 구분
- 저장 실패 표시
  - FAILED, DEAD 상태 배지, 시도 횟수, 다음 재시도까지 남은 시간, 마지막 오류
  - PostgreSQL 실패 주입 토글 (n회)
  - DEAD 상태에서 수동 재시도 버튼
- 복원 결과의 CONTENT_MISMATCH 경고 (block_id, 참조 block_version, 다른 필드 비교)
- 시나리오 precondition 로그는 타임라인에서 PRECONDITION 구간으로 접어서 표시

### 14.4 시나리오

- 시나리오는 A ~ L 총 12개이며, 각각 독립적으로 실행한다.
- K: 공유 블록
- L: 저장 실패와 재시도

### 14.5 구현 우선순위 조정

- Phase 3에 속성별 flush 병합과 연속 persisted_revision 계산, Redis vs PostgreSQL 비교 패널을 포함한다.
- Phase 5에 공유 블록(K)과 복원 불일치 경고를 포함한다.
- Phase 6에 저장 실패와 재시도(L)를 포함한다.

## 15. Canvas Editor와 다중 사용자 (v1.2)

### 15.1 디자인 우선순위

- 왼쪽 영역은 실제 상용 템플릿 제작 서비스 수준의 Canvas Editor로 구현한다.
  - 참고: Canva의 요소 추가와 배치, Notion의 블록 편집, Framer의 선택·크기 조절·속성 패널
  - 특정 제품을 복제하지 않고 장점을 조합한 독자 디자인으로 만든다.
- DB Explorer와 Network Timeline은 개발자용 모니터링 UI(다크)로 구성한다.
- Editor는 자체 라이트 테마 디자인 시스템을 사용하고, 모니터링 영역과 시각적으로 구분한다.

### 15.2 Canvas Editor 구성

- 상단 TopBar: 템플릿 이름(읽기 전용, §DB 8.8), Undo/Redo, 저장 상태, 저장 버튼, 사용자 4명 선택(PresenceBar), 현재 시점 사용자(userId와 이름)
- 좌측: 요소 추가 도구(10종) 및 레이어(순서) 패널
- 중앙: 템플릿 캔버스(페이지 프레임, 줌, 선택 테두리와 8방향 핸들, 이동·리사이즈, 다른 사용자의 선택 테두리·이름표·커서)
- 우측: 선택 요소 속성 패널. 공통 배치 섹션 + 요소 종류별 섹션을 레지스트리 방식으로 동적 구성, 속성별 Lock 소유자 표시
- 요소 10종: 텍스트, 제목, 이미지, 파일, 링크, 음악, 목록, 표, 동영상, 임베드
- 기존 §4.A의 이벤트 컨트롤 14종은 편집기 조작으로 대체한다.
  - Lock 수동 요청과 해제, 다른 사용자로 실행, 시나리오, 시계, 실패 주입은 Simulation Console에 둔다.

### 15.3 편집 동작과 엔진 연결

UI는 EditorIntent만 발생시키고, DB와 Redis를 직접 변경하지 않는다.

| 편집 동작 | Intent | 엔진 명령 |
| --------- | ------ | --------- |
| 텍스트 입력 | editProperty(content) | PROPERTY_UPDATE → block_live_state |
| 글자 크기, 색상, 정렬 | editProperty(style.*) | PROPERTY_UPDATE → block style |
| 이동, 리사이즈 | editPlacement(position.*, size.*) | PROPERTY_UPDATE → template_live_element.props |
| 요소 추가, 삭제 | addElement, deleteElement | ELEMENT_CREATE, ELEMENT_DELETE |
| 순서 변경 | reorderElement | ELEMENT_REORDER |
| 저장 | save | 명시적 버전 생성 |
| Undo, Redo | undo, redo | 역방향 명령 (§DB 8.4) |

- Phase 1에서는 Local Adapter가 EditorIntent를 처리한다. Phase 3에서 같은 인터페이스를 Engine Adapter로 교체한다.
- 선택, 포커스, 커서 등 로컬 UI 상태는 replica에만 반영한다. 네트워크 명령이 아니다.

### 15.4 다중 사용자

- 4명(U001~U004)이 모두 T001에 접속한 상태로 시작한다.
- PresenceBar 표시
  - 아바타, 이름, 접속 상태, 편집 상태 항상 표시
  - 현재 시점 사용자 강조
  - 클릭 한 번으로 전환
- 사용자 시점 전환과 다중 사용자 동시 편집을 분리한다.
  - 시점 전환: 표시할 replica만 변경
  - 동시 편집: 엔진에 actorUserId를 지정한 요청을 발생시킴. 현재 시점 사용자와 무관하게 발생 가능
- 각 사용자는 고유 색상으로 자신의 선택, 커서, 이벤트를 표시한다.
- Lock 충돌 시 실패 이유와 Lock 소유자를 표시한다.
- Timeline은 사용자별 색상으로 구분하고, actorUserId로 필터링한다.
- 세부 모델은 DB_SCHEMA.md §8(Replica, Presence, Broadcast Delivery, Undo/Redo, ELEMENT_RESTORE)을 따른다.

### 15.5 Phase 계획 (v1.2 조정)

§13과 §14.5의 Phase 계획을 이 표로 통합한다.

| Phase | 범위 |
| ----- | ---- |
| 1 | Editor 디자인 시스템, TopBar와 PresenceBar, ToolRail, Stage(10종 렌더러, 선택, 핸들, 이동, 리사이즈), Inspector 레지스트리, LayerPanel, Replica 타입, EditorIntent와 Local Adapter, 모니터링 패널 골격(시드 기반 DB Explorer) |
| 2 | 핵심 엔진(VirtualClock, MockDatabase, MockRedis, MockWebSocket, EventLogger), Replica 관리, Presence, actor 기록, 1:N Delivery |
| 3 | Engine Adapter 교체, Optimistic Update와 거부 처리, Lock과 Fencing, 실시간 반영, 속성별 Debounce flush 병합과 연속 persisted_revision, Redis Live vs PostgreSQL 비교 패널, Undo/Redo 엔진 연결(속성), 시나리오 A~F, 다중 사용자 검증 MU-1~MU-9 |
| 4 | CRUD 시각화, diff, SQL 미리보기 |
| 5 | 구조 변경, 저장, 복원(CONTENT_MISMATCH 경고), ELEMENT_RESTORE와 구조 Undo, 공유 블록, 시나리오 G~K, MU-10 |
| 6 | 저장 실패와 재시도(L), 오류 주입, 초기화, 완료 보고 |

### 15.6 추가 검증 조건

12절 검증 1~22에 다음을 추가한다.

23. 4명의 사용자 시점을 자유롭게 전환할 수 있는가?
24. 사용자별 선택 요소와 속성 패널 상태가 독립적으로 유지되는가?
25. 한 사용자의 편집이 공유 상태를 통해 다른 사용자에게 Delivery 단위로 전달되는가?
26. 모든 이벤트의 actorUserId가 정확한가?
27. 여러 사용자의 이벤트를 하나의 시나리오에서 순차적 또는 동시적으로 실행할 수 있는가?
28. 하나의 pendingOp가 거부되어도 이후 정상 작업이 유지되는가?
29. 다른 사용자가 먼저 변경한 속성의 Undo가 UNDO_CONFLICT로 처리되는가?
30. 연결이 끊긴 사용자가 동기화된 것으로 표시되지 않는가?

시나리오별 대응은 SIMULATION_SCENARIOS.md §15(MU-1~MU-10)를 따른다.

### 15.7 Phase 완료 보고 형식

다음을 구분해 보고한다.

- 빌드 결과
- 테스트 결과
- 구현된 기능
- 아직 엔진에 연결되지 않은 기능

### 15.8 명시적 저장·복원 이벤트와 Fixture (v1.2.3)

세부 규칙은 DB_SCHEMA.md §8.11을 따른다.

- 저장 이벤트: TEMPLATE_SAVE → TEMPLATE_SAVE_ACK(요청 승인, 저장 완료 아님) → VERSION_SAVE(트랜잭션) → TEMPLATE_SAVED(완료 알림)
- 복원 이벤트: TEMPLATE_RESTORE → TEMPLATE_RESTORE_ACK → VERSION_SAVE → STRUCTURE_UPDATED(REPLACE_TEMPLATE_STRUCTURE) → CONTENT_MISMATCH
- 거부: TEMPLATE_SAVE_REJECTED, TEMPLATE_RESTORE_REJECTED
  - payload: requestId, operation, code, message, rejectedBy, stage, result, acked, (cause)
  - stage = validation: 검증 실패 (VERSION_NOT_FOUND 등)
  - stage = transaction: ACK 이후 VERSION_SAVE 롤백 (DB_WRITE_FAILED, 구조 변경과 공통 코드)
  - 요청당 ACK는 1회, 중복 requestId는 재실행하지 않는다
- 복원 결과 STRUCTURE_UPDATED는 요청자도 받는다 (actor 제외 규칙의 예외). TEMPLATE_RESTORE_ACK와는 별개 이벤트다
- 알림(TEMPLATE_SAVED, CONTENT_MISMATCH)은 PROPERTY_PERSISTED와 같이 Broadcast/Delivery로만 전달한다. Redis Stream과 전역 순번을 사용하지 않는다.
- 처음 보는 템플릿으로 전환하면 SYNC에 전체 구성 스냅샷을 포함한다.
- Simulation Console에 실행 중 Fixture 추가 버튼을 둔다(FIXTURE 이벤트). 시나리오 실행기(Phase 6)도 같은 Fixture 생성 로직을 사용한다.
- 추가 검증: DB_SCHEMA.md §8.11.7 VS-1 ~ VS-13

### 15.9 Phase 6 구현 세부 (v1.2.4)

세부 규칙은 DB_SCHEMA.md §8.12를 따른다.

- Simulation Console의 구성:
  - 시나리오 실행: A~L, L-DEAD 선택 · 실행 · 끝까지 진행 · 단계 로그 · 검증 결과 PASS/FAIL
  - 전체 초기화
  - 실패 주입: 횟수 · 대상 · 적용 · 해제 · 실제 실패 수
  - 저장 작업: 저장 대기 · 재시도 대기 · DEAD · 수동 재시도 · 저장 완료
  - 클라이언트 연결
  - Fixture
- 재시도: VirtualClock 기준 1s · 2s · 4s, 최대 3회 → DEAD. 모든 시도는 DEBOUNCE_SAVE(attempt, retryCount, trigger, nextRetryAt, status)로 기록한다.
- 실패 주입 설정 변경은 FAULT_INJECTION 이벤트로 기록한다.
- Timeline은 PRECONDITION 구간을 접어서 표시한다.

## 16. 구현 완료 보고

최종 완료 시 다음 항목을 보고해 주세요.

- 구현한 기능
- 생성한 주요 파일
- 실행 방법
- 시나리오별 테스트 결과
- 알려진 제한 사항
- 실제 PostgreSQL/Redis 연결 시 추가해야 할 작업

가장 중요한 것은 시각적으로만 그럴듯한 화면이 아니라, 이벤트를 발생시켰을 때 DB 상태와 네트워크 로그가 시나리오에 맞게 실제로 일관되게 변하는 것입니다.

### 16.1 최종 완료 보고 (2026-11-04)

#### 구현한 기능

| 영역 | 내용 |
| ---- | ---- |
| Canvas Editor | TopBar(템플릿 선택, Undo/Redo, 저장 상태, 저장), 요소 10종 추가·이동·리사이즈·스냅, 인라인 텍스트 편집, 레이어 순서, 레지스트리 기반 Inspector, 버전 이력과 복원 |
| 다중 사용자 | U001~U004 독립 Client Replica, 시점 전환(네트워크 영향 없음), Presence(Pub/Sub, 커서 50ms throttle), 다른 사용자 선택·커서·Lock 소유자 표시 |
| Simulation Engine | VirtualClock, MockDatabase(트랜잭션·PK/FK·CRUD 기록·실패 주입), MockRedis(string/hash/stream/Pub/Sub·TTL), MockWebSocket(지연·FIFO·유실), EventLogger, 결정적 ID |
| 실시간 편집 | Optimistic pendingOps, 속성 Lock(TTL 10s)·Fencing Token, PROPERTY_UPDATE 9단계 검증, 1:N Broadcast/Delivery, 재연결 SYNC(syncWatermark·전역 순번·누락 감지), 승인 확인 대기 판정(requestId) |
| 저장 | 속성별 Debounce 1초, 해당 경로만 병합하는 flush, 연속 persisted_revision, 구조 변경 즉시 저장 |
| 저장 실패 | 1s · 2s · 4s 재시도(최대 3회) → DEAD, 재시도 불가 오류(STALE_REVISION, FENCING_TOKEN_STALE)는 즉시 DEAD, 수동 재시도 |
| 버전 | 명시적 저장(변경 블록만 block_version, NO_CHANGES), 복원(새 template_version, REPLACE_TEMPLATE_STRUCTURE 전파, CONTENT_MISMATCH), 공유 블록 |
| 모니터링 | DB Explorer(21개 테이블, CRUD 강조·변경 전후 비교·SQL 미리보기·트랜잭션 이력), Redis 키 뷰어, Live vs PG 비교, Network Timeline(레인·필터·상세·PRECONDITION 접기) |
| Simulation Console | 시나리오 실행기(A~L, L-DEAD), 전체 초기화, 실패 주입(횟수·대상), 저장 작업 상태와 수동 재시도, 연결 끊기·재연결, Lock 해제, Fixture 추가 |

#### 주요 파일

| 경로 | 역할 |
| ---- | ---- |
| src/engine/engine.ts | SimulationEngine 진입점, WorldState 스냅샷, 전체 초기화 |
| src/engine/clock.ts, ids.ts, logger.ts | VirtualClock, 결정적 ID, EventLogger |
| src/engine/db/mockDatabase.ts, schema.ts, sql.ts | MockDatabase, 테이블 메타데이터, 변경 전후 비교·SQL 미리보기 |
| src/engine/redis/mockRedis.ts, net/mockWebSocket.ts | MockRedis, MockWebSocket |
| src/engine/server/ (wsServer, broadcaster, editService, structureService, versionService, liveState) | 서버 처리: 연결·SYNC, Broadcast/Delivery, Lock·PROPERTY_UPDATE·Debounce·재시도, 구조 변경, 저장·복원, Redis Live |
| src/engine/client/ (clientRuntime, applyChange) | 사용자별 클라이언트(Replica, Presence, Lock, 수신 검증) |
| src/engine/fixtures.ts | Fixture 생성(applyFixture) |
| src/editor/ (model, adapters, ui, store) | Canvas Editor, EditorIntent, EngineAdapter |
| src/monitor/ | DB Explorer, Redis, Live vs PG, Console, Timeline, 시계 |
| src/scenarios/ | 시나리오 정의(A~L)와 실행기 |
| tests/ | 단위·통합 테스트 16개 파일 |

#### 실행 방법

```bash
npm install          # 처음 한 번
npm run dev          # 개발 서버 (기본 http://localhost:5173)
npm test             # 전체 테스트 (Vitest)
npm run typecheck    # 타입 검사
npm run build        # 프로덕션 빌드 (dist/)
npm run preview      # 빌드 결과 확인
```

화면 사용:

- Canvas Editor
  - 왼쪽 패널에서 요소를 추가한다.
  - 더블클릭으로 텍스트를 편집하고, 드래그로 이동한다.
  - 상단에서 사용자 시점을 전환하고, 저장 버튼으로 버전을 만든다.
- 오른쪽 탭
  - PostgreSQL: 테이블과 CRUD 이력, SQL
  - Redis: 키 뷰어
  - Live vs PG: Redis와 PostgreSQL 비교
  - Console: 시나리오 실행, 초기화, 실패 주입, 연결 제어
- 상단 시계: 재생, 일시정지, 단계 진행, 배속
- 하단 Timeline: 이벤트, actor 필터, Presence, 상세 보기

#### 시나리오별 실행 결과

시나리오 실행기(tests/scenarios/runner.test.ts)와 개별 통합 테스트로 확인했다. 모든 시나리오는 전체 초기화 후 독립적으로 실행했다.

| 시나리오 | 결과 | 주요 검증 |
| -------- | ---- | --------- |
| A 텍스트 속성 편집 | PASS | Lock → UPDATE → Delivery → 1초 뒤 flush. revision 1 / persisted 1, property_state 1/1, block_version 생성 없음 |
| B 연속 입력과 Debounce | PASS | 승인 3회, 예약 갱신 3회(각 승인 + 1000ms), 저장 1회(마지막 승인 + 1000ms). revision 3 / persisted 3 |
| C 서로 다른 속성 동시 편집 | PASS | Lock 2개 모두 획득, 속성별 flush. fontSize flush 시점 persisted 1 → 최종 2. 변형(persisted 0 → 3)은 tests/engine/scenarios.test.ts에서 확인 |
| D 동일 속성 Lock 충돌 | PASS | U002 PROPERTY_LOCK_DENIED(소유자 U001), U002 작업만 제거, B의 DB 변경 없음 |
| E 텍스트 크기 변경 | PASS | 네트워크 흐름(LOCK_REQUEST → … → PROPERTY_PERSISTED), fontSize 24 저장, 버전 생성 없음 |
| F 요소 위치 변경 | PASS | template_live_element y 300, template_live_state 1/1, element property_state 1/1 |
| G 요소 추가 | PASS | B002(current_version_id NULL), E002, 즉시 트랜잭션, Debounce 없음, 버전 테이블 변경 없음 |
| H 요소 삭제 | PASS | live 행 DELETE, deleted_at 설정, 블록·과거 TVE 유지 (Debounce 취소는 structure.test.ts) |
| I 명시적 저장 | PASS | TEMPLATE_SAVE → ACK → VERSION_SAVE → TEMPLATE_SAVED. BV002, TV002, TVE002(BV002, y 300) |
| J 과거 버전 복원 | PASS | TV003(restored_from TV001), TVE003 → BV001, E001 y 100, block_live_state 유지, REPLACE_TEMPLATE_STRUCTURE, CONTENT_MISMATCH(body, style.fontSize) |
| K 공유 블록 | PASS | FIXTURE(ScenarioRunner), T002의 U002에게 콘텐츠 전파, block_live_state 1행, 배치 독립, Lock 키 3종 |
| L 저장 실패와 재시도 | PASS | t+1000·t+2000 실패, t+4000 성공, attempt/retryCount (1,0)(2,1)(3,2), 실패 주입 2 = 실제 실패 2 |
| L-DEAD (L 변형 1) | PASS | t+1000·2000·4000·8000 실패 → DEAD(attempt 4, retryCount 3), 자동 재시도 없음, 실패 주입 4 = 실제 실패 4 |

반복 실행: 같은 시나리오를 다시 실행하면 ID, 이벤트 로그, 테이블이 동일하다. 다른 시나리오를 연속 실행해도 이전 실행의 예약 작업은 남지 않는다.

#### 테스트 결과

`npm test`: 16개 파일, 203개 테스트 전부 통과. `npm run typecheck`와 `npm run build`는 오류 없음.

| 파일 | 테스트 | 범위 |
| ---- | ------ | ---- |
| tests/engine/seed.test.ts | 7 | 스키마 21개 테이블, 시드, 사용자 |
| tests/editor/replica.test.ts | 4 | documentView, Optimistic 렌더링, MU-8 |
| tests/editor/layout.test.ts | 6 | 요소 레지스트리, 스냅, 배치 |
| tests/editor/localAdapter.test.ts | 17 | LocalAdapter, Undo/Redo, MU-4·5·9·10(로컬) |
| tests/engine/infrastructure.test.ts | 18 | VirtualClock, MockDatabase, MockRedis, MockWebSocket |
| tests/engine/multiUser.test.ts | 15 | Presence, Broadcast/Delivery, MU-1·4·5·6·7, 결정성 |
| tests/engine/syncConsistency.test.ts | 12 | SY-1 ~ SY-9 |
| tests/engine/scenarios.test.ts | 16 | 시나리오 A~F, MU-1~3·7~9, Lock TTL, Fencing |
| tests/engine/editEvents.test.ts | 16 | ED-1 ~ ED-6, ED-8 |
| tests/engine/structure.test.ts | 11 | 시나리오 G·H, MU-10, 순서 변경, 구조 충돌 |
| tests/engine/sql.test.ts | 9 | 변경 전후 비교, SQL 미리보기, SQL과 Mock 상태 일치 |
| tests/engine/versions.test.ts | 15 | 시나리오 I·J·K, Fixture |
| tests/engine/versionEvents.test.ts | 16 | VS-1 ~ VS-13 |
| tests/engine/retry.test.ts | 18 | 재시도·DEAD·수동 재시도(ED-7), 최신 revision 보호, 재시도 불가 오류 즉시 DEAD, 실패 주입 |
| tests/engine/reset.test.ts | 4 | 전체 초기화, ID 순번 초기화, 초기화 Fixture |
| tests/scenarios/runner.test.ts | 19 | 시나리오 실행기 A~L·L-DEAD, PRECONDITION, 반복 실행 |

#### 현재 제한 사항

- 브라우저 메모리 안의 Mock이다. 실제 PostgreSQL, Redis, WebSocket 서버에 연결하지 않는다.
  - SQL은 설명용이며 실행하지 않는다.
  - 데이터는 새로고침하면 초기화된다.
- 서버와 4명의 클라이언트가 하나의 스레드에서 VirtualClock으로 순서대로 처리된다.
  - 실제 동시성(경합 타이밍, 부분 장애, 네트워크 분할)은 지연값과 유실 주입으로만 흉내 낸다.
  - 클라이언트의 처리 보고(Delivery 적용, SYNC 적용)는 지연 없는 ACK로 처리한다.
- 문서에 아직 승인·기록되지 않은 구현 세부가 코드에 있다.
  - STRUCTURE_UPDATE_ACK, STRUCTURE_UPDATE_REJECTED, STRUCTURE_SAVE 이벤트
  - ELEMENT_CREATE 임시 ID 방식
  - 복원 시 속성 revision 유지(tombstone)
  - SQL 미리보기 표기 규칙(시뮬레이션 시각 리터럴, jsonb_set, 롤백 SQL)
- 템플릿 이름 변경 명령은 정책에 없어 읽기 전용이다. 이미지·동영상·임베드는 외부 리소스 없이 로컬 미리보기로만 렌더링한다.
- Fixture는 시나리오 K의 T002 한 종류만 있다. 실행 중 추가는 Console 버튼으로만 할 수 있다.
- Presence 이벤트는 최근 300건만 보관한다(휘발성). Redis 명령 로그는 최근 200건만 보관한다.
- 권한·인증은 세션 참여와 보고 있는 템플릿 확인으로 단순화했다. 사용자 계정·워크스페이스 권한 모델은 없다.

#### 실제 PostgreSQL/Redis 연결 시 추가해야 할 작업

PostgreSQL:

- 21개 테이블 DDL과 마이그레이션을 작성한다.
  - 대상: PK·FK, block_text.style jsonb, 복합 PK, NOT NULL
  - block ↔ block_version 순환 FK는 DEFERRABLE INITIALLY DEFERRED로 선언한다.
- 트랜잭션 경계를 그대로 옮긴다: Debounce flush, 구조 변경, VERSION_SAVE, Fixture.
  - 격리 수준을 정하고(READ COMMITTED + 행 잠금, 또는 SERIALIZABLE), 재시도 가능한 오류(직렬화 실패, 연결 끊김)를 분류한다.
- 속성 경로 병합은 `jsonb_set` UPDATE로 구현하고, 같은 행에 대한 동시 flush는 행 잠금으로 직렬화한다.
- revision과 fencing token 검사를 SQL 조건에 넣고, 영향 행 수로 판정한다.
  - 예: `WHERE revision <= $liveRevision`, `last_fencing_token <= $token`
- 결정적 순번 ID를 대체한다(시퀀스 또는 UUID). 클라이언트 임시 ID와 서버 ID의 매핑은 유지한다.

Redis:

- Lock을 `SET NX PX`와 Lua 스크립트(해제 시 lockToken 비교)로 구현하고, fence는 `INCR`로 구현한다.
- `live:*`는 Hash 또는 JSON 모듈로 구현한다. 승인 처리(Live 갱신 + XADD + seq:stream INCR)는 Lua 또는 MULTI로 원자화한다.
- Stream 보존 정책(MAXLEN, 시간 기준 trim)을 정한다.
  - SYNC가 따라잡을 범위를 넘어선 클라이언트는 템플릿 스냅샷으로 다시 로드한다(최초 SYNC 스냅샷 경로 재사용).
- Debounce·재시도 예약을 VirtualClock 대신 분산 작업 큐로 옮긴다.
  - 예: Redis Sorted Set + Worker, 또는 BullMQ
  - 작업 단위로 attempt를 검사하고 중복 실행을 막는다.
- Presence: Pub/Sub 채널, Hash, 연결 끊김 감지(heartbeat, TTL)를 구현한다.

WebSocket과 서버:

- 인증, 세션, 템플릿 접근 권한을 구현한다.
- 메시지 스키마를 검증하고 버전을 관리한다.
- 재연결 시 HELLO(lastReceivedRevision, lastProcessedSeq, unconfirmedRequestIds) 프로토콜을 유지한다.
- requestId별 처리 결과 저장소(TTL 포함)를 둔다. 중복 요청 방지와 승인 확인 대기 판정에 쓴다.
- 서버를 여러 인스턴스로 운영하려면 다음이 필요하다.
  - Broadcast를 Redis Pub/Sub 또는 Stream 소비자 그룹으로 팬아웃한다.
  - 템플릿 단위 구조 변경 직렬화를 분산 Lock 또는 파티셔닝으로 보장한다.
- 관측성: 이 시뮬레이터의 이벤트 이름과 공통 필드(§DB 8.7)를 그대로 로그·트레이스 스키마로 사용한다.
