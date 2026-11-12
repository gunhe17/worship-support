
# DB_SCHEMA.md

# 템플릿 편집기 DB 설계 기준

## 1. 프로젝트 목적

이 프로젝트는 실제 서비스를 구현하는 것이 아니라, 템플릿 편집기에서 이벤트가 발생할 때 DB와 네트워크 내부 상태가 어떻게 변화하는지 시각적으로 확인하는 시뮬레이터다.

아래 DB 구조를 시뮬레이션의 기준으로 사용한다.

실제 PostgreSQL이나 Redis를 연결하지 않고, 브라우저 내부의 Mock Database와 Mock Network Engine으로 동작시킨다.

## 2. 데이터 관리 원칙

데이터는 다음 세 가지 개념으로 분리한다.

1. Identity: 데이터의 정체성
2. Live State: 현재 편집 중인 상태
3. Version Snapshot: 사용자가 명시적으로 저장한 확정 상태

### 핵심 규칙

- 키 입력마다 block_version을 생성하지 않는다.
- 속성 변경은 실시간 상태 계층에 즉시 반영한다.
- 다른 사용자에게 변경 결과를 즉시 전파한다.
- 마지막 입력 이후 1초간 변경이 없으면 PostgreSQL의 Live 테이블을 갱신한다.
- 명시적 저장 버튼을 눌렀을 때만 새로운 버전 스냅샷을 생성한다.
- 과거 버전을 복원할 때 과거 행을 덮어쓰지 않고 새로운 버전을 생성한다.
- 구조 변경은 템플릿 단위로 순차 처리한다.
- Lock은 요소 전체가 아니라 속성 단위로 관리한다.

## 3. 핵심 테이블

### 3.1 block

블록의 정체성 정보를 저장한다.

| 컬럼               | 설명                                                            |
| ------------------ | --------------------------------------------------------------- |
| id                 | 블록 고유 ID                                                    |
| workspace_id       | Workspace ID                                                    |
| kind               | text, title, image, file, link, song, list, table, video, embed |
| current_version_id | 현재 확정 블록 버전                                             |
| created_by         | 생성 사용자                                                     |
| created_at         | 생성 시각                                                       |

### 3.2 block_version

블록의 확정 버전 이력을 저장한다.

| 컬럼       | 설명             |
| ---------- | ---------------- |
| id         | 블록 버전 ID     |
| block_id   | 대상 블록        |
| version    | 블록별 버전 번호 |
| changed_by | 저장 사용자      |
| changed_at | 저장 시각        |

명시적 저장 시에만 INSERT한다.

### 3.3 블록 종류별 콘텐츠 테이블

모든 콘텐츠 테이블의 id는 block_version.id와 동일한 값을 사용한다.

| 테이블      | 주요 컬럼                                          |
| ----------- | -------------------------------------------------- |
| block_text  | id, body, style (JSONB, v1.1 확장 — §7.1 참고)     |
| block_title | id, content, level, style                          |
| block_image | id, file_url, alt_text, width, height              |
| block_file  | id, file_url, file_name, mime_type, size_bytes     |
| block_link  | id, url, title                                     |
| block_song  | id, title, description, reference_url, musical_key |
| block_list  | id, items                                          |
| block_table | id, data                                           |
| block_video | id, video_url, metadata                            |
| block_embed | id, embed_url, metadata                            |

### 3.4 block_live_state

현재 편집 중인 블록 콘텐츠를 저장한다.

| 컬럼                  | 설명                      |
| --------------------- | ------------------------- |
| block_id              | 대상 블록                 |
| base_block_version_id | 기준 확정 버전            |
| content               | 현재 콘텐츠 JSON          |
| revision              | 현재 변경 순번            |
| persisted_revision    | PostgreSQL 저장 완료 순번 |
| updated_by            | 마지막 수정 사용자        |
| updated_at            | 마지막 수정 시각          |
| persisted_at          | 마지막 DB 저장 시각       |

revision과 persisted_revision은 서로 다른 개념이다.

예를 들어 revision=5, persisted_revision=3이라면 현재 변경은 5번까지 발생했지만 DB에는 3번까지만 저장된 상태다.

v1.1 정의 (§7.3):

- revision: PostgreSQL에 쓰는 시점의 Redis Live 블록 revision
- persisted_revision: 1번부터 연속적으로 저장 완료된 최대 블록 revision
- 속성별 debounce flush는 해당 property_path 값만 content에 병합하므로, 다른 속성의 미저장 변경이 남아 있으면 persisted_revision < revision일 수 있다.

### 3.5 block_property_state

블록 속성별 변경 순서와 저장 상태를 관리한다.

| 컬럼               | 설명                       |
| ------------------ | -------------------------- |
| block_id           | 블록 ID                    |
| property_path      | content, style.fontSize 등 |
| revision           | 속성 변경 순번             |
| persisted_revision | DB 저장 순번               |
| last_fencing_token | 마지막 승인 fencing token  |
| updated_at         | 마지막 변경 시각           |

PK는 (block_id, property_path)다.

### 3.6 template

템플릿의 정체성을 저장한다.

| 컬럼               | 설명                  |
| ------------------ | --------------------- |
| id                 | 템플릿 ID             |
| workspace_id       | Workspace ID          |
| name               | 템플릿 이름           |
| current_version_id | 현재 확정 템플릿 버전 |
| created_by         | 생성 사용자           |
| created_at         | 생성 시각             |

### 3.7 template_version

템플릿 전체 구성의 확정 버전 이력을 저장한다.

| 컬럼                     | 설명             |
| ------------------------ | ---------------- |
| id                       | 템플릿 버전 ID   |
| template_id              | 템플릿 ID        |
| version                  | 템플릿 버전 번호 |
| created_by               | 저장 사용자      |
| created_at               | 생성 시각        |
| restored_from_version_id | 복원 대상 버전   |

### 3.8 template_element

템플릿 내부 요소의 지속적인 정체성을 관리한다.

| 컬럼        | 설명             |
| ----------- | ---------------- |
| id          | 요소 고유 ID     |
| template_id | 템플릿 ID        |
| block_id    | 사용하는 블록 ID |
| created_at  | 생성 시각        |
| deleted_at  | 삭제 시각        |

버전이 바뀌어도 같은 요소라면 같은 template_element_id를 유지한다.

### 3.9 template_version_element

확정된 템플릿 버전의 요소 배치 정보를 저장한다.

| 컬럼                | 설명                 |
| ------------------- | -------------------- |
| id                  | 버전별 배치 행 ID    |
| template_version_id | 템플릿 버전          |
| template_element_id | 요소 ID              |
| block_version_id    | 참조하는 블록 버전   |
| sequence            | 배치 순서            |
| render_zone         | 배치 영역            |
| props               | 위치, 크기 등의 JSON |

### 3.10 template_live_state

템플릿 구조의 현재 변경 순번과 저장 순번을 관리한다.

| 컬럼               | 설명               |
| ------------------ | ------------------ |
| template_id        | 템플릿 ID          |
| revision           | 현재 구조 revision |
| persisted_revision | DB 저장 revision   |
| updated_by         | 마지막 수정 사용자 |
| updated_at         | 마지막 변경 시각   |
| persisted_at       | 마지막 저장 시각   |

### 3.11 template_live_element

현재 편집 중인 템플릿 요소 배치 상태다.

| 컬럼                | 설명           |
| ------------------- | -------------- |
| template_id         | 템플릿 ID      |
| template_element_id | 요소 ID        |
| block_id            | 블록 ID        |
| sequence            | 현재 순서      |
| render_zone         | 배치 영역      |
| props               | 현재 배치 속성 |
| updated_at          | 수정 시각      |

### 3.12 template_element_property_state

템플릿 요소의 속성별 변경 순서와 저장 상태를 관리한다.

| 컬럼                | 설명                                  |
| ------------------- | ------------------------------------- |
| template_id         | 템플릿 ID                             |
| template_element_id | 요소 ID                               |
| property_path       | position.x, position.y, size.width 등 |
| revision            | 변경 순번                             |
| persisted_revision  | DB 저장 순번                          |
| last_fencing_token  | 마지막 fencing token                  |
| updated_at          | 변경 시각                             |

PK는 (template_id, template_element_id, property_path)다.

## 4. Redis Mock 데이터

Redis는 PostgreSQL과 별도로 표현한다.

### Property Lock

예시 key:

lock:block:B001:content

lock:template:T001:element:E001:position.x

저장 정보:

- userId
- connectionId
- lockToken
- fencingToken
- expiresAt

### Debounce 예약

예시 key:

debounce:block:B001:content

저장 정보:

- revision
- lastUpdatedAt
- dueAt

### Live 상태 (v1.1 추가)

예시 key:

live:block:B001

live:template:T001

서버가 승인한 최신 상태를 보관한다. 실시간 화면의 원본이며, PostgreSQL Live 테이블보다 앞서 있을 수 있다.

- live:block:{blockId}: content, revision, 속성별 revision, 미저장 블록 revision 목록
- live:template:{templateId}: 요소 배치(props, sequence, render_zone), 구조 revision, 요소·속성별 revision, 미저장 revision 목록

### 저장 실패 및 재시도 상태 (v1.1 추가)

debounce 키에 다음 필드를 추가한다.

- status: WAITING | FLUSHING | FAILED | DEAD
- attempt: 재시도 횟수
- nextRetryAt: 다음 재시도 시각
- lastError: 마지막 실패 사유

### 실시간 이벤트

Redis Streams와 유사한 이벤트 로그를 시뮬레이션한다.

이벤트는 기록 순서와 함께 표시한다.

Redis Pub/Sub와 Redis Streams의 차이도 설명 패널에서 보여줄 수 있다.

## 5. 데이터 소유권 규칙

현재 설계에서는 동일한 block_id를 여러 템플릿이 참조하면 콘텐츠도 공유된다.

반면 position, size, rotation 등의 배치 속성은 template_element 단위로 독립 관리한다.

따라서 다음과 같이 구분한다.

- 블록 콘텐츠 수정: block_live_state
- 블록 콘텐츠 버전 생성: block_version 및 subtype 테이블
- 템플릿 요소 배치 수정: template_live_element
- 템플릿 배치 버전 생성: template_version_element

## 6. 시뮬레이터 구현 시 주의

실제 DB를 연결하지 않는다.

Mock DB는 실제 테이블과 동일한 테이블명, 컬럼명, 관계를 표현한다.

테이블 데이터는 JSON 객체 배열로 관리하고, CRUD 이벤트는 실제 상태에 반영한다.

화면에서 다음을 구분한다.

- INSERT: 초록색
- UPDATE: 파란색
- DELETE: 빨간색
- 변경 전 값: 회색 또는 취소선
- 저장 대기: 주황색
- 저장 완료: 초록색
- 네트워크 전송: 파란색
- Lock 획득: 보라색
- Lock 거부: 빨간색

모든 색상에는 텍스트 라벨과 아이콘을 함께 사용한다.

색상만으로 상태를 구분하지 않는다.

## 7. 확정 정책 (v1.1)

이 절은 구현 전에 확정한 정책이다. 앞 절과 충돌하면 이 절을 따른다.

### 7.1 스키마 확장

- block_text에 style JSONB 컬럼을 추가한다. 텍스트 블록의 style.fontSize, style.color를 버전 스냅샷에 보존하기 위함이다.
- 이 컬럼은 문서 원안에 없던 확장이므로, DB Explorer에서 "v1.1 확장 컬럼" 배지로 표시한다.
- 그 밖의 테이블과 컬럼은 원안 그대로 유지한다.

### 7.2 상태 계층

| 계층 | 위치 | 갱신 시점 |
| ---- | ---- | --------- |
| Live (승인된 최신 상태) | Redis live:* | 서버 승인 즉시 |
| Persisted Live | PostgreSQL block_live_state, template_live_element, template_live_state | 속성 변경은 Debounce 후, 구조 변경은 즉시 |
| Version Snapshot | block_version, 콘텐츠 테이블, template_version, template_version_element | 명시적 저장, 복원 시 |

### 7.3 속성별 Debounce와 revision

