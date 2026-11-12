
# SIMULATION_SCENARIOS.md

# 템플릿 편집기 이벤트 시뮬레이션 시나리오

## 1. 기본 테스트 데이터

시뮬레이터 초기화 시 다음 데이터를 생성한다.

### 사용자 (v1.2 변경)

| userId | 표시 이름 | 아바타 색상 | 초기 상태 |
| ------ | --------- | ----------- | --------- |
| U001 | 사용자 1 | 파랑 | T001 접속 (connected) |
| U002 | 사용자 2 | 초록 | T001 접속 (connected) |
| U003 | 사용자 3 | 주황 | T001 접속 (connected) |
| U004 | 사용자 4 | 보라 | T001 접속 (connected) |

- 회원가입과 로그인 없이 시뮬레이션용 초기 사용자로 생성한다.
- 시나리오 본문의 "사용자 A"는 U001(사용자 1), "사용자 B"는 U002(사용자 2)를 뜻한다.
- 특별히 언급하지 않으면 U003과 U004는 수신자로만 참여한다. 이들에게도 모든 브로드캐스트가 Delivery 단위로 전달된다.
- 사용자 정보는 DB 테이블이 아니라 시뮬레이터 설정(users 배열)으로 관리한다. 사용자 수는 4명으로 고정하지만 배열 확장으로 늘릴 수 있다.

### Workspace

- W001

### Template

- T001
- name: 자기소개 템플릿
- current_version_id: TV001

### Block

- B001
- kind: text
- current_version_id: BV001

### Block Version

- BV001
- block_id: B001
- version: 1

### Block Text

- id: BV001
- body: 안녕하세요
- style: {"fontSize":16,"color":"#000000"} (v1.1 확장 컬럼)

### Block Live State

- block_id: B001
- base_block_version_id: BV001
- content: {"body":"안녕하세요","style":{"fontSize":16,"color":"#000000"}}
- revision: 0
- persisted_revision: 0

v1.1: 시나리오 E의 "16 → 24"가 성립하도록 기본 style을 명시한다.

### Template Version

- TV001
- template_id: T001
- version: 1

### Template Element

- E001
- template_id: T001
- block_id: B001

### Template Live Element

- template_id: T001
- template_element_id: E001
- block_id: B001
- sequence: 1
- render_zone: main
- props: {"position":{"x":100,"y":100},"size":{"width":300,"height":100}}

### Template Version Element (v1.1 추가)

복원(시나리오 J)에 필요하다.

- id: TVE001
- template_version_id: TV001
- template_element_id: E001
- block_version_id: BV001
- sequence: 1
- render_zone: main
- props: {"position":{"x":100,"y":100},"size":{"width":300,"height":100}}

### Template Live State (v1.1 추가)

- template_id: T001
- revision: 0
- persisted_revision: 0

### 비어 있는 상태로 시작하는 테이블

- block_property_state, template_element_property_state: 첫 편집 시 INSERT
- block_title, block_image 등 나머지 콘텐츠 테이블: 비어 있음
- 제목, 이미지 요소는 "요소 추가"로 생성한다. (시드 데이터는 문서 원안을 유지)

### 시각 기준

- 모든 created_at, changed_at 등은 고정 기준 시각 2026-01-01T14:00:00.000을 사용한다.

초기 데이터는 시뮬레이터 진입 시 DB 화면에 표시한다.

## 1.1 시나리오 실행 원칙 (v1.1)

- 각 시나리오는 독립적으로 실행한다.
- 실행 시 전체 초기화 후 시나리오의 precondition을 적용하고 본 단계를 실행한다.
- precondition은 선행 시나리오의 명령을 시계를 빠르게 진행하며 실제로 실행해 만든다. DB 값을 직접 조작하지 않는다.
  - 단, 시나리오 K의 두 번째 템플릿 같은 fixture는 예외로, 초기 데이터 추가로 생성하고 "FIXTURE"로 표시한다.