- Debounce 키는 속성 단위다. (debounce:block:B001:content, debounce:template:T001:element:E001:position.y)
- flush 시 해당 property_path 값만 PostgreSQL Live 행에 병합한다.
- 다른 속성의 아직 저장되지 않은 값을 함께 저장하지 않는다.
- 속성별 저장 여부는 block_property_state, template_element_property_state의 revision과 persisted_revision으로 추적한다.
- 한 속성이 flush되면, 그 속성에 속한 블록(또는 템플릿) revision 중 flush 시점 이하인 것은 모두 저장 완료로 본다. 이후 값이 이전 값을 대체하기 때문이다.
- 블록 전체 persisted_revision은 1번부터 연속적으로 저장 완료된 최대 revision이다.

예시 (시나리오 C 변형):

| 블록 rev | 속성 | 상태 |
| -------- | ---- | ---- |
| 1 | style.fontSize | 대기 (rev 3에서 다시 수정되어 Debounce 연장) |
| 2 | style.color | 먼저 flush 완료 |
| 3 | style.fontSize | 대기 |

이때 block_live_state는 revision=3, persisted_revision=0이다. 이후 style.fontSize가 flush되면 rev 1과 3이 함께 완료되어 persisted_revision=3이 된다.

- template_live_state도 같은 규칙을 따른다. 배치 속성 변경과 구조 변경이 모두 템플릿 revision을 증가시킨다.

### 7.4 revision 검사 기준

- PROPERTY_UPDATE의 baseRevision은 해당 속성의 revision과 비교한다.
- 구조 명령(ELEMENT_CREATE, ELEMENT_DELETE, ELEMENT_REORDER)은 템플릿 단위 직렬 큐에서 처리한다. 이때 마지막 구조 revision(structureRevision)만 비교한다.
- 배치 속성 변경과 구조 변경은 서로 revision 충돌을 일으키지 않는다.

### 7.5 Lock

- 속성 단위 Lock: lock:block:{blockId}:{path}, lock:template:{templateId}:element:{elementId}:{path}
- 블록 콘텐츠 Lock은 블록 단위 키라서, 여러 템플릿에서 같은 블록을 편집하면 같은 Lock을 두고 경쟁한다.
- TTL은 시뮬레이션 시간 10초다. PROPERTY_UPDATE를 받을 때마다 연장한다.
- 해제는 명시적 해제 또는 만료로만 일어난다.
- fencingToken은 Lock 키별로 단조 증가한다. (fence:{lockKey} INCR)
- last_fencing_token은 PostgreSQL 저장 시점에 기록한다.
- 크기 변경은 size.width와 size.height를 각각 별도 속성으로 Lock하고 관리한다.

#### 7.5.1 요소 편집 권한 (v1.2.8)

속성 단위 Lock 위에 **요소 단위 편집 권한**을 둔다. 한 요소는 한 번에 한 사용자만 편집한다.

- 키: `lock:template:{templateId}:element:{elementId}:edit` (값은 속성 Lock과 같은 LockValue). 기존 PROPERTY_LOCK_REQUEST / RELEASE 메시지로 요청·해제한다 (propertyPath = `edit`).
- 획득: 요소를 **선택하면** 클라이언트가 바로 요청한다. 입력하지 않아도 선택하는 동안 유지한다.
- TTL 없음: 선택하는 동안 유지한다. 해제는 ① 그 요소에서 나갈 때(다른 요소 선택, 빈 곳 클릭, 템플릿 전환, §8.10.5) ② 연결이 끊길 때(서버가 해제) ③ 요소 삭제.
  - 속성 Lock(10초 TTL, 입력마다 연장)은 그대로다. 편집 권한 보유자도 실제로 값을 바꿀 때는 속성 Lock을 받는다.
- 보호 범위: 다른 사용자가 편집 권한을 가진 요소에 대해서는 서버가 다음을 거부한다.
  - 그 요소 배치 속성과 그 블록 콘텐츠 속성의 PROPERTY_LOCK_REQUEST → PROPERTY_LOCK_DENIED (owner = 권한 보유자)
  - ELEMENT_DELETE, ELEMENT_REORDER → STRUCTURE_UPDATE_REJECTED (ELEMENT_LOCKED)
  - 같은 블록을 다른 템플릿에서 쓰는 경우에도 그 블록 콘텐츠는 보호된다 (블록을 쓰는 요소 중 하나라도 권한이 있으면).
- 대기와 넘기기:
  - 다른 사용자가 권한을 가진 요소를 선택하면 요청은 거부되고 서버 대기열 `lockwait:template:{T}:element:{E}:edit`(선택한 순서)에 들어간다. 화면은 **선택만** 되고 편집 UI(서식·편집 카드·순서·삭제)는 보이지 않으며, 요소 아이콘과 편집 중인 사용자 이름만 보인다.
  - 권한이 풀리면 서버는 대기열 앞에서부터 **아직 그 요소를 선택하고 있고(Presence) 연결된** 사용자에게 바로 넘긴다 (LOCK_HANDOFF 이벤트 + 그 사용자의 원래 요청에 대한 LOCK_RESULT granted). 그 사이 다른 곳으로 간 대기자는 건너뛴다.
  - 그래서 앞사람이 나갔다가 다시 선택해도, 기다리던 사람이 이미 권한을 가지고 있으면 선택만 된다.
- 선택 없이 보내는 명령(시나리오 실행기·API 수준의 PROPERTY_UPDATE)은 편집 권한이 없으므로 기존 속성 단위 규칙을 따른다. 시나리오 C(서로 다른 속성 동시 편집)는 이 수준에서 그대로 유효하지만, **편집기 화면에서는** 같은 요소를 두 사람이 동시에 편집하지 않는다.
- Presence와의 관계: 요소 선택은 Presence(PRS)이면서 편집 권한 요청(REQ)이다. 따라서 선택 변경은 네트워크 이벤트(PROPERTY_LOCK_REQUEST·GRANTED/DENIED, 해제)를 만든다. 커서 이동·속성 포커스 같은 순수 Presence는 여전히 네트워크 이벤트를 만들지 않는다 (§8.9.6).

### 7.6 구조 변경

- 요소 추가, 삭제, 순서 변경은 Debounce 없이 즉시 PostgreSQL 트랜잭션으로 반영한다.
- 신규 블록은 current_version_id = NULL로 생성하고, block_version과 콘텐츠 행은 만들지 않는다.
- 신규 블록의 block_live_state는 base_block_version_id = NULL로 생성한다.
- 신규 블록의 최초 block_version은 첫 명시적 저장에서 생성한다.
- 요소를 삭제하면 해당 요소의 대기 중인 Debounce를 취소한다. 취소된 revision은 대체 완료로 처리해 연속 저장 계산에서 막히지 않게 한다.

### 7.7 명시적 저장

- 저장 전에 대기 중인 모든 Debounce를 flush한다. (같은 트랜잭션 앞단)
- 블록의 변경 여부는 Live content와 current_version 스냅샷을 비교해 판단한다.
- 변경된 블록만 새 block_version을 만들고, 변경되지 않은 블록은 기존 block_version을 재사용한다.
- 템플릿 전체에 변경이 없으면 NO_CHANGES로 응답하고 버전을 생성하지 않는다.

### 7.8 복원

- 새 template_version을 생성하고 restored_from_version_id를 설정한다.
- 과거 template_version_element를 그대로 복사한다. 과거 block_version_id 참조도 그대로 유지한다.
- template_live_element의 배치 속성(props, sequence, render_zone)을 복원된 구성으로 갱신한다.
- block_live_state와 block.current_version_id는 변경하지 않는다. (공유 블록 보호)
- 복원 버전이 참조하는 block_version 콘텐츠가 현재 Live 콘텐츠와 다르면 CONTENT_MISMATCH 경고를 표시한다.
- 복원 대상 중 삭제된 요소는 template_element.deleted_at = NULL로 되돌리고 template_live_element를 다시 INSERT한다.
- 복원 구성에 없는 현재 요소는 삭제 처리한다. (live 행 DELETE, deleted_at 설정)
- 복원 전에 대기 중인 Debounce를 flush한다.
- 기존 template_version과 template_version_element 행은 변경하거나 삭제하지 않는다.

#### 7.8.1 복원 직전 자동 저장 (v1.2.9)

- 복원 요청(TEMPLATE_RESTORE)을 처리할 때, 복원하기 전에 §7.7 저장 판단을 먼저 한다. 마지막 버전 이후 바뀐 것이 있으면 **지금 상태를 일반 버전으로 저장**한 뒤 복원한다.
  - 자동 저장 버전: 일반 저장과 같다 (바뀐 블록만 block_version 생성, restored_from_version_id = NULL, created_by = 복원 요청자).
  - 이어서 복원 버전: 자동 저장 다음 번호, restored_from_version_id = 복원 대상.
  - 바뀐 것이 없으면 자동 저장 없이 복원 버전만 만든다 (지금처럼).
- 같은 요청 안에서 순서대로 처리한다 (자동 저장 트랜잭션 → 복원 트랜잭션). 클라이언트가 저장·복원을 따로 보내지 않으므로 그 사이에 다른 편집이 끼어들지 않는다.
- 이벤트 순서: TEMPLATE_RESTORE → TEMPLATE_RESTORE_ACK → VERSION_SAVE(자동 저장, payload.beforeRestore) → TEMPLATE_SAVED(알림, payload.beforeRestore) → VERSION_SAVE(복원) → STRUCTURE_UPDATED(REPLACE_TEMPLATE_STRUCTURE) → CONTENT_MISMATCH. 모두 같은 requestId.
- REPLACE_TEMPLATE_STRUCTURE에 자동 저장 버전(preservedTemplateVersionId, preservedVersion)을 담아 요청자가 결과에 표시한다. 같은 requestId의 TEMPLATE_SAVED 알림은 복원 완료로 처리하지 않는다.
- 자동 저장이 실패하면 복원도 하지 않는다 (TEMPLATE_RESTORE_REJECTED, stage = transaction, DB_WRITE_FAILED).
- 목적: 복원으로 사라질 수 있는 "복원 직전 배치·내용"을 언제나 되돌릴 수 있게 남긴다. 새 테이블·컬럼 없음.

### 7.9 저장 실패 및 재시도

- PostgreSQL 저장이 실패하면 트랜잭션을 롤백하고 Redis Live 상태를 유지한다.
- debounce 키의 status를 FAILED로 바꾸고 attempt와 nextRetryAt을 기록한다.
- 재시도 간격은 1000ms, 2000ms, 4000ms이며 최대 3회다. 모두 실패하면 DEAD가 되고 수동 재시도를 기다린다.
- 재시도 대기 중 새 입력이 들어오면 일반 Debounce(마지막 입력 + 1000ms)로 재예약하고 attempt를 초기화한다.
- 재시도에 성공하면 persisted_revision을 갱신하고 PROPERTY_PERSISTED를 전파한다.
- 실패할 때마다 PROPERTY_PERSIST_FAILED를 전파한다.

### 7.10 결정성

- 모든 ID는 순번으로 생성한다. (B002, BV002, TV002, TVE002, REQ001, ...)
- 모든 시각은 고정 기준 시각(2026-01-01T14:00:00.000)에 시뮬레이션 경과 시간을 더해 만든다.
- Debounce dueAt은 서버 승인 시각 + 1000ms다. 네트워크 지연 기본값은 10ms다.

## 8. 다중 사용자 시점 정책 (v1.2)

이 절은 다중 사용자 시점과 편집기 연결을 위해 추가된 정책이다.

PostgreSQL 21개 테이블과 관계, Redis Lock 키, 속성별 Lock, Fencing Token, Debounce, Persisted Revision, VirtualClock 정책(§7)은 변경하지 않는다.

### 8.0 변경 이력

#### 유지 (변경 없음)