- precondition 실행 로그는 타임라인에서 "PRECONDITION" 구간으로 구분해 접어서 표시한다.

| 시나리오 | precondition |
| -------- | ------------ |
| A ~ H | 없음 (초기 데이터) |
| I | B + E + F 적용 (텍스트 "안녕하세요! 반갑습니다.", fontSize 24, y=300) |
| J | I 적용 (TV002 존재) |
| K | T002 fixture 추가, U002 viewingTemplateId = T002 |
| L | 없음 + PostgreSQL 실패 주입 2회 |

## 2. 시나리오 A: 텍스트 속성 편집

### 사용자 행동

사용자 A가 텍스트를 다음과 같이 변경한다.

기존:

안녕하세요

변경:

안녕하세요! 반갑습니다.

### 처리 순서

1. Client에서 PROPERTY_LOCK_REQUEST 발생
2. WebSocket 서버에서 권한 확인
3. Redis Mock에서 해당 속성 Lock 획득
4. PROPERTY_UPDATE 요청 발생
5. WebSocket 서버에서 Lock, fencingToken, baseRevision 확인
6. 승인된 이벤트를 Redis Stream Mock에 기록
7. 다른 사용자 화면에 PROPERTY_UPDATED 이벤트 전파
8. 실시간 화면은 즉시 변경
9. Debounce 예약을 1초 뒤로 설정
10. 추가 입력이 발생하면 예약 시각을 다시 1초 뒤로 갱신
11. 마지막 입력 이후 1초가 지나면 PostgreSQL Mock 저장
12. PROPERTY_PERSISTED 이벤트 전파

### 예상 DB 변경

block_live_state:

- content 변경
- revision 증가
- persisted_revision 증가
- updated_by 변경
- updated_at 변경
- persisted_at 변경

block_property_state:

- block_id = B001
- property_path = content
- revision 증가
- persisted_revision 증가
- last_fencing_token 변경

### 변경하지 않는 테이블

- block
- block_version
- block_text
- template_version
- template_version_element

중요: Debounce 저장만으로 버전을 생성하지 않는다.

## 3. 시나리오 B: 연속 입력과 Debounce

사용자 A가 1초 안에 세 번 입력한다.

- 0ms: 안녕하세요
- 300ms: 안녕하세요!
- 600ms: 안녕하세요! 반갑습니다.

### 예상 동작

각 입력마다 다음을 수행한다.

- 변경 승인
- revision 증가
- 실시간 전파
- 이전 Debounce 예약 갱신

저장 시각은 각각 다음과 같이 계산된다.

- 첫 입력: 1000ms
- 두 번째 입력: 1300ms
- 세 번째 입력: 1600ms

최종적으로 마지막 입력 기준 1초가 지난 1600ms에 한 번만 PostgreSQL에 저장한다.

### 예상 DB 결과

block_live_state:

- content: 안녕하세요! 반갑습니다.
- revision: 3
- persisted_revision: 3

block_property_state:

- revision: 3
- persisted_revision: 3

block_version INSERT는 발생하지 않는다.

시뮬레이터는 입력 횟수와 실제 DB 저장 횟수를 별도로 표시한다.

## 4. 시나리오 C: 서로 다른 속성 동시 편집

사용자 A:

- B001
- property_path: style.fontSize
- value: 24

사용자 B:

- B001
- property_path: style.color
- value: #ff0000

### 예상 동작

두 속성은 서로 다르므로 동시에 Lock을 획득할 수 있다.

(v1.2.8 참고) 이 시나리오는 요소를 선택하지 않고 보내는 속성 명령 수준의 규칙이다. 편집기 화면에서는 요소를 선택한 사용자가 요소 편집 권한(DB_SCHEMA §7.5.1)을 가지므로, 같은 요소를 두 사람이 동시에 편집하지 않는다.

각 속성의 revision을 별도로 관리한다.

block_property_state:

- B001 / style.fontSize
- B001 / style.color

두 행이 독립적으로 생성되거나 수정된다.

동일 JSON 객체를 저장할 때 한쪽 변경이 사라지지 않도록 최신 content에 속성별 변경을 병합한다.

### v1.1 저장 규칙

- 각 속성의 Debounce flush는 자기 property_path 값만 PostgreSQL content에 병합한다.
- 다른 속성의 미저장 값은 함께 저장하지 않는다.
기본 실행 (승인 시각 기준):

| 시각 | 사건 | 블록 rev |
| ---- | ---- | -------- |
| 0ms | A style.fontSize=24 | 1 |
| 100ms | B style.color=#ff0000 | 2 |
| 1000ms | fontSize flush | block_live_state revision=2, persisted_revision=1 |
| 1100ms | color flush | revision=2, persisted_revision=2 |

변형 실행 (연속 저장 계산 검증):

| 시각 | 사건 | 블록 rev |
| ---- | ---- | -------- |
| 0ms | A style.fontSize=20 | 1 |
| 100ms | B style.color=#ff0000 | 2 |
| 500ms | A style.fontSize=24 (fontSize Debounce가 1500ms로 연장) | 3 |
| 1100ms | color만 flush | revision=3, persisted_revision=0 (rev 1 미저장) |
| 1500ms | fontSize flush (rev 1, 3을 함께 완료 처리) | revision=3, persisted_revision=3 |

- 1100ms 시점의 PostgreSQL content.style.fontSize는 16이다. (미저장 값을 함께 쓰지 않음)
- 1100ms 시점의 block_property_state: style.color는 revision 1 / persisted 1, style.fontSize는 revision 2 / persisted 0

UI는 속성별 저장 상태와 블록 전체 저장 상태를 구분해 표시한다.

## 5. 시나리오 D: 동일 속성 Lock 충돌

사용자 A가 content Lock을 보유한 상태에서 사용자 B가 동일 속성 Lock을 요청한다.

### 예상 동작

1. A의 Lock 획득 성공
2. B의 Lock 요청
3. B의 Lock 획득 거부
4. PROPERTY_LOCK_DENIED 이벤트 발생
5. B의 DB 변경은 발생하지 않음

Lock 소유자와 만료 시각을 화면에 표시한다.

## 6. 시나리오 E: 텍스트 크기 변경

사용자 A가 style.fontSize를 16에서 24로 변경한다.

### 네트워크 흐름

PROPERTY_LOCK_REQUEST

PROPERTY_LOCK_GRANTED

PROPERTY_UPDATE

PROPERTY_UPDATED

Debounce 예약

PROPERTY_PERSISTED

### DB 변경

block_live_state.content의 style.fontSize 변경

block_live_state.revision 증가

block_property_state의 style.fontSize revision 증가

block_version INSERT는 발생하지 않는다.

## 7. 시나리오 F: 요소 위치 변경

사용자 A가 E001의 Y 좌표를 100에서 300으로 변경한다.

### 네트워크 흐름

1. position.y Lock 요청
2. Lock 획득
3. PROPERTY_UPDATE
4. 실시간 전파
5. Debounce 예약
6. 1초 후 DB 저장

### DB 변경

template_live_element:

- template_id = T001
- template_element_id = E001
- props.position.y: 100 → 300

template_element_property_state:

- property_path = position.y
- revision 증가
- persisted_revision 증가
- last_fencing_token 갱신

template_live_state:

- revision 증가
- persisted_revision 증가

block_live_state는 변경하지 않는다.

## 8. 시나리오 G: 요소 추가

사용자가 새로운 이미지 요소를 추가한다.

### 예상 동작

1. ELEMENT_CREATE 요청
2. 서버에서 템플릿 구조 revision 확인
3. 템플릿 단위 구조 Lock 또는 직렬화 처리
4. 새로운 block 생성
5. 필요한 block_version과 콘텐츠 행 생성
6. template_element 생성
7. template_live_element 생성
8. template_live_state revision 증가
9. 다른 사용자에게 STRUCTURE_UPDATED 전파
10. Debounce 저장 예약