- PostgreSQL 21개 테이블, 컬럼, 관계 (§3, §7.1의 block_text.style 확장 포함)
- Redis Lock 키, 속성 단위 Lock, TTL, Fencing Token (§7.5)
- 속성별 Debounce, 연속 Persisted Revision (§7.3)
- revision 검사 기준 (§7.4), 구조 변경 즉시 저장 (§7.6), 명시적 저장 (§7.7), 복원 (§7.8), 재시도 (§7.9)
- VirtualClock, 결정적 ID 순번, 시드 데이터 (§7.10)
- 시나리오 A~L의 기대 결과

#### 변경

- 사용자: U001 "사용자 A", U002 "사용자 B" → U001~U004 "사용자 1~4" 4명. 모두 T001 접속 상태로 시작.
- 실시간 전파: 단일 수신자 전송 → 부모 Broadcast 1건 + 수신자별 Delivery N건 (§8.3)
- Network Timeline 레인: Client A, Client B → Client U001~U004

#### 추가

- Client Replica 모델 (§8.1)
- Optimistic Update(pendingOps) (§8.1)
- Presence (§8.2)
- Broadcast Delivery (§8.3)
- Undo/Redo (§8.4)
- ELEMENT_RESTORE 명령 (§8.5)
- 요소 종류별 property_path 매핑 (§8.6)
- 이벤트 공통 필드 (§8.7)
- (v1.2.1) 실시간 전파·연결 구현 세부 (§8.9): 대상별 Stream 키와 전역 순번, 연결 이벤트 정의, disconnected Presence 유지, SYNC watermark, 초기 접속 비기록, requestId 접두사 분리

- (v1.2.2) 편집 처리 이벤트와 저장 알림 (§8.10): 편집 응답·Debounce·Lock 이벤트, PROPERTY_PERSISTED 전달 방식, Lock 해제 시점, 오프라인 편집 미지원, 저장 재시도 횟수 계산

- (v1.2.3) 명시적 저장·복원 이벤트와 전파 (§8.11): 저장·복원 이벤트 10종, VERSION_NOT_FOUND, 복원 결과의 REPLACE_TEMPLATE_STRUCTURE 전파, 처음 보는 템플릿의 최초 SYNC 스냅샷, Fixture 생성 경로

- (v1.2.4) Phase 6 구현 세부 (§8.12): 저장 재시도·DEAD·수동 재시도 기록, 최신 revision 보호, 실패 주입 범위, 전체 초기화, 시나리오 실행기

- (v1.2.5) Lock 해제 시점 변경 (§8.10.5): 포커스 해제·조작 완료가 아니라 편집 중인 사용자가 요소에서 나갈 때 해제. 시점 전환은 해제 사유가 아님

- (v1.2.6) 글자 꾸밈 속성 추가 (§8.6): text·title의 style.bold, style.italic, style.underline, style.strikethrough. 기존 style JSONB 확장 범위 안이며 테이블 구조 변경 없음

- (v1.2.7) 템플릿 이름 변경 명령 TEMPLATE_RENAME 추가 (§8.8.1): 구조 명령 경로, template.name UPDATE, INVALID_NAME 거부 코드. 테이블 구조 변경 없음

- (v1.2.9) 복원 직전 자동 저장 (§7.8.1): 복원 전에 바뀐 것이 있으면 그 상태를 먼저 버전으로 저장한 뒤 복원. 복원 한 번에 버전이 최대 2개. 테이블 구조 변경 없음

- (v1.2.8) 요소 편집 권한 (§7.5.1): 선택하면 요소 전체 편집 권한(`lock:...:edit`, TTL 없음), 다른 사용자는 선택만 가능, 나가면 선택하고 기다리던 사용자에게 순서대로 자동으로 넘김(`lockwait:` 대기열, LOCK_HANDOFF). 요소 선택이 편집 권한 요청 네트워크 이벤트를 만든다. 테이블 구조 변경 없음

#### v1.2.1 명문화 원칙

- §8.9는 구현 세부 사항을 명문화한 것이며, §7 및 §8.1~§8.8의 정책을 변경하지 않는다.
- §4의 "Redis Streams와 유사한 이벤트 로그"에 키 구조와 순번 규칙을 구체화한다.
- §7.10의 결정적 ID 규칙에 PRS 접두사를 추가한다. 기존 접두사의 순번 규칙은 그대로다.

### 8.1 Client Replica

각 사용자는 독립된 Client Replica를 갖는다. Replica는 DB 테이블이 아니라 시뮬레이터 클라이언트 상태다.

| 필드 | 설명 | 공유 여부 |
| ---- | ---- | --------- |
| userId | 사용자 ID | - |
| viewingTemplateId | 보고 있는 템플릿 | 사용자별 |
| selectedElementId | 선택한 요소 | 사용자별 |
| selectedPropertyPath | 편집 중인 속성 | 사용자별 |
| cursorPosition | 캔버스 좌표 커서 | 사용자별 |
| localSelection | 다중 선택, 텍스트 선택 범위 등 로컬 UI 상태 | 사용자별 |
| connectionStatus | connected / disconnected | 사용자별 |
| lastReceivedRevision | 수신 완료한 블록·템플릿별 revision | 사용자별 |
| documentView | 서버가 승인하고 이 클라이언트가 수신한 데이터 | 사용자별 사본 |
| pendingOps | 아직 서버 승인을 받지 못한 로컬 편집 작업 | 사용자별 |
| undoStack / redoStack | 이 사용자의 편집 이력 | 사용자별 |

- 실제 Live 데이터의 원본은 Redis live:*이고, Lock 정보는 Redis lock:*를 공유해서 읽는다.
- documentView는 공유 Live 상태를 수신한 사본이다. 전달 지연 동안에는 Live보다 뒤처질 수 있다.
- 화면 = documentView에 pendingOps를 순서대로 적용한 결과다. (render = fold(apply, documentView, pendingOps))
- 작업이 승인되면 해당 pendingOp를 제거하고, 서버 브로드캐스트 또는 응답으로 documentView에 반영한다.
- 작업이 거부되면 해당 pendingOp만 제거하고 나머지 pendingOps를 다시 적용한다. 화면이 파생값이므로 이후 정상 작업은 되돌려지지 않는다.
- 같은 대상의 이후 pendingOp가 거부된 작업에 의존한 경우에도 그 작업은 그대로 유지한다. 서버가 각 작업을 독립적으로 승인하거나 거부한다.
- 사용자 시점 전환은 표시 대상 replica만 바꾼다. 네트워크 이벤트, Lock, Debounce에 영향을 주지 않는다.

### 8.2 Presence

- Redis Pub/Sub 채널: presence:template:{templateId}
- Redis Hash: presence:template:{templateId} → userId별 {connectionId, status, selectedElementId, selectedPropertyPath, cursor, updatedAt}
- PRESENCE_UPDATE는 Pub/Sub로 전달하고 Redis Stream에 기록하지 않는다. (휘발성 데이터)
- 커서 이동은 50ms 단위로 throttle한다.
- Timeline에서는 Presence 카테고리로 분리하고 기본으로 숨긴다. 시나리오 기대값 비교에서도 제외한다.

### 8.3 Broadcast Delivery

- 실시간 전파는 부모 Broadcast 이벤트 1건과 수신자별 Delivery 이벤트 N건으로 기록한다.
- Broadcast: broadcastId, 원본 requestId, actor, 대상, revision, 수신 대상 목록
- Delivery: deliveryId, broadcastId, recipientUserId, status(SENT / DELIVERED / QUEUED / FAILED), sentAt, deliveredAt, revision
- 수신 대상: 해당 블록 또는 템플릿을 보고 있는 클라이언트 중 actor를 제외한 사용자 (§7.5 공유 블록 규칙 포함)
- 수신자별 상태는 독립적이다. 한 수신자의 실패가 다른 수신자의 상태에 영향을 주지 않는다.
- Delivery가 DELIVERED 될 때만 해당 replica의 documentView와 lastReceivedRevision을 갱신한다.
- disconnected 상태 사용자의 Delivery는 QUEUED가 되며, 해당 사용자는 "동기화 안 됨 (수신 rev / 현재 rev)"으로 표시한다.
- 재연결 시 lastReceivedRevision 이후의 Redis Stream 이벤트로 따라잡고, 완료된 후에만 동기화 상태로 표시한다.
- 모든 Delivery가 끝나기 전에는 Broadcast 상태를 PARTIAL로 표시한다.

### 8.4 Undo/Redo

- Undo/Redo는 DB 롤백이 아니라 새로운 편집 명령이다. 각 사용자의 undoStack에서 꺼내 역방향 명령을 발생시킨다.

| 원래 작업 | Undo 명령 |
| --------- | --------- |
| PROPERTY_UPDATE | 이전 값으로 PROPERTY_UPDATE |
| ELEMENT_CREATE | ELEMENT_DELETE |
| ELEMENT_DELETE | ELEMENT_RESTORE |
| ELEMENT_REORDER | 이전 위치로 ELEMENT_REORDER |

- Lock, Fencing Token, revision 검사, Debounce, 구조 직렬화 정책을 그대로 적용한다.
- 연속 입력(타이핑, 드래그)은 하나의 gesture로 묶어 하나의 Undo 항목으로 기록한다.
- Undo 충돌 조건: 대상 속성의 현재 값이 해당 Undo 항목의 적용 후 값과 다르거나, 이후 다른 사용자의 변경이 승인되었으면 UNDO_CONFLICT로 거부한다. 과거 값으로 덮어쓰지 않는다.
- 서버는 Redis live에서 속성별 lastActorUserId와 현재 값으로 이 조건을 검증한다.
- 구조 Undo 충돌 조건: ELEMENT_DELETE 대상이 이미 삭제된 경우, ELEMENT_RESTORE 대상이 삭제되지 않은 경우, ELEMENT_REORDER 대상의 현재 순서가 적용 후 순서와 다른 경우
- UNDO_CONFLICT가 발생하면 해당 항목을 스택에서 제거하고 충돌 사유를 표시한다.

### 8.5 ELEMENT_RESTORE

- 삭제된 template_element를 현재 템플릿에 다시 배치한다. (Undo 삭제용)
- §7.8의 요소 복원 정책을 재사용한다.
  - template_element.deleted_at = NULL
  - template_live_element INSERT
- 배치 값(sequence, render_zone, props)은 요청에 포함된 삭제 직전 값을 사용한다.
- 템플릿 단위 직렬 큐에서 처리하고 structureRevision을 검사한다. (§7.4)
- Debounce 없이 즉시 트랜잭션으로 저장한다. (§7.6)
- template_live_state revision을 증가시키고 STRUCTURE_UPDATED를 브로드캐스트한다.
- block, block_live_state, block_version은 변경하지 않는다. (삭제 시 블록을 지우지 않으므로 콘텐츠는 그대로 남아 있음)

### 8.6 요소 종류별 property_path 매핑

property_path는 Lock 키와 property_state의 단위다. JSON 경로는 live content 안의 위치다.

| kind | property_path → content JSON 경로 |
| ---- | --------------------------------- |
| text | content → body, style.fontSize, style.color, style.textAlign, style.bold, style.italic, style.underline, style.strikethrough → style.* |
| title | content → content, level → level, style.color, style.textAlign, style.bold, style.italic, style.underline, style.strikethrough → style.* |
| image | file_url, alt_text, width, height |
| file | file_url, file_name, mime_type, size_bytes |
| link | url, title |
| song | title, description, reference_url, musical_key |
| list | items |
| table | data |
| video | video_url, metadata |
| embed | embed_url, metadata |
| 배치 (공통) | position.x, position.y, size.width, size.height → template_live_element.props |

- 텍스트 정렬은 block_text.style.textAlign에 저장한다. 시드에 없으면 기본값은 "left"다. (§7.1 style 확장 범위 안이며, 새 컬럼이 아님)
- (v1.2.6) 글자 꾸밈은 style.bold, style.italic, style.underline, style.strikethrough(boolean)에 저장한다. 텍스트는 block_text.style, 제목은 block_title.style이며 §7.1 style 확장 범위 안이다 (새 컬럼·테이블 없음).
  - 요소 전체에 켜고 끄는 방식이다. 글자 일부 구간에만 적용하는 서식은 body/content를 서식 있는 구조로 바꿔야 하므로 범위 밖이다.
  - 값이 없으면 기본값: text는 모두 false, title은 bold=true(제목 기본 굵기), 나머지 false.
  - 각 항목이 독립된 property_path라 Lock·property_state·Debounce도 항목별이다 (예: 한 사용자가 bold를 바꾸는 동안 다른 사용자가 italic을 바꿀 수 있음).