초기 요소 생성 시에는 실제 서비스 정책에 따라 빈 상태를 생성하거나 최초 콘텐츠 버전을 생성할 수 있다.

이 시뮬레이터에서는 빈 이미지 블록의 초기 버전 생성 정책을 일관되게 적용한다.

### v1.1 확정 정책

위 5번과 10번을 다음과 같이 대체한다.

- 신규 block은 current_version_id = NULL로 생성한다.
- block_version과 block_image 행은 생성하지 않는다.
- block_live_state를 INSERT한다. (base_block_version_id = NULL, content = {"file_url":null,"alt_text":"","width":300,"height":200}, revision 0)
- 구조 변경은 Debounce 없이 즉시 하나의 트랜잭션으로 저장한다. (block, block_live_state, template_element, template_live_element INSERT 및 template_live_state UPDATE)
- 템플릿 구조 revision(baseStructureRevision)이 맞지 않으면 STRUCTURE_CONFLICT로 거부한다.
- 최초 block_version(BV00n)과 block_image 행은 첫 명시적 저장 시 생성한다.

### 예상 DB 변경

- block: B002 INSERT (kind=image, current_version_id=NULL)
- block_live_state: B002 INSERT
- template_element: E002 INSERT
- template_live_element: (T001, E002) INSERT
- template_live_state: revision 증가, persisted_revision 증가

### 변경하지 않는 테이블

- block_version, block_image, template_version, template_version_element

## 9. 시나리오 H: 요소 삭제

사용자가 E001을 삭제한다.

### 예상 동작

1. ELEMENT_DELETE 요청
2. 서버에서 구조 변경 순서 확인
3. 요소 삭제 승인
4. template_live_element에서 해당 행 DELETE
5. template_element.deleted_at 갱신
6. template_live_state revision 증가
7. 다른 사용자에게 STRUCTURE_UPDATED 전파

주의:

과거 template_version_element 행은 삭제하지 않는다.

과거 버전에서 해당 요소를 조회할 수 있어야 한다.

### v1.1 추가 규칙

- 구조 변경이므로 Debounce 없이 즉시 저장한다.
- E001에 대기 중인 배치 속성 Debounce가 있으면 취소한다. 취소된 revision은 대체 완료로 처리한다.
- E001에 걸린 Lock은 해제한다.
- (v1.2.5) 단, 다른 사용자가 E001 또는 그 블록의 Lock을 보유(편집 중)하면 삭제는 `ELEMENT_LOCKED`로 거부된다 (DB_SCHEMA §8.10.5). 해제 대상은 요청자 본인의 Lock이다.
- block B001과 block_live_state는 삭제하지 않는다. 다른 템플릿이 참조할 수 있기 때문이다.
- template_element_property_state의 E001 행은 이력으로 유지한다.

## 10. 시나리오 I: 명시적 저장

사용자가 저장 버튼을 누른다.

현재 상태:

- 텍스트: 안녕하세요! 반갑습니다.
- fontSize: 24
- 위치: x=100, y=300

### 처리 순서

1. 저장 요청
2. 저장되지 않은 Live 변경 확인
3. 최신 승인 상태 확인
4. PostgreSQL 트랜잭션 시작
5. 변경된 블록의 block_version 생성
6. 종류별 콘텐츠 테이블 INSERT
7. block.current_version_id UPDATE
8. template_version 생성
9. template_version_element에 전체 구성 INSERT
10. template.current_version_id UPDATE
11. block_live_state.base_block_version_id 갱신
12. COMMIT
13. 저장 완료 이벤트 전파

### 예상 결과

block_version:

- BV001은 유지
- BV002 신규 생성

block_text:

- BV002 신규 생성

template_version:

- TV002 신규 생성

template_version_element:

- TV002에 해당하는 구성 전체 INSERT

기존 버전은 변경하지 않는다.

### v1.1 추가 규칙

- 2번 단계에서 대기 중인 Debounce를 모두 flush한다. (같은 트랜잭션 앞단)
- 블록 변경 여부는 Live content와 current_version 스냅샷(block_text의 body와 style)을 비교해 판단한다.
- 변경되지 않은 블록은 기존 block_version을 재사용한다. (verification: 같은 상태로 다시 저장하면 BV를 새로 만들지 않고 TV003의 TVE가 BV002를 참조)
- current_version_id = NULL인 신규 블록은 항상 최초 block_version을 생성한다.
- 템플릿 전체에 변경이 없으면 NO_CHANGES로 응답하고 아무 버전도 생성하지 않는다.
- block_text BV002: body = "안녕하세요! 반갑습니다.", style = {"fontSize":24,"color":"#000000"}
- template_version_element TVE002: block_version_id = BV002, props.position.y = 300

### v1.2.3 이벤트 흐름 (DB_SCHEMA.md §8.11)

TEMPLATE_SAVE → TEMPLATE_SAVE_ACK → VERSION_SAVE → TEMPLATE_SAVED

- TEMPLATE_SAVE_ACK는 요청 승인이다. 이 시점에는 PostgreSQL에 버전이 아직 없다.
- VERSION_SAVE가 실제 트랜잭션이다. 위 1~12단계와 대기 중 Debounce flush가 이 트랜잭션 안에서 실행된다.
- 13단계 "저장 완료 이벤트 전파"는 TEMPLATE_SAVED 알림이다.
  - Broadcast/Delivery로 전달하며, Redis Stream에는 기록하지 않는다.
  - documentView와 전역 순번을 변경하지 않는다.
- NO_CHANGES는 TEMPLATE_SAVE_ACK(noChanges = true)로 응답하며, TEMPLATE_SAVED는 발생하지 않는다.
- 트랜잭션이 실패하면 롤백하고 TEMPLATE_SAVE_REJECTED를 기록한다. TEMPLATE_SAVED는 발생하지 않는다.
  - payload: code = DB_WRITE_FAILED, stage = transaction, operation = TEMPLATE_SAVE, requestId, 원인
  - 이미 보낸 ACK는 다시 보내지 않는다.

## 11. 시나리오 J: 과거 버전 복원

사용자가 TV001을 복원한다.

### 처리 순서

1. 복원 요청
2. 현재 저장되지 않은 변경 처리
3. TV001의 구성 조회
4. 새로운 template_version 생성
5. restored_from_version_id = TV001 설정
6. TV001의 template_version_element 데이터를 새 버전으로 복사
7. template.current_version_id 변경
8. template_live_element를 복원된 구성으로 갱신
9. 다른 사용자에게 구조 변경 이벤트 전파

### 주의

기존 TV001과 TV002는 변경하거나 삭제하지 않는다.

블록 콘텐츠 복원은 공유 블록에 영향을 줄 수 있으므로 템플릿 구성 복원과 분리한다.

이 시뮬레이터의 기본 복원 동작은 템플릿 구성과 당시 참조하던 block_version을 복원하는 것으로 한다.

### v1.1 확정 정책

- 2번 단계: 대기 중인 Debounce를 flush한다.
- 4~6번: TV003을 생성한다. (restored_from_version_id = TV001)
  - TV001의 template_version_element를 TVE003으로 복사한다. block_version_id는 BV001을 그대로 유지한다.
- 8번: template_live_element의 props, sequence, render_zone을 복원한다. (E001 position.y 300 → 100)
- block_live_state와 block.current_version_id는 변경하지 않는다. B001 Live 콘텐츠는 "안녕하세요! 반갑습니다."로 유지된다.
- TV003이 참조하는 BV001 콘텐츠("안녕하세요", fontSize 16)와 현재 Live 콘텐츠가 다르므로 CONTENT_MISMATCH 경고를 표시한다.
  - 경고에는 block_id, 참조 버전, 다른 필드와 그 값의 비교를 포함한다.