- 시나리오 A의 property_path "content"는 text 블록의 body를 뜻한다.

### 8.7 이벤트 공통 필드

모든 네트워크·처리 이벤트는 다음 필드를 가진다.

- requestId
- actorUserId
- actorName
- timestamp (시뮬레이션 시각)
- target (blockId 또는 templateId/elementId)
- propertyPath (해당 시)
- payload
- result
- sequence (전역 순번)

### 8.8 시뮬레이터 표시 원칙

- 외부 네트워크 리소스를 불러오지 않는다. 이미지, 동영상, 임베드, 음악은 로컬 미리보기로 렌더링한다.
- (v1.2.7 변경) 템플릿 이름 변경은 TEMPLATE_RENAME 구조 명령으로 한다 (§8.8.1). 이전에는 명령이 없어 읽기 전용이었다.

#### 8.8.1 템플릿 이름 변경 (v1.2.7)

- 명령: STRUCTURE_COMMAND의 op `TEMPLATE_RENAME { templateId, name, previousName }`. 요소 추가·삭제·순서 변경과 같은 구조 명령 경로다.
  - 템플릿 단위 직렬 처리, baseStructureRevision 검사, Debounce 없이 즉시 트랜잭션.
  - 트랜잭션: `template.name` UPDATE, `template_live_state.revision` 갱신. 새 테이블·컬럼 없음.
  - 승인되면 revision·structureRevision이 1씩 오르고 STRUCTURE_UPDATED로 모든 접속자에게 전파된다. 처음 접속하는 사용자는 SYNC 스냅샷의 template.name으로 받는다.
- 검증: 앞뒤 공백을 뺀 이름이 1~60자여야 한다. 아니면 `INVALID_NAME`으로 거부한다 (STRUCTURE_UPDATE_REJECTED, DB·Redis 변경 없음).
- Lock 없음: 마지막에 승인된 이름이 남는다. 동시에 바꾸면 늦게 도착한 요청은 구조 revision 규칙(STRUCTURE_CONFLICT)을 따른다.
- Undo: 되돌리기는 `name = previousName`인 TEMPLATE_RENAME이다. 현재 이름이 기록과 다르면(다른 사용자가 먼저 바꿈) UNDO_CONFLICT.
- 버전과 무관하다: 이름은 template_version에 저장하지 않는다. 이름만 바꾸면 "버전 저장"은 NO_CHANGES이고, 과거 버전을 복원해도 이름은 바뀌지 않는다.

### 8.9 실시간 전파와 연결 구현 세부 (v1.2.1)

§8.2(Presence), §8.3(Broadcast Delivery)을 구현하기 위한 세부 규칙이다.

#### 8.9.1 대상별 Stream 키와 전역 순번

| 키 | 기록 대상 |
| -- | --------- |
| stream:block:{blockId} | 블록 콘텐츠 변경 (PROPERTY_UPDATED, scope=block) |
| stream:template:{templateId} | 템플릿 배치 변경과 구조 변경 (PROPERTY_UPDATED scope=element, STRUCTURE_UPDATED) |
| seq:stream | 전역 순번 카운터 (INCR) |

전역 순번(streamSeq):

- 승인된 변경을 XADD하기 직전에 중앙 카운터 `seq:stream`을 INCR하여 원자적으로 발급한다.
- 모든 Stream 항목에 streamSeq를 기록한다. Delivery 메시지와 SYNC 항목에도 같은 값을 포함한다.
- streamSeq는 서버 전체에서 단조 증가하고 중복되지 않는다.

전역 순번은 순서를 보장하지 않는다:

- streamSeq가 있다고 해서 여러 Stream의 소비 순서가 자동으로 보장되지 않는다.
- 소비자는 받은 항목을 적용하기 전에 아래 규칙으로 직접 검증한다.

소비자(클라이언트 replica)가 관리하는 값:

| 값 | 의미 |
| -- | ---- |
| lastReceivedRevision[target] | 대상(block:{id}, template:{id})별 마지막으로 적용한 revision (§8.1) |
| lastProcessedSeq | 현재 연결에서 마지막으로 처리한 streamSeq |

누락 감지:

- 한 클라이언트는 자신이 보는 대상의 항목만 받는다. 따라서 streamSeq가 건너뛰는 것만으로는 누락으로 판단하지 않는다.
- 누락은 대상별 revision 연속성으로 판단한다. 실시간 Delivery의 revision이 lastReceivedRevision[target] + 1보다 크면 누락이다.
- 같은 연결에서 받은 streamSeq가 lastProcessedSeq보다 작으면 순서 역전이다. 이 경우도 누락과 같이 처리한다.
- 누락이나 순서 역전을 감지하면 해당 항목을 적용하지 않는다. 클라이언트는 동기화 상태를 "따라잡는 중"으로 바꾸고, 같은 연결에서 HELLO를 다시 보내 SYNC로 복구한다.

중복 방지:

- revision ≤ lastReceivedRevision[target]인 항목은 이미 적용한 것이므로 무시한다. 실시간 수신 후 SYNC로 다시 읽은 경우도 같다.
- 중복을 무시해도 lastReceivedRevision과 lastProcessedSeq는 되돌리지 않는다.

#### 8.9.2 연결·전파 이벤트 정의

이벤트는 세 종류로 구분한다.

- 클라이언트 요청·연결 이벤트: 클라이언트와 WS 서버 사이의 연결 상태와 요청
- Redis 내부 동작 이벤트: 서버와 Redis 사이의 동작. 클라이언트에 전달되지 않는다.
- 클라이언트 전달 이벤트: 서버가 클라이언트에 보내는 데이터와 그 전달 결과

모든 이벤트는 §8.7의 공통 필드를 가진다.

| 이벤트 | 구분 | 발생 조건 | actor | 송신 → 수신 | payload | 처리 결과 |
| ------ | ---- | --------- | ----- | ----------- | ------- | --------- |
| WS_OPEN | 요청·연결 | 클라이언트가 전송 연결을 새로 수립 (재연결) | 연결하는 사용자 | Client → WS | connectionId | OK |
| HELLO | 요청·연결 | WS가 연결 후 첫 메시지를 수신. 누락 복구를 위한 재요청도 포함 | 연결하는 사용자 | Client → WS | templateId, lastReceivedRevision, lastProcessedSeq, connectionId | OK |
| VIEW_TEMPLATE | 요청·연결 | 접속 중인 사용자가 보는 템플릿을 변경 (예: 시나리오 K의 U002) | 전환하는 사용자 | Client → WS | templateId, lastReceivedRevision, lastProcessedSeq | OK |
| CLIENT_DISCONNECTED | 요청·연결 | WS가 연결 종료를 감지 | 연결이 끊긴 사용자 | Client → WS | connectionId | INFO (Presence status=disconnected) |
| STREAM_XADD | Redis 내부 | 변경 승인 직후, Stream에 기록 | 원 요청의 actor | WS → Redis | key, streamId, streamSeq, name, revision | OK |
| STREAM_READ | Redis 내부 | HELLO 또는 VIEW_TEMPLATE 처리 중 누락 항목 조회 (XRANGE) | 연결·전환하는 사용자 | WS → Redis | keys, 대상별 after revision, syncWatermark, 조회 건수 | OK |
| SYNC | 클라이언트 전달 | STREAM_READ 직후 요청자에게 응답 | 연결·전환하는 사용자 | WS → Client | templateId, syncWatermark, changes(target, revision, streamSeq), Presence 스냅샷 | OK (전송) |
| PROPERTY_UPDATED / STRUCTURE_UPDATED | 클라이언트 전달 (부모 Broadcast) | STREAM_XADD 직후 | 원 요청의 actor | WS → 수신 대상들 | broadcastId, revision, streamSeq, recipients, op | 수신자 0명이면 OK, 아니면 PARTIAL |
| DELIVERY | 클라이언트 전달 (수신자별) | 수신자 1명의 전달 상태가 확정될 때 | 원 요청의 actor (수신자는 payload의 recipientUserId) | WS → 수신자 | deliveryId, broadcastId, recipientUserId, revision, streamSeq, via(live / catch-up) | QUEUED / DELIVERED / FAILED |

- Redis 내부 동작 이벤트(STREAM_XADD, STREAM_READ)는 Timeline의 Redis 레인에 표시한다. 클라이언트 replica를 변경하지 않는다.
- 클라이언트 replica는 클라이언트 전달 이벤트가 도착해 적용될 때만 변경된다.
- DELIVERY의 actor는 원 요청의 actor다. 사용자 필터(MU-6)도 이 actor 기준이다.
- DELIVERY의 FAILED는 전송 중 연결이 끊겨 유실된 경우다. §7.9의 저장 실패 상태(FAILED/DEAD)와는 다른 개념이다.
- PRESENCE_UPDATE는 §8.2에 따라 Presence 카테고리로만 기록한다. 위 표의 이벤트와 섞지 않는다.

#### 8.9.3 연결이 끊긴 사용자의 Presence와 Delivery

- 연결이 끊긴 사용자는 Presence Hash(presence:template:{templateId})에 status=disconnected로 남긴다. connectionId, selectedPropertyPath, cursor는 비운다.
- 이 항목은 수신 대상 판정(§8.3)에 사용한다. 따라서 끊긴 사용자도 해당 템플릿의 Delivery 대상에 포함된다.
- Presence 상태와 Delivery 상태는 독립적으로 관리한다.
  - disconnected 사용자에 대한 Delivery는 성공(DELIVERED)으로 처리하지 않는다.
  - 연결이 없어 보내지 못한 Delivery는 QUEUED로 유지한다.
  - 전송 중 연결이 끊긴 Delivery는 FAILED로 기록한다.
- 실시간 Delivery의 DELIVERED(via=live)는 클라이언트가 적용했거나 이미 가진 revision(중복)임을 확인한 시점이다.
  - 도착만으로는 DELIVERED가 되지 않는다.
  - 누락 감지로 적용하지 않은 Delivery는 SENT로 남는다.
  - 시뮬레이터에서는 클라이언트의 적용 보고를 지연 없는 ACK로 처리한다.
- QUEUED, FAILED, 그리고 적용되지 않은 SENT Delivery는 SYNC가 클라이언트에 도착해 적용된 시점에만 DELIVERED(via=catch-up)로 바꾼다. 대상은 streamSeq ≤ syncWatermark인 것이다.
- 해당 사용자의 수신 상태(lastReceivedRevision, lastProcessedSeq, 동기화 표시)도 그 시점에만 갱신한다.
- 끊긴 동안 다른 템플릿으로 전환한 뒤 재연결하면, 이전 템플릿의 disconnected 항목을 삭제한다.

#### 8.9.4 재연결과 SYNC 경계 (syncWatermark)

서버의 HELLO, VIEW_TEMPLATE 처리 순서:

1. 서버 세션을 "참여 중"으로 표시하고 Presence를 connected로 갱신한다.
2. syncWatermark를 현재 `seq:stream` 값으로 확정한다.
3. STREAM_READ로 대상(템플릿과 그 템플릿에 배치된 블록)별 Stream을 읽는다.
   - streamSeq ≤ syncWatermark
   - revision > 클라이언트가 보낸 lastReceivedRevision[target]
4. 조회한 항목을 streamSeq 오름차순으로 SYNC에 담아 전송한다.

1~4는 서버에서 하나의 처리 단위로 실행하며, 그 사이에 다른 승인이 끼어들지 않는다.

경계 규칙:

- HELLO 처리 전(참여 전)에 승인된 변경은 Delivery를 QUEUED로 두고, SYNC로 따라잡는다. 전송 연결이 이미 열려 있어도 같다.
- streamSeq > syncWatermark인 변경은 SYNC에 포함하지 않는다. 이 변경은 별도 실시간 Delivery로 보낸다.
- 클라이언트는 따라잡는 중에 도착한 실시간 Delivery 중 streamSeq > syncWatermark인 것을 보류한다. SYNC를 적용한 뒤 streamSeq 순서로 적용한다.
- 클라이언트는 SYNC를 다음 순서로 적용한다.
  1. changes를 streamSeq 순으로 적용한다. 대상별 revision 연속성과 중복 규칙(§8.9.1)을 따른다.
  2. lastReceivedRevision[target]을 갱신한다.
  3. lastProcessedSeq = syncWatermark로 설정한다.
  4. 보류한 실시간 Delivery를 적용한다.
  5. 동기화 상태로 표시한다.
- 이 규칙에 따라 SYNC 도중 발생한 변경은 누락되거나 두 번 반영되지 않는다.

#### 8.9.5 초기 접속

- 초기 사용자 4명의 접속 상태는 시드로 생성한다. 시드 항목은 다음과 같다.
  - 연결: CONN001~CONN004
  - 서버 세션: T001 참여
  - Presence Hash: status=connected
  - Pub/Sub 구독
  - 각 replica: connectionStatus=connected, 동기화 상태
- 초기 접속에는 WS_OPEN, HELLO, SYNC 등 연결 이벤트를 기록하지 않는다. 시작 시 이벤트 로그는 0건이다.
- 연결 이벤트는 실제 연결 해제(CLIENT_DISCONNECTED)와 재연결(WS_OPEN, HELLO, STREAM_READ, SYNC)부터 기록한다.
- 시드로 만든 Redis 키와 구독은 Redis 명령 로그에 남을 수 있다. 이는 이벤트 로그(Timeline)와 별개다.

#### 8.9.6 requestId 접두사

| 접두사 | 용도 | 순번 |
| ------ | ---- | ---- |
| REQ | 편집 명령, 시나리오 요청, HELLO, VIEW_TEMPLATE | 독립 순번 (REQ001 ...) |
| PRS | Presence 요청 (선택, 커서) | 독립 순번 (PRS0001 ...) |

- 두 순번은 서로 완전히 독립적이다.
- 마우스 이동과 선택 같은 Presence 활동은 REQ 순번, 이벤트 sequence(Presence 외), 시나리오 기대 이벤트 순서에 영향을 주지 않는다.
- Presence 이벤트는 별도 버퍼와 별도 순번(presenceSequence)으로 기록한다.
  - 네트워크·처리 이벤트의 전역 sequence는 Presence 활동과 무관하게 연속된다.
  - Presence는 시나리오 비교에서 제외한다(§8.2).
- Timeline에서 Presence를 함께 표시할 때는 timestamp 순으로 정렬한다. 같은 시각이면 네트워크·처리 이벤트를 먼저 표시한다.

#### 8.9.7 검증 조건

| ID | 검증 | 기대 결과 |
| -- | ---- | --------- |
| SY-1 | 여러 Stream의 전역 순번 정합성 | block·template Stream의 모든 항목 streamSeq가 중복 없이 단조 증가하고, `seq:stream` 값과 일치한다 |
| SY-2 | 중복 Stream 이벤트 | 같은 항목을 실시간 수신 후 SYNC로 다시 받거나 같은 Delivery를 두 번 받아도 한 번만 적용된다. revision과 lastProcessedSeq가 되돌아가지 않는다 |
| SY-3 | 누락 감지 | revision이 건너뛴 실시간 Delivery는 적용되지 않고, 재HELLO → SYNC로 복구된다 |
| SY-4 | disconnected 사용자의 QUEUED 유지 | 연결이 끊긴 동안의 Delivery는 QUEUED로 유지되고 DELIVERED로 바뀌지 않는다. Presence는 disconnected로 표시된다 |
| SY-5 | 재연결 시 watermark 이전 이벤트 | 연결이 끊긴 동안과 HELLO 처리 전 승인분이 모두 SYNC에 포함되어 누락이 없다 |
| SY-6 | SYNC 중 신규 이벤트 | watermark 이후 승인분은 SYNC에 포함되지 않고 실시간 Delivery로 정확히 1회 반영된다. SYNC보다 먼저 도착해도 보류 후 적용된다 |
| SY-7 | SYNC 완료 상태 | lastReceivedRevision과 lastProcessedSeq(= syncWatermark 이상)가 정확하다. 해당 Delivery는 DELIVERED(catch-up)가 된다 |
| SY-8 | Presence와 REQ 순번 독립 | Presence 활동 유무와 관계없이 같은 시나리오의 REQ 순번, 이벤트 sequence, 이벤트 순서가 동일하다 |
| SY-9 | 초기 접속 | 시작 시 이벤트 로그 0건, 4명 모두 connected·동기화 상태 |

### 8.10 편집 처리 이벤트와 저장 알림 (v1.2.2)

이 절은 Phase 3 구현 세부의 명문화다. §7(Lock, Debounce, Revision, 재시도)과 §8.9(Stream, 전역 순번, SYNC)의 정책, DB 스키마를 변경하지 않는다.

#### 8.10.1 편집 승인과 영구 저장의 구분

| 단계 | 의미 | 이벤트 | 상태 위치 |
| ---- | ---- | ------ | --------- |
| 편집 승인 | 서버가 PROPERTY_UPDATE를 검증하고 Redis Live에 반영 | PROPERTY_UPDATE_ACK (요청자), PROPERTY_UPDATED (다른 사용자) | Redis live:* |
| 영구 저장 | Debounce flush로 PostgreSQL Live 테이블에 커밋 | DEBOUNCE_SAVE, PROPERTY_PERSISTED | PostgreSQL block_live_state 등 |
| 버전 확정 | 명시적 저장 | (Phase 5) | block_version, template_version 등 |

- PROPERTY_UPDATE_ACK는 편집 요청의 서버 승인이다. PostgreSQL 저장 완료를 뜻하지 않는다.
- ACK를 받은 시점에는 일반적으로 PostgreSQL에 아직 이전 값이 남아 있다. 이는 의도된 상태다(§7.2).
- 영구 저장 완료는 PROPERTY_PERSISTED로만 알린다.
- UI는 두 단계를 구분해 표시한다.
  - 승인 대기: pendingOps가 남아 있는 상태
  - DB 저장 대기: debounce 키가 WAITING인 상태
  - 저장됨: debounce 키가 없는 상태

#### 8.10.2 편집 처리 이벤트 정의

| 이벤트 | 구분 | 발생 조건 | actor | 송신 → 수신 | payload | 처리 결과 |
| ------ | ---- | --------- | ----- | ----------- | ------- | --------- |
| PROPERTY_LOCK_REQUEST | 요청 | 클라이언트가 보유하지 않은 속성을 처음 편집하거나 Lock 만료가 임박함 | 요청자 | Client → WS, Redis | lockKey, connectionId | 응답 이벤트로 결과 표시 |
| PROPERTY_LOCK_GRANTED | 응답 | Lock이 비어 있거나 같은 연결이 이미 보유 (SET NX PX, fence INCR) | 요청자 | WS → Client | lockToken, fencingToken, expiresAt | OK |
| PROPERTY_LOCK_DENIED | 응답 | 다른 사용자가 Lock을 보유하거나, 키 불일치 또는 권한 없음 | 요청자 | WS → Client | 소유자 userId, expiresAt | DENIED |
| PROPERTY_UPDATE | 요청 | Lock을 보유한 클라이언트가 속성 값 전송 | 요청자 | Client → WS | requestId, 대상, propertyPath, baseRevision, value, fencingToken, (undo), 처리 단계별 결과 | OK 또는 DENIED (사유 코드) |
| PROPERTY_UPDATE_ACK | 응답 | PROPERTY_UPDATE 승인 완료. 영구 저장이 아님 | 요청자 | WS → Client | opId, revision, 속성 revision, streamSeq, 연장된 Lock expiresAt | OK |
| PROPERTY_UPDATE_REJECTED | 응답 또는 클라이언트 처리 | 편집 요청이 승인되지 않음 (사유 코드는 §8.10.3) | 요청자 | 서버 거부: WS → Client / 클라이언트 거부: Client (네트워크 전송 없음) | opId, code, message, rejectedBy(server / client), (Lock 소유자) | DENIED |
| DEBOUNCE_SCHEDULED | Worker | PROPERTY_UPDATE 승인 직후. 같은 속성의 대기 예약이 있으면 갱신 | 요청자 | WS → Redis, Worker | debounce 키, 속성 revision, 대상 revision, dueAt, 이전 dueAt | OK (신규 예약 / 예약 갱신) |
| DEBOUNCE_SAVE | DB | dueAt 도달 시 flush 트랜잭션 실행 | 마지막 수정자 | Worker → PostgreSQL | txId, revision, persisted_revision, CRUD 목록, (오류) | OK (COMMIT) 또는 FAILED (ROLLBACK) |
| PROPERTY_PERSISTED | 클라이언트 전달 (알림) | DEBOUNCE_SAVE 커밋 성공 | 마지막 수정자 | WS → 대상 접속자 (요청자 포함) | propertyPath, 속성 revision, 대상 revision, persisted_revision | 수신자 0명이면 OK, 아니면 PARTIAL |
| PROPERTY_PERSIST_FAILED | 클라이언트 전달 (알림) | DEBOUNCE_SAVE 롤백 | 마지막 수정자 | WS → 대상 접속자 (요청자 포함) | propertyPath, error, attempt, nextRetryAt | PARTIAL / OK |
| PROPERTY_LOCK_RELEASE | 요청 | 명시적 해제 (§8.10.5) | 보유자 | Client → WS, Redis | lockKey, lockToken | OK (DEL) 또는 INFO (이미 만료되었거나 토큰 불일치) |
| LOCK_EXPIRED | Redis 내부 | Lock TTL 10초가 연장 없이 경과 | Lock 보유자 | Redis → WS | lockKey, lockToken, fencingToken | INFO |

- 모든 이벤트는 §8.7 공통 필드를 가진다.
- PROPERTY_LOCK_RELEASE(명시적 해제)와 LOCK_EXPIRED(만료)는 서로 다른 이벤트로 기록한다.
  - LOCK_EXPIRED는 클라이언트 요청 없이 Redis TTL에 의해서만 발생한다.
  - 만료로 해제된 Lock에 대한 이후의 PROPERTY_LOCK_RELEASE는 INFO로 기록하고, 다른 사용자가 새로 획득한 Lock을 지우지 않는다(lockToken 검사).

#### 8.10.3 거부 사유 코드 (PROPERTY_UPDATE_REJECTED)

| 코드 | 거부 주체 | 의미 |
| ---- | --------- | ---- |
| DISCONNECTED | 클라이언트 | 연결이 없어 전송할 수 없음, 또는 전송 후 승인 확인 전에 연결이 끊긴 뒤 승인되지 않았음이 확인됨 (§8.10.6) |
| PROPERTY_LOCK_DENIED | 클라이언트 (PROPERTY_LOCK_DENIED 응답 수신) | 다른 사용자가 같은 속성 Lock을 보유 (Lock 충돌) |
| NOT_JOINED | 서버 | 서버 세션이 템플릿에 참여하지 않음 (인증 단계) |
| FORBIDDEN | 서버 | 보고 있는 템플릿에 없는 대상 (권한 단계) |
| TARGET_NOT_FOUND | 서버 | 대상 블록 또는 요소 없음 |
| LOCK_NOT_HELD | 서버 | Lock이 없거나(만료 포함) 다른 사용자 또는 다른 lockToken이 보유 |
| FENCING_TOKEN_STALE | 서버 | 요청의 fencingToken이 현재 Lock의 fencingToken과 다름 |
| REVISION_CONFLICT | 서버 | baseRevision이 속성 revision과 다름 (Revision 불일치, §7.4) |
| UNDO_CONFLICT | 서버 또는 클라이언트 사전 검증 | Undo 기준 값과 현재 값이 다르거나 이후 다른 사용자의 변경이 승인됨 (§8.4) |