- 복원 대상 요소가 삭제된 상태라면 template_element.deleted_at = NULL로 되돌리고 template_live_element를 다시 INSERT한다.
  - 변형 실행: precondition I 뒤에 H(E001 삭제)를 적용하고 J를 실행한다.
- 복원 구성에 없는 현재 요소는 live 행을 DELETE하고 deleted_at을 설정한다.
- template_live_state revision이 증가한다. 다른 사용자에게 STRUCTURE_UPDATED를 전파한다.

### v1.2.3 전파와 거부 (DB_SCHEMA.md §8.11)

이벤트 흐름:

TEMPLATE_RESTORE → TEMPLATE_RESTORE_ACK → VERSION_SAVE → STRUCTURE_UPDATED (REPLACE_TEMPLATE_STRUCTURE) → CONTENT_MISMATCH

- 9번 단계는 STRUCTURE_UPDATED 안에 전체 교체 명령 REPLACE_TEMPLATE_STRUCTURE를 담아 전파한다. 개별 요소 추가·삭제 이벤트를 반복하지 않는다.
  - 명령 필드: templateId, 복원 대상 templateVersionId, structureRevision, 요소별 templateElementId·blockId·blockVersionId·sequence·renderZone·props
  - 요청자를 포함한 접속자가 같은 명령으로 구성을 교체한다.
- structureRevision은 정확히 1 증가한다.
- CONTENT_MISMATCH는 Broadcast/Delivery 알림으로 전달하며, Redis Stream에는 기록하지 않는다.
- TEMPLATE_RESTORE_ACK(요청 승인)와 STRUCTURE_UPDATED(결과 전파)는 별개 이벤트다.
- 트랜잭션이 실패하면 TEMPLATE_RESTORE_REJECTED를 기록한다(DB_WRITE_FAILED, stage = transaction, operation = TEMPLATE_RESTORE). STRUCTURE_UPDATED와 CONTENT_MISMATCH는 발생하지 않는다.
- 복원 대상 버전이 없거나 요청한 템플릿의 버전이 아니면 TEMPLATE_RESTORE_REJECTED(VERSION_NOT_FOUND, stage = validation)로 거부한다.
  - 이때 PostgreSQL, Redis Live, structureRevision은 변경되지 않는다.

### 예상 결과

- template_version: TV001, TV002 유지, TV003 INSERT
- template_version_element: TVE001, TVE002 유지, TVE003 INSERT
- template.current_version_id: TV002 → TV003
- block_version, block_text, block_live_state: 변경 없음

## 12. 시나리오 K: 공유 블록 (v1.1 추가)

### precondition (FIXTURE)

v1.2.3: T002는 Fixture 생성 로직(applyFixture)으로 만들고 FIXTURE 이벤트를 기록한다(DB_SCHEMA.md §8.11.6).

- 시나리오 실행기는 초기화 과정에서 이 로직을 실행한다. createdBy = ScenarioRunner, Phase 6
- 실행 중에는 Simulation Console 버튼으로 같은 로직을 실행할 수 있다. createdBy = SimulationConsole
- U002가 T002로 처음 전환하면 최초 SYNC 스냅샷으로 T002를 로드한다.

- template T002 (name: 경력 템플릿, current_version_id: TV101)
- template_version TV101 (template_id T002, version 1)
- template_element E101 (template_id T002, block_id B001)
- template_live_element (T002, E101, B001, sequence 1, main, props {"position":{"x":40,"y":40},"size":{"width":200,"height":80}})
- template_version_element TVE101 (TV101, E101, BV001, 1, main, 위와 같은 props)
- template_live_state (T002, revision 0, persisted_revision 0)

### 사용자 행동

1. 사용자 A가 T001에서 B001 content를 "공유 블록 수정"으로 변경한다.
2. 사용자 B(U002)가 T002를 보고 있다. (precondition에서 U002의 viewingTemplateId만 T002로 변경. U001, U003, U004는 T001 유지)
3. 사용자 A가 T001의 E001 position.x를 100 → 250으로 변경한다.
4. 사용자 B가 T002의 E101 size.width를 200 → 260으로 변경한다.