- 거부되면 해당 작업만 pendingOps에서 제거한다. 그 작업으로 기록한 Undo 항목의 변경분도 제거한다(§8.1).
- 클라이언트 거부도 Timeline에 PROPERTY_UPDATE_REJECTED로 기록한다. 송신 레인은 해당 클라이언트이고, 수신 레인은 없다(네트워크 전송 없음).

#### 8.10.4 PROPERTY_PERSISTED 전달 방식

- PROPERTY_PERSISTED와 PROPERTY_PERSIST_FAILED는 상태 알림이다.
- 전달은 Broadcast 1건과 수신자별 Delivery N건으로 기록한다(§8.3). 요청자도 수신자에 포함한다.
- Redis Stream에 기록하지 않는다. 전역 순번(seq:stream)을 소비하지 않는다.
- 알림은 documentView, lastReceivedRevision, lastProcessedSeq를 변경하지 않는다. 대상별 revision 연속성 검사(§8.9.1)의 대상도 아니다.
- 연결이 끊긴 수신자의 알림 Delivery는 QUEUED로 유지한다.
- 재연결 SYNC가 클라이언트에 적용될 때 그 시점의 저장 상태와 함께 전달된 것으로 보고 DELIVERED(via=catch-up)로 바꾼다.
  - 대상: SYNC가 다루는 템플릿과 그 블록
  - 조건: 알림 발생 시점의 전역 순번 ≤ syncWatermark
- 저장 상태 표시는 Redis debounce 키와 PostgreSQL 값을 기준으로 한다. 알림 수신 여부가 저장 여부를 결정하지 않는다.

#### 8.10.5 Lock 해제 시점

(v1.2.8) 아래 해제 시점은 요소 편집 권한(§7.5.1)에도 같게 적용한다. 단 편집 권한은 TTL이 없고, 연결이 끊기면 서버가 해제한 뒤 기다리던 사용자에게 넘긴다.

(v1.2.5 변경) 편집 중인 사용자가 **그 요소에서 나갈 때** 그 사용자가 해당 요소에 보유한 Lock(콘텐츠·배치)을 모두 해제한다.

| 조작 | 해제 시점 |
| ---- | --------- |
| 텍스트 편집(인라인, 속성 패널) | 요소에서 나갈 때: 다른 요소 선택, 빈 곳 클릭·선택 해제, 템플릿 전환 |
| 드래그, 리사이즈 | 요소에서 나갈 때 (포인터 조작 완료는 해제 사유가 아님) |
| Undo, Redo | Lock 획득, Fencing Token 검증, 명령 처리 요청 후 해제 요청 |
| 연결 끊김 | 명시적 해제 없음. TTL 만료로 해제 (LOCK_EXPIRED) |

- 입력 포커스 해제, 인라인 편집 종료, 포인터 조작 완료, 시점 전환(시뮬레이터의 사용자 전환)은 해제 사유가 아니다. 시점 전환은 네트워크 이벤트를 만들지 않는다.
- 요소를 선택한 채 수정이 없으면 TTL(10초, §7.5) 만료로 해제된다 (LOCK_EXPIRED). 수정할 때마다 TTL이 갱신된다.
- 이전 규칙(v1.2.2: 포커스 해제·조작 완료 시 해제)은 사용자 요청으로 변경되었다.
- 화면 처리: 다른 사용자가 Lock을 보유한 속성은 편집 진입 자체를 막는다. 인라인 편집에 들어가지 않고, 속성 패널 필드는 비활성화되며, 배치 Lock이 있으면 드래그·리사이즈를 시작하지 않는다. 동시 진입 등으로 편집 중에 Lock을 빼앗기면 편집을 끝내고 확정값을 보여 준다. 최종 판정은 여전히 서버의 Lock 획득 결과(PROPERTY_LOCK_DENIED)다.
- 삭제 차단 (v1.2.5): 다른 사용자가 요소의 배치 Lock(`lock:template:{T}:element:{E}:*`) 또는 그 블록의 콘텐츠 Lock(`lock:block:{B}:*`)을 보유하면 ELEMENT_DELETE는 서버에서 `ELEMENT_LOCKED`로 거부된다 (STRUCTURE_UPDATE_REJECTED, DB·Redis 변경 없음). 요청자 본인의 Lock은 막지 않으며, 이 경우 시나리오 H 규칙대로 요소 Lock을 해제한다. 화면은 삭제 버튼을 비활성화하고 Delete 키를 막는다.

- Undo와 Redo도 일반 편집과 같이 속성별 Lock 획득, Fencing Token 검증, Revision 검증, Undo 충돌 검증을 모두 거친다.
- Undo의 해제 요청은 PROPERTY_UPDATE 뒤에 같은 연결로 전송된다. 메시지 순서가 보장되므로 서버는 명령을 처리한 뒤에 Lock을 해제한다.
- Lock 획득을 기다리는 중에 편집이 끝나면, 획득 직후 대기 중인 작업을 전송하고 해제한다.

#### 8.10.6 오프라인 편집

오프라인 편집은 지원하지 않는다. 오프라인 편집 큐를 만들지 않는다.

| 시점 | 처리 |
| ---- | ---- |
| 연결이 없는 상태의 신규 편집 | 즉시 DISCONNECTED로 거부. 서버로 전송하지 않음 |
| Lock 획득 대기 중 연결 끊김 | 대기 작업을 DISCONNECTED로 거부 |
| 전송했으나 응답 전 연결 끊김 | 승인 여부 미확정으로 둔다. 재연결 SYNC 결과로 판정한다 |

- 승인 여부는 requestId 기준 서버 처리 결과로 판정한다. revision 증가 여부로 추정하지 않는다(다른 사용자의 변경과 혼동 방지).
  - 서버는 PROPERTY_UPDATE마다 requestId → 처리 결과(APPROVED / REJECTED와 사유)를 기록한다.
  - 재연결 HELLO는 승인 확인 대기 중인 requestId 목록(unconfirmedRequestIds)을 보낸다.
  - SYNC는 각 요청의 결과(requestResults)를 돌려준다. 결과는 APPROVED, REJECTED, NOT_RECEIVED(처리 기록 없음) 중 하나다.
- 판정 규칙:

| 결과 | 처리 |
| ---- | ---- |
| APPROVED | 서버가 이미 승인한 작업이다. 승인으로 복구하고, 연결 단절을 이유로 취소하지 않는다. 변경은 SYNC changes로 반영된다. 재전송하지 않으므로 중복 적용이 없다. Undo 항목을 유지한다 |
| REJECTED | 서버가 처리할 때 거부했다. 그 사유로 거부한다. 서버가 이미 PROPERTY_UPDATE_REJECTED를 기록했으므로 다시 기록하지 않는다 |
| NOT_RECEIVED | 서버에 도달하지 못한 요청이다. DISCONNECTED로 거부하고 클라이언트 거부로 기록한다 |
- 판정 전까지 해당 작업은 pendingOps에서 제외하고 "승인 확인 대기"로 표시한다.
- 서버에서 이미 승인된 작업은 Redis Live, Stream, Debounce 저장이 그대로 진행된다. 연결 단절이 서버 처리 결과를 바꾸지 않는다.
- 연결이 끊긴 뒤 서버에 도착하지 못한 메시지는 처리되지 않는다(§8.9.3의 전송 유실 규칙).

#### 8.10.7 저장 실패 재시도 횟수 (§7.9 명확화)

- 최초 시도 1회 + 재시도 최대 3회, 총 4회 시도한다.
- 재시도 간격은 직전 실패 시각부터 1000ms, 2000ms, 4000ms다.
- attempt는 지금까지 실패한 시도 수다(최초 시도 포함). §4의 "재시도 횟수" 표기는 이 값을 뜻한다.
- 구현에서는 두 값을 구분한다.
  - attempt: 최초 시도를 포함한 전체 시도 횟수
  - retryCount: 최초 시도를 제외한 재시도 횟수
  - 4회가 모두 실패하면 attempt=4, retryCount=3, status=DEAD다.

| 시각 (승인 t 기준) | 시도 | 결과 | status | attempt | retryCount | nextRetryAt |
| ------------------ | ---- | ---- | ------ | ------- | ---------- | ----------- |
| t+1000 | 최초 | 실패 | FAILED | 1 | 0 | t+2000 |
| t+2000 | 재시도 1 | 실패 | FAILED | 2 | 1 | t+4000 |
| t+4000 | 재시도 2 | 실패 | FAILED | 3 | 2 | t+8000 |
| t+8000 | 재시도 3 | 실패 | DEAD | 4 | 3 | — |

- 실패할 때마다 롤백하고 PROPERTY_PERSIST_FAILED를 전파한다. Redis Live 상태는 유지한다.
- DEAD가 되면 자동 재시도를 멈추고 수동 재시도를 기다린다.
- 재시도 대기 중이거나 DEAD 상태에서 새 입력이 오면, 일반 Debounce로 재예약하고 attempt를 0으로 초기화한다(§7.9).
- 재시도와 수동 재시도도 flush 규칙(§7.3)을 그대로 따른다.
  - 해당 property_path의 최신 Live 값만 병합한다.
  - revision과 연속 persisted_revision을 계산한다.
  - fencing token을 검사한다.

#### 8.10.8 검증 조건

| ID | 검증 | 기대 결과 |
| -- | ---- | --------- |
| ED-1 | ACK와 영구 저장 구분 | ACK 시점에 PostgreSQL은 이전 값이고 debounce 키는 WAITING이다. PROPERTY_PERSISTED는 DEBOUNCE_SAVE 커밋 뒤에만 발생한다 |
| ED-2 | PROPERTY_PERSISTED의 Stream·순번 미사용 | 알림 전후로 stream:* 항목 수와 seq:stream 값이 변하지 않고, 수신자의 documentView, lastReceivedRevision, lastProcessedSeq도 변하지 않는다 |
| ED-3 | disconnected 사용자의 저장 알림 | 알림 Delivery는 QUEUED로 유지되고, 재연결 SYNC 적용 후에만 DELIVERED(catch-up)가 된다 |
| ED-4 | Lock 해제 구분 | 요소에서 나가기(다른 요소 선택, 선택 해제), Undo는 PROPERTY_LOCK_RELEASE로, 연결 끊김 후 10초는 LOCK_EXPIRED로 기록된다. 만료 뒤 늦은 해제 요청은 다른 사용자의 Lock을 지우지 않는다 |
| ED-5 | DISCONNECTED 거부 | 연결이 없는 상태의 신규 편집과 Lock 대기 작업은 서버 전송 없이 PROPERTY_UPDATE_REJECTED(DISCONNECTED, rejectedBy=client)로 기록된다 |
| ED-6 | 승인 완료 작업의 연결 단절 | 서버 승인 직후(ACK 도착 전) 연결이 끊겨도 Redis Live와 PostgreSQL 저장은 정상 진행된다. 재연결 SYNC 후 해당 작업은 거부되지 않고 승인으로 판정되며, Undo 항목이 유지된다 |
| ED-7 | 재시도와 DEAD | 실패 주입 4회: t+1000, t+2000, t+4000, t+8000에 실패하고 DEAD(attempt 4)가 된다. 3회면 재시도 3에서 성공한다 |
| ED-8 | Undo의 Lock 검증 | 다른 사용자가 Lock을 보유한 속성의 Undo는 PROPERTY_LOCK_DENIED로 거부된다. Undo 요청에는 유효한 fencingToken이 필요하다 |

### 8.11 명시적 저장·복원 이벤트와 전파 (v1.2.3)

§7.7(명시적 저장), §7.8(복원), §8.9(Stream·SYNC), §8.10(편집 이벤트)을 구현하기 위한 세부 규칙이다. 테이블 구조와 기존 정책을 변경하지 않는다.

#### 8.11.1 처리 순서

명시적 저장:

1. TEMPLATE_SAVE (요청)
2. 검증 (세션 참여, 보고 있는 템플릿) → 실패 시 TEMPLATE_SAVE_REJECTED (stage = validation)
3. 변경 판단 (블록별 Live content와 current_version 스냅샷 비교, 구성 비교)
4. TEMPLATE_SAVE_ACK (요청 승인. noChanges 포함)
5. VERSION_SAVE (트랜잭션)
   - 앞단: 대기 중 Debounce flush
   - 뒤: 변경된 블록의 block_version·콘텐츠 행, template_version·template_version_element 생성
   - 실패 시 PostgreSQL 트랜잭션을 롤백하고 TEMPLATE_SAVE_REJECTED를 보낸다 (stage = transaction, code = DB_WRITE_FAILED, operation = TEMPLATE_SAVE). TEMPLATE_SAVED는 발생하지 않는다
6. TEMPLATE_SAVED (저장 완료 알림, 버전을 만든 경우에만)

- NO_CHANGES는 4번 TEMPLATE_SAVE_ACK에 noChanges = true로 담아 응답한다.
- NO_CHANGES이고 flush할 변경도 없으면 VERSION_SAVE 없이 종료한다.
- NO_CHANGES이지만 flush할 변경이 있으면 VERSION_SAVE로 flush만 커밋하고 TEMPLATE_SAVED는 보내지 않는다.

복원:

1. TEMPLATE_RESTORE (요청)
2. 검증 (세션 참여, 보고 있는 템플릿, 복원 대상 버전의 존재와 templateId 소속) → 실패 시 TEMPLATE_RESTORE_REJECTED (stage = validation)
3. 복원 대상 버전의 전체 요소 구성 조회 → TEMPLATE_RESTORE_ACK
4. VERSION_SAVE (트랜잭션)
   - 앞단: 대기 중 Debounce flush
   - 새 template_version(restored_from_version_id), template_version_element 복사, template_live_element 구성 교체, template_live_state 갱신
   - 실패 시 롤백하고 TEMPLATE_RESTORE_REJECTED를 보낸다 (stage = transaction, code = DB_WRITE_FAILED, operation = TEMPLATE_RESTORE)
   - 이 경우 STRUCTURE_UPDATED와 CONTENT_MISMATCH는 발생하지 않고, Redis Live와 structureRevision도 변경되지 않는다
5. structureRevision을 정확히 1 증가
6. STREAM_XADD → STRUCTURE_UPDATED (REPLACE_TEMPLATE_STRUCTURE 명령 포함)를 요청자를 포함한 접속자에게 전파
7. CONTENT_MISMATCH (불일치가 있을 때만)

- 요청과 결과는 같은 requestId로 연결된다. 연결 대상은 요청, ACK, VERSION_SAVE(트랜잭션 기록 포함), REJECTED, 알림이다.
- 요청당 ACK는 한 번만 보낸다.
  - 같은 requestId의 요청이 다시 오면 ACK와 트랜잭션을 다시 실행하지 않는다.
  - 요청 이벤트만 result = INFO(duplicate)로 기록한다.
- 이미 ACK를 보낸 요청이 트랜잭션에서 실패하면, 추가 ACK 없이 REJECTED(stage = transaction)로 결과를 알린다.
- 구조 변경 직렬화(§7.4)와 복원 정책(§7.8)은 그대로 적용한다.
  - block_live_state와 block.current_version_id는 변경하지 않는다.
  - 삭제된 요소는 deleted_at = NULL로 되돌리고 live 행을 다시 INSERT한다.
  - 구성에 없는 요소는 live 행을 DELETE하고 deleted_at을 설정하며, 그 요소의 Debounce를 취소하고 Lock을 해제한다.

#### 8.11.2 이벤트 정의

| 이벤트 | 구분 | 발생 조건 | actor | 송신 → 수신 | payload | 처리 결과 · Timeline |
| ------ | ---- | --------- | ----- | ----------- | ------- | -------------------- |
| TEMPLATE_SAVE | 요청 | 저장 버튼 | 요청자 | Client → WS | requestId, templateId | OK (request) |
| TEMPLATE_SAVE_ACK | 응답 | 검증 통과. **요청 승인이며 PostgreSQL 저장 완료가 아니다** | 요청자 | WS → Client | requestId, templateId, noChanges, plannedFlushKeys, changedBlocks | OK, noChanges면 INFO (response) |
| TEMPLATE_SAVE_REJECTED | 응답 | 검증 실패 또는 ACK 이후 VERSION_SAVE 롤백 | 요청자 | WS → Client | 거부 공통 payload (§8.11.3) | DENIED (response) |
| TEMPLATE_RESTORE | 요청 | 버전 이력의 복원 버튼 | 요청자 | Client → WS | requestId, templateId, versionId | OK (request) |
| TEMPLATE_RESTORE_ACK | 응답 | 검증 통과 (요청 승인) | 요청자 | WS → Client | requestId, templateId, versionId, elements(요소 수), noChanges = false | OK (response) |
| TEMPLATE_RESTORE_REJECTED | 응답 | 검증 실패(VERSION_NOT_FOUND 등) 또는 ACK 이후 VERSION_SAVE 롤백 | 요청자 | WS → Client | 거부 공통 payload (§8.11.3), versionId | DENIED (response) |
| VERSION_SAVE | DB | 저장·복원의 실제 버전 생성 트랜잭션 (flush 포함) | 요청자 | WS → PostgreSQL | txId, flushedKeys, created / reused block_version, templateVersionId, restoredFrom, CRUD 목록, (error) | OK (COMMIT) 또는 FAILED (ROLLBACK) (db) |
| TEMPLATE_SAVED | 클라이언트 전달 (알림) | VERSION_SAVE 커밋 성공 후, 버전을 만든 경우 | 요청자 | WS → 템플릿 접속자 (요청자 포함) | requestId, templateId, templateVersionId, version, createdBlockVersions, reusedBlockVersions, flushedKeys | Broadcast 1 + Delivery N (broadcast / delivery) |
| CONTENT_MISMATCH | 클라이언트 전달 (알림) | 복원 커밋 후, 복원 버전이 참조하는 block_version 콘텐츠와 현재 공유 블록 Live 콘텐츠가 다를 때 | 요청자 | WS → 템플릿 접속자 (요청자 포함) | requestId, templateId, templateVersionId, restoredFromVersionId, mismatches[blockId, elementIds, blockVersionId, fields(path, versionValue, liveValue)] | Broadcast 1 + Delivery N |
| FIXTURE | 시스템 | 테스트용 데이터 생성 (§8.11.6) | 없음 (생성 주체는 payload.createdBy) | PostgreSQL → Redis | fixture, createdBy, dataKind, description, targets[table, id], txId, (reason, error) | OK, 이미 있으면 INFO, 실패 시 FAILED (system) |

알림(TEMPLATE_SAVED, CONTENT_MISMATCH)은 §8.10.4의 PROPERTY_PERSISTED 규칙을 따른다.

- Redis Stream에 기록하지 않는다. 전역 순번(seq:stream)을 소비하지 않는다.
- documentView, lastReceivedRevision, lastProcessedSeq를 변경하지 않는다.
- 연결이 끊긴 수신자의 Delivery는 QUEUED로 유지한다. 재연결 SYNC가 적용되면 DELIVERED(via = catch-up)로 바꾼다.

#### 8.11.3 거부 코드

| 코드 | 이벤트 | 발생 조건 |
| ---- | ------ | --------- |
| NOT_JOINED | TEMPLATE_*_REJECTED | 서버 세션 미참여 |
| FORBIDDEN | TEMPLATE_*_REJECTED | 보고 있는 템플릿이 아님 |
| VERSION_NOT_FOUND | TEMPLATE_RESTORE_REJECTED | 복원하려는 버전이 없거나, 요청한 templateId에 속하지 않음 (template_version.template_id ≠ templateId) |
| DB_WRITE_FAILED | TEMPLATE_*_REJECTED (stage = transaction) | ACK 이후 VERSION_SAVE 트랜잭션 롤백 |

거부 공통 payload:

| 필드 | 값 |
| ---- | -- |
| requestId | 요청 ID |
| operation | TEMPLATE_SAVE 또는 TEMPLATE_RESTORE |
| templateId | 대상 템플릿 (복원은 versionId도 포함) |
| code | 거부 코드 |
| message | 사유 |
| rejectedBy | server |
| stage | validation (ACK 전 검증 실패) 또는 transaction (ACK 이후 트랜잭션 실패) |
| result | NOT_EXECUTED (validation) 또는 ROLLED_BACK (transaction) |
| acked | 이 요청에 ACK를 보냈는지 |
| cause | transaction일 때만: txId, error (실패 원인) |

DB_WRITE_FAILED 코드의 재사용:

- DB_WRITE_FAILED는 "PostgreSQL 트랜잭션이 실패해 롤백되었고, 요청한 변경이 저장되지 않았다"는 뜻의 공통 코드다.
- 구조 변경의 즉시 저장 실패(§7.6)뿐 아니라 템플릿 저장·복원의 VERSION_SAVE 실패에도 같은 의미로 사용한다.
- 실패 위치와 작업 종류는 stage, operation, requestId로 구분한다.
  - 템플릿 저장·복원: stage = transaction, operation = TEMPLATE_SAVE 또는 TEMPLATE_RESTORE
- 구조 변경 거부 이벤트의 payload 정의는 이 절의 범위가 아니다. 기존 구현을 유지한다.
- VERSION_NOT_FOUND로 거부되면 다음이 보장된다.
  - TEMPLATE_RESTORE_ACK와 VERSION_SAVE가 발생하지 않는다.
  - PostgreSQL, Redis Live, structureRevision이 변경되지 않는다.

#### 8.11.4 REPLACE_TEMPLATE_STRUCTURE (복원 결과 전파)

복원 결과는 개별 요소의 추가·삭제 이벤트를 반복하지 않는다. STRUCTURE_UPDATED(Stream 기록, 전역 순번 사용) 안에 템플릿 구성 전체 교체 명령을 담아 전파한다.

| 필드 | 의미 |
| ---- | ---- |
| type | REPLACE_TEMPLATE_STRUCTURE |
| templateId | 대상 템플릿 |
| templateVersionId | 복원 대상(원본) 버전 |
| newTemplateVersionId | 복원으로 생성된 버전 |
| structureRevision | 교체 후 구조 revision (이전 + 1). STRUCTURE_UPDATED의 structureRevision과 같다 |
| elements[] | 전체 요소 구성: templateElementId, blockId, blockVersionId, sequence, renderZone, props |

- 수신 대상은 해당 템플릿을 보는 접속자이며, 요청자도 포함한다(§8.3의 actor 제외 규칙의 예외).
  - 요청자는 다른 수신자와 같은 REPLACE_TEMPLATE_STRUCTURE 명령을 Delivery로 받아 구성을 교체한다.
  - 요청자의 복원 결과는 이 명령을 적용한 시점에 확정된다.
- TEMPLATE_RESTORE_ACK(요청 승인, 요청자에게만)와 STRUCTURE_UPDATED(결과 전파, Broadcast)는 서로 다른 이벤트다. ACK에는 구조 변경 명령을 싣지 않는다.
- 수신 클라이언트는 해당 템플릿의 기존 요소 구성을 전부 제거하고 elements로 교체한다.
  - 같은 요소의 속성 메타는 유지한다.
  - 템플릿의 structureRevision과 revision을 갱신한다.
  - 블록 콘텐츠는 변경하지 않는다.
- 대상별 revision 연속성·중복 규칙(§8.9.1)과 재연결 따라잡기(§8.9.4)가 그대로 적용된다.

#### 8.11.5 처음 보는 템플릿의 최초 SYNC 스냅샷

- 서버는 HELLO 또는 VIEW_TEMPLATE의 lastReceivedRevision에 template:{templateId}가 없으면 처음 수신하는 템플릿으로 판단한다.
- 이 경우 SYNC에 현재 Live 구성 스냅샷(snapshot)을 포함한다. 스냅샷 구성은 다음과 같다.
  - template: templateId, name, revision, structureRevision
  - elements: 각 요소의 배치와 속성 메타
  - blocks: 그 템플릿에 배치된 블록의 content, revision, 속성 메타
- 스냅샷은 syncWatermark를 확정한 같은 처리 단위에서 만든다.
  - SYNC의 changes는 스냅샷 revision보다 큰 항목만 포함한다(사실상 없음).
  - 스냅샷 이후 승인된 변경은 streamSeq > syncWatermark인 실시간 Delivery로 전달된다.