### 예상 동작

- 1번의 PROPERTY_UPDATED는 B001을 보고 있는 모든 클라이언트(T001, T002 화면)에 전파된다.
- block_live_state(B001)는 한 행만 존재하며, 한 번만 갱신된다.
- 3번은 template_live_element(T001, E001)만 변경한다. (T002, E101)의 props는 그대로다.
- 4번은 template_live_element(T002, E101)만 변경한다. (T001, E001)의 props는 그대로다.
- template_live_state는 T001과 T002가 각각 독립적으로 revision이 증가한다.
- Lock 키:
  - 콘텐츠: lock:block:B001:content (두 템플릿이 공유)
  - 배치: lock:template:T001:element:E001:position.x, lock:template:T002:element:E101:size.width (독립)
- 변형 실행: 사용자 B가 T002에서 B001 content Lock을 요청하면, A가 Lock을 보유한 동안 PROPERTY_LOCK_DENIED가 발생한다.

## 13. 시나리오 L: PostgreSQL 저장 실패와 재시도 (v1.1 추가)

### 설정

- PostgreSQL 실패 주입: 다음 2회의 쓰기 트랜잭션 실패 (오류: "connection reset (mock)")

### 사용자 행동

사용자 A가 B001 content를 "재시도 테스트"로 변경한다.

### 예상 동작

| 시각(승인 기준) | 동작 |
| --------------- | ---- |
| t | 승인, 실시간 전파, Debounce 예약 (dueAt = t+1000) |
| t+1000 | flush 실패, 롤백, status=FAILED, attempt=1, nextRetryAt=t+2000, PROPERTY_PERSIST_FAILED 전파 |
| t+2000 | 재시도 실패, attempt=2, nextRetryAt=t+4000 |
| t+4000 | 재시도 성공, revision=1, persisted_revision=1, PROPERTY_PERSISTED 전파 |

- 실패 중에도 Redis Live 상태와 양쪽 클라이언트 화면은 "재시도 테스트"를 유지한다.
- 실패 중 PostgreSQL block_live_state는 이전 값(revision 0)을 유지한다.
- UI에 실패 상태(FAILED), 시도 횟수, 다음 재시도까지 남은 시간을 표시한다.
- 변형 1 (v1.2.2): 실패 주입 4회 → 최초 시도 1회와 재시도 3회가 모두 실패하면 DEAD 상태가 되고 "수동 재시도" 버튼이 표시된다.
  - t+1000 실패(attempt 1) → t+2000 실패(attempt 2) → t+4000 실패(attempt 3) → t+8000 실패(attempt 4, DEAD)
  - 재시도 간격 1초·2초·4초와 횟수 계산은 DB_SCHEMA.md §8.10.7을 따른다.
- 변형 2: 재시도 대기 중 새 입력 → 일반 Debounce로 재예약하고 attempt를 0으로 초기화한다.
- (v1.2.4) DEAD 상태의 수동 재시도는 1회 시도이며, 실패하면 다시 DEAD가 된다. 시도 기록과 실패 주입 규칙은 DB_SCHEMA.md §8.12를 따른다.
- (v1.2.4) 시나리오 실행기는 L과 변형 1(L-DEAD)을 제공한다. 실패 주입은 precondition 구간에서 FAULT_INJECTION으로 기록한다.

## 14. 시뮬레이터 공통 규칙

- 모든 이벤트는 이벤트 로그에 순서대로 기록한다.
- 각 이벤트에는 실행 주체, 발생 시각, 대상, 요청 데이터, 처리 결과를 표시한다.
- DB 변경은 CRUD 단위로 기록한다.
- 변경 전과 변경 후 데이터를 비교할 수 있어야 한다.
- INSERT, UPDATE, DELETE를 색상으로 구분한다.
- Debounce 대기 시간을 확인할 수 있어야 한다.
- 시간 진행은 사용자가 일시정지, 재개, 단계별 실행할 수 있어야 한다.
- 초기화하면 모든 데이터, 이벤트, Lock, 예약 작업을 초기 상태로 되돌린다.
- 같은 시나리오를 반복해도 결과가 예측 가능해야 한다.
- 시뮬레이션 시간과 실제 시스템 시각을 혼용하지 않는다.
- (v1.1) Redis Live 상태와 PostgreSQL Persisted 상태를 나란히 비교해 표시한다. (revision, persisted_revision, 저장 대기 여부)
- (v1.1) 속성별 저장 상태와 블록·템플릿 전체 저장 상태를 구분해 표시한다.
- (v1.1) 세부 정책은 DB_SCHEMA.md §7을 따른다.
- (v1.2) 모든 이벤트에 requestId, actorUserId, actorName, timestamp, target, propertyPath, payload, result, sequence를 기록한다.
- (v1.2) 사용자 시점 전환은 네트워크 이벤트를 발생시키지 않는다. 시나리오 결과에 영향을 주지 않는다.
- (v1.2) Presence(선택, 커서) 이벤트는 Pub/Sub 카테고리로 별도 기록하고, 시나리오 기대값 비교에서 제외한다.
- (v1.2) 세부 정책은 DB_SCHEMA.md §8을 따른다.
- (v1.2.4) 전체 초기화, 시나리오 실행기, 재시도·DEAD, 실패 주입은 DB_SCHEMA.md §8.12를 따른다.
- (v1.2.3) 저장·복원 이벤트, VERSION_NOT_FOUND, REPLACE_TEMPLATE_STRUCTURE, 최초 SYNC 스냅샷, Fixture 생성 경로는 DB_SCHEMA.md §8.11을 따른다.

## 15. 다중 사용자 검증 (v1.2 추가)

기존 시나리오 A~L의 기대 결과는 변경하지 않는다.

다음은 다중 사용자 시점과 동시 편집 검증 항목이다. 시나리오 엔진은 한 시나리오 안에서 여러 actor의 요청을 순차적으로 또는 같은 시각에 발생시킬 수 있다. 각 요청에는 정확한 actorUserId가 포함된다.

| ID | 검증 | 기대 결과 |
| -- | ---- | --------- |
| MU-1 | U001이 B001 content 수정 | 부모 브로드캐스트 1건, Delivery 3건(U002, U003, U004). 각 replica의 lastReceivedRevision 갱신 |
| MU-2 | U001 style.fontSize, U002 style.color 동시 편집 | 두 Lock 모두 획득 (시나리오 C 정책) |
| MU-3 | U001, U002가 같은 content Lock 요청 | 나중 요청 PROPERTY_LOCK_DENIED, 소유자 U001 표시 (시나리오 D 정책) |
| MU-4 | U003은 E001 선택, U004는 다른 요소 선택 | 각 replica의 selectedElementId가 서로 영향을 주지 않음 |
| MU-5 | U001 선택 및 속성 패널 상태 → U002로 시점 전환 → U001로 복귀 | U001의 선택, 속성, 커서 상태가 그대로 복원됨. 네트워크 이벤트 0건 |
| MU-6 | Timeline 사용자 필터 | 선택한 actorUserId의 이벤트만 표시 |
| MU-7 | U003 연결 끊김 상태에서 U001 수정 | U003 Delivery는 QUEUED. 나머지 Delivery는 DELIVERED. U003은 "동기화 안 됨"으로 표시. 재연결 시 Stream 기반으로 따라잡기 |
| MU-8 | Optimistic 작업 3개 중 두 번째만 거부 | 두 번째만 제거되고 첫 번째와 세 번째는 유지됨 |
| MU-9 | U001이 수정한 속성을 U002가 다시 수정한 뒤 U001이 Undo | UNDO_CONFLICT. 값은 덮어써지지 않음 |
| MU-10 | 요소 삭제 후 Undo | ELEMENT_RESTORE. deleted_at = NULL, template_live_element 재생성 |