- 클라이언트는 다음 순서로 처리한다.
  1. 스냅샷으로 해당 템플릿의 documentView를 초기화하고 lastReceivedRevision을 스냅샷 revision으로 설정한다.
  2. changes를 적용한다.
  3. 보류한 실시간 Delivery를 적용한다(§8.9.4).
- 클라이언트는 Redis Live를 직접 조회하지 않고, 서버가 보낸 SYNC만으로 documentView를 구성한다.
- 이미 수신한 템플릿은 기존 증분 SYNC와 복구 규칙을 따른다.

#### 8.11.6 Fixture 생성 경로

- Fixture는 시나리오용 초기 데이터 추가다(SIMULATION_SCENARIOS §1.1의 예외). 사용자 편집 이벤트와 구분하기 위해 actor 없이 system 카테고리 FIXTURE로 기록한다.
- 두 경로가 같은 생성 로직(applyFixture)을 사용한다.

| 경로 | 시점 | createdBy |
| ---- | ---- | --------- |
| Simulation Console 버튼 | 실행 중 | SimulationConsole |
| 시나리오 실행기 초기화 (Phase 6) | 엔진 초기화 중 (클라이언트 구성 전) | ScenarioRunner |

- 생성 로직의 처리:
  1. 하나의 트랜잭션으로 MockDatabase에 INSERT한다.
  2. Redis live:template을 만든다. 초기화 경로에서는 전체 Live 부트스트랩이 대신 처리한다.
  3. FIXTURE 이벤트를 기록한다.
- 이미 존재하면 다시 만들지 않고 FIXTURE(result = INFO, reason = ALREADY_EXISTS)만 기록한다.
- 실행 중 추가된 템플릿은 클라이언트가 처음 보는 템플릿이므로, 전환할 때 §8.11.5의 최초 SYNC 스냅샷으로 로드된다.
- 시나리오 K의 T002 fixture: template T002, template_version TV101, template_element E101(B001), template_version_element TVE101, template_live_state T002, template_live_element (T002, E101)

#### 8.11.7 검증 조건

| ID | 검증 |
| -- | ---- |
| VS-1 | TEMPLATE_SAVE_ACK는 VERSION_SAVE 이전에 기록되고, ACK만 받은 클라이언트는 저장 완료로 표시하지 않는다 |
| VS-2 | VERSION_SAVE 실패 시 TEMPLATE_SAVED가 없고 TEMPLATE_SAVE_REJECTED(stage = transaction)가 기록된다 |
| VS-3 | TEMPLATE_SAVED 전후로 Stream, seq:stream, 수신자의 documentView·lastReceivedRevision·lastProcessedSeq가 변하지 않는다. disconnected 수신자는 QUEUED → SYNC 후 DELIVERED |
| VS-4 | VERSION_NOT_FOUND (없는 버전, 다른 템플릿의 버전): PostgreSQL·Redis·structureRevision 변경 없음 |
| VS-5 | 복원 성공 시 STRUCTURE_UPDATED에 REPLACE_TEMPLATE_STRUCTURE가 포함되고, 복원 이후 구조 Broadcast는 1건이다 |
| VS-6 | 복원 성공 시 structureRevision이 정확히 1 증가한다 |
| VS-7 | 요청자를 포함한 모든 수신 클라이언트가 구성을 전체 교체하고 새 structureRevision을 반영한다 |
| VS-8 | 복원 과정에서 block_live_state가 변경되지 않는다. CONTENT_MISMATCH는 알림으로 전달된다 |
| VS-9 | 처음 진입한 템플릿은 SYNC 스냅샷으로 초기화된다 |
| VS-10 | 스냅샷과 실시간 이벤트 사이에 누락·중복이 없다 (SYNC보다 먼저 도착한 실시간 Delivery 보류 포함) |
| VS-11 | 실행 중 Fixture 추가 결과가 MockDatabase(DB Explorer)와 FIXTURE 이벤트(Timeline)에 나타난다 |
| VS-12 | 시나리오 K의 T002는 Console과 같은 applyFixture 경로(createdBy = ScenarioRunner)로 생성된다 |
| VS-13 | ACK 이후 VERSION_SAVE 실패 시: REJECTED(stage = transaction, code = DB_WRITE_FAILED, operation, requestId, cause), 롤백, TEMPLATE_SAVED·STRUCTURE_UPDATED 미발행, 요청과 결과가 같은 requestId, ACK는 1회. 같은 requestId의 중복 요청에는 ACK·트랜잭션을 다시 실행하지 않는다 |

### 8.12 Phase 6 구현 세부 (v1.2.4)

§7.9(저장 실패 및 재시도), §8.10.7(재시도 횟수), §8.11.6(Fixture), SIMULATION_SCENARIOS §1.1(시나리오 실행 원칙)의 구현 세부다. 정책 값(1s·2s·4s, 최대 3회, DEAD)과 테이블 구조는 바꾸지 않는다.

#### 8.12.1 재시도 · DEAD · 수동 재시도

- 재시도는 VirtualClock 예약으로만 실행한다. 실제 타이머나 시스템 시각을 쓰지 않는다.
- 모든 시도(최초, 재시도, 수동 재시도)는 DEBOUNCE_SAVE 이벤트로 기록한다.
  - payload: requestId, blockId(또는 templateId·elementId), propertyPath, revision, propertyRevision, debounceRevision, trigger(debounce / retry / manual), attempt, retryCount, attemptedAt, error, injected, nextRetryAt, status
  - status: PERSISTED / FAILED / DEAD
- 실패할 때마다 PROPERTY_PERSIST_FAILED 알림(같은 payload)을 보낸다.
- 자동 재시도 예약은 그 예약을 만든 attempt 값을 함께 가진다.
  - 실행 시점에 debounce 키가 FAILED이고 attempt가 같을 때만 실행한다.
  - 대기 중 새 입력으로 WAITING(attempt 0)으로 재예약되었으면 이전 재시도는 실행되지 않는다(§7.9).
- DEAD는 자동 재시도를 예약하지 않는다.
- 수동 재시도(Simulation Console)는 DEAD 상태에서만 수행하며, 시도는 한 번이다.
  - 성공하면 PERSISTED가 되고 debounce 키를 삭제한다.
  - 실패하면 다시 DEAD가 된다.
  - attempt와 retryCount는 계속 누적한다(예: 수동 재시도 1회 후 attempt = 5, retryCount = 4).
- 재시도와 수동 재시도는 매번 시도 시점의 최신 Redis Live 값과 revision으로 flush를 다시 계획한다(§7.3).

#### 8.12.2 최신 revision 보호와 재시도 불가 오류

flush 트랜잭션은 다음 경우 오래된 값으로 덮어쓰지 않고 롤백한다.

| 오류 코드 | 조건 |
| --------- | ---- |
| STALE_REVISION | PostgreSQL block_live_state.revision 또는 template_live_state.revision이 Live revision보다 큼, 또는 property_state.revision이 Live 속성 revision보다 큼 |
| FENCING_TOKEN_STALE | 저장하려는 fencing token이 property_state.last_fencing_token보다 작음 (§7.5) |

실패 분류:

| 분류 | 오류 | 처리 |
| ---- | ---- | ---- |
| 일시적 DB 오류 (재시도 가능) | WRITE_FAILED (연결 끊김, 실패 주입 등) | §7.9 정책 그대로: FAILED → 1s · 2s · 4s 재시도 → 4회 실패 시 DEAD |
| 재시도 불가 | STALE_REVISION, FENCING_TOKEN_STALE | 재시도해도 해결되지 않으므로 그 시도에서 즉시 DEAD. 자동 재시도를 예약하지 않는다 |

- 재시도 도중에 재시도 불가 오류가 나면 그 시점에 DEAD가 된다. 남은 재시도는 실행하지 않는다.
- DEBOUNCE_SAVE와 PROPERTY_PERSIST_FAILED의 payload에 errorCode와 retryable을 기록한다.
- debounce 키에도 lastErrorCode와 retryable을 기록한다.
- 재시도 불가 DEAD도 수동 재시도(§8.12.1)는 가능하다. 원인이 남아 있으면 다시 DEAD가 된다.

#### 8.12.3 실패 주입

- MockDatabase의 쓰기 트랜잭션에만 적용한다. 외부 시스템에는 영향이 없다.
- 설정 항목: 횟수(0 = 해제), 대상(scope), 오류 문구(기본 connection reset (mock))

| scope | 대상 트랜잭션 |
| ----- | ------------- |
| debounce | Debounce flush (최초 · 재시도 · 수동) |
| version | VERSION_SAVE (명시적 저장 · 복원) |
| structure | 구조 변경 즉시 저장 |
| any | 위 전부 (Fixture 제외) |

- 상태: configured(설정 횟수), remaining(남은 횟수), triggered(실제로 실패시킨 트랜잭션 수)
  - 실패 주입으로 실패한 트랜잭션은 injected = true로 기록한다.
  - triggered와 injected 트랜잭션 수는 항상 일치한다.
- 설정을 바꿀 때마다 FAULT_INJECTION(system) 이벤트를 기록한다.
  - payload: count, scope, error, enabled
- FAULT_INJECTION은 설정 변경 기록이다. 실제 트랜잭션 실패는 별도 이벤트로 기록하며, 두 기록을 섞지 않는다.
  - 실제 실패 기록: DEBOUNCE_SAVE(result = FAILED, injected = true, errorCode = WRITE_FAILED), VERSION_SAVE 등
  - DB 트랜잭션 기록(TxRecord.injected)에도 실패 여부가 남는다.
- 실행 중에 설정을 바꿀 수 있다. 새 설정은 이전 설정을 대체한다.

#### 8.12.4 전체 초기화

- 하나의 엔진 작업(reset)으로 다음을 Seed 상태로 다시 만든다.
  - MockDatabase, MockRedis(Lock, fence, Debounce, Live, Presence, Stream 포함)
  - MockWebSocket 연결과 전송 중 메시지
  - VirtualClock과 예약 작업(Debounce, 재시도, Lock TTL, Delivery)
  - EventLogger(Timeline), Broadcast/Delivery
  - 4명의 Client Replica, 실패 주입, Fixture
- 이전 세대의 예약 작업은 새 세대에서 실행되지 않는다. 시계와 예약 목록을 새로 만들기 때문이다.
- 결정적 ID 순번도 처음부터 다시 시작한다. 같은 작업을 반복하면 같은 ID와 이벤트 로그가 나온다.
- 초기화 옵션으로 Fixture(§8.11.6 applyFixture, createdBy = ScenarioRunner)와 사용자별 초기 템플릿을 지정할 수 있다.
- 초기화 결과(세대 번호, 라벨, Fixture)는 UI에 "초기화 완료"로 표시한다.
- 실행 중이던 시나리오는 외부 초기화 시 중단된다.

#### 8.12.5 시나리오 실행기

SIMULATION_SCENARIOS §1.1의 실행 원칙을 따른다. 실행 순서:

1. 전체 초기화 (시나리오의 Fixture 포함)
2. precondition: 선행 시나리오의 명령을 시계를 빠르게 진행하며 실제로 실행한다
3. 실패 주입 (시나리오 L)
4. 본 단계: VirtualClock에 예약하며, 사용자의 재생 · 일시정지 · 단계 진행 · 배속 제어를 따른다
5. 검증: 시나리오의 예상 결과를 기대값과 비교해 PASS / FAIL로 표시한다

- 모든 명령은 편집기와 같은 경로(EditorPort → EngineAdapter → Simulation Engine)로 실행한다. DB를 직접 조작하지 않는다.
- 1~3단계의 이벤트는 PRECONDITION 구간으로 기록한다. Timeline은 이 구간을 기본으로 접어서 표시한다.
- 실행 가능한 시나리오: A ~ L, L-DEAD(시나리오 L 변형 1: 실패 주입 4회)
- 시각 기준은 승인 시각이다(v1.1 표 기준). 예를 들어 B의 저장 시각은 "마지막 승인 + 1000ms"다.

