# 시스템 흐름 정리: UI · 인프라 · 백엔드 · DB

> 기준: DB_SCHEMA.md v1.2.9. 이 문서는 "사용자가 무언가를 하면 4개 계층에서 각각 무슨 일이 일어나는가"를 순서대로 정리한다.
> 세부 규칙의 원문은 DB_SCHEMA.md(정책)와 SIMULATION_SCENARIOS.md(시나리오)에 있다.

---

## 1. 한눈에 보기

```
┌──────────────────────────────────────────────────────────────────────┐
│ ① UI (사용자 브라우저)                                                 │
│   화면(React) ── intent ──▶ EditorAdapter ── op ──▶ ClientRuntime      │
│   · 화면은 DB·Redis를 직접 바꾸지 않는다. 오직 intent만 보낸다          │
│   · 낙관적 반영(바로 화면에 보임) + 서버 응답으로 확정/되돌림            │
└───────────────▲──────────────────────────────────┬───────────────────┘
                │ CHANGE · SYNC · *_RESULT · PRESENCE │ PROPERTY_UPDATE · LOCK · STRUCTURE …
┌───────────────┴──────────────────────────────────▼───────────────────┐
│ ② 인프라                                                              │
│   WebSocket(전송, 지연 10ms) · Redis(Live 상태 · Lock · Stream ·       │
│   Presence Pub/Sub · Debounce 예약) · 시뮬레이션 시계(타이머)           │
└───────────────▲──────────────────────────────────┬───────────────────┘
                │                                  │
┌───────────────┴──────────────────────────────────▼───────────────────┐
│ ③ 백엔드 (WS 서버)                                                    │
│   WsServer(세션·Presence·SYNC) · EditService(속성 편집·Lock·Debounce)  │
│   StructureService(추가·삭제·순서·이름) · VersionService(저장·복원)      │
│   Broadcaster(실시간 전파)                                             │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ 트랜잭션 (즉시 / Debounce 후 / 버전 저장 시)
┌──────────────────────────────────▼───────────────────────────────────┐
│ ④ DB (PostgreSQL)                                                     │
│   확정본: block · block_version · block_text 등 콘텐츠 10종             │
│           template · template_version · template_element · TVE         │
│   Live 사본: block_live_state · block_property_state                   │
│             template_live_state · template_live_element · *_property    │
└──────────────────────────────────────────────────────────────────────┘
```

### 시뮬레이터에서 각 계층의 실제 위치

이 프로젝트는 프런트엔드만으로 4계층을 흉내 낸다. 모든 계층이 한 브라우저 안에서 돌지만 계층 사이는 메시지로만 통신한다.

| 계층 | 실제 서비스라면 | 시뮬레이터 구현 |
|---|---|---|
| UI | 사용자 브라우저 | `src/editor/ui/*`(화면), `src/editor/adapters/engineAdapter.ts`(intent→op, Undo), `src/engine/client/clientRuntime.ts`(사용자별 클라이언트) |
| 인프라 | WebSocket 게이트웨이, Redis, 작업 스케줄러 | `src/engine/net/mockWebSocket.ts`, `src/engine/redis/mockRedis.ts`, `src/engine/clock.ts` |
| 백엔드 | 실시간 협업 서버 | `src/engine/server/wsServer.ts`, `editService.ts`, `structureService.ts`, `versionService.ts`, `broadcaster.ts` |
| DB | PostgreSQL | `src/engine/db/mockDatabase.ts`, `schema.ts` |

사용자 4명(U001~U004)은 각자 **자기 클라이언트(replica)** 를 가진다. 화면 위쪽의 사용자 버튼은 "어느 사용자의 화면을 보여 줄지"만 바꾸는 시점 전환이고, 네트워크·Lock에는 아무 영향이 없다 (§8.1).

---

## 2. 계층별 책임

### ① UI

| 구성 | 하는 일 | 가진 상태 |
|---|---|---|
| 화면 (Stage, 툴바, 레이어, 요소 추가, 상단 바) | 사용자 동작을 **intent**로 바꿔 보낸다 (`editProperty`, `editPlacement`, `addElement`, `deleteElement`, `reorderElement`, `renameTemplate`, `save`, `restoreVersion`, `undo`, `redo`) | 화면 전용: 보는 사용자, 다중 선택, 알림, 개발자 정보 표시 |
| EngineAdapter | intent → 엔진 op 변환, **Undo/Redo 스택** 기록 (같은 gesture는 한 번에 되돌림) | 사용자별 undoStack / redoStack |
| ClientRuntime | op를 **낙관적으로 replica에 반영**하고 서버로 보낸다. Lock 요청·보유, 응답 대기, 수신한 변경 적용 | replica(documentView), pendingOps, locks, lastReceivedRevision, presence |

- 원칙: UI는 DB·Redis를 직접 바꾸지 않는다. 화면에 보이는 값은 항상 **자기 replica**이고, 서버가 승인한 변경만 확정된다.
- 화면이 Redis를 "읽는" 곳은 표시용 두 가지뿐이다: 다른 사용자의 Lock 표시(`useForeignLocks`), 버전 저장 버튼 활성화 판정(`hasVersionChanges`). 둘 다 읽기 전용이다.

### ② 인프라

| 구성 | 하는 일 | 주요 키·값 |
|---|---|---|
| WebSocket | 클라이언트↔서버 메시지 전송 (편도 10ms). 연결 끊김·재연결 | 연결 ID |
| Redis Live 상태 | 지금 편집 중인 최신 내용 (DB보다 앞선 상태) | `live:block:{B}`, `live:template:{T}` |
| Redis Lock | 속성 단위 잠금 (TTL 10초, 입력할 때마다 연장) | `lock:block:{B}:{path}`, `lock:template:{T}:element:{E}:{path}`, `fence:{lockKey}` |
| Redis 편집 권한 (v1.2.8) | 요소를 선택한 사람의 요소 전체 권한 (TTL 없음) + 대기열 | `lock:template:{T}:element:{E}:edit`, `lockwait:template:{T}:element:{E}:edit` |
| Redis Stream | 대상별 변경 기록 (재연결 시 따라잡기용), 전역 순번 | `stream:block:{B}`, `stream:template:{T}` |
| Redis Presence | 누가 무엇을 선택했는지, 커서 위치 (Hash + Pub/Sub) | `presence:template:{T}` |
| Redis Debounce | 속성별 DB 저장 예약 (1초) | `debounce:block:{B}:{path}`, `debounce:template:{T}:element:{E}:{path}` |
| 시뮬레이션 시계 | 지연·TTL·Debounce·재시도 타이머 | 시뮬레이션 시각 (재생 속도·일시정지 가능) |

### ③ 백엔드

| 구성 | 하는 일 |
|---|---|
| WsServer | 접속(HELLO), 템플릿 보기(VIEW_TEMPLATE) → **SYNC**(스냅샷 + 놓친 변경) 응답, Presence 중계, 연결 종료 처리 |
| EditService | Lock 요청·해제·만료, 편집 권한·대기열·넘기기, **PROPERTY_UPDATE 검증 → Redis 반영 → 전파 → Debounce 예약**, Debounce 만료 시 DB 저장·재시도 |
| StructureService | 요소 추가·삭제·복원·순서 변경·템플릿 이름 변경. **Debounce 없이 즉시** DB 트랜잭션. 임시 ID → 서버 ID 발급 |
| VersionService | 버전 저장(변경된 블록만 block_version 생성), 과거 버전 복원 |
| Broadcaster | 승인된 변경을 Stream에 기록하고 같은 템플릿을 보는 사용자에게 Delivery |

서버가 최종 판정자다. 화면이 막아 둔 동작도 서버에서 한 번 더 검사한다 (예: 편집 중인 요소 삭제 → `ELEMENT_LOCKED`).

### ④ DB

| 그룹 | 테이블 | 언제 쓰이나 |
|---|---|---|
| 블록 확정본 | `block`, `block_version`, 콘텐츠 10종(`block_text`, `block_title`, `block_image`, `block_file`, `block_link`, `block_song`, `block_list`, `block_table`, `block_video`, `block_embed`) | **버전 저장할 때만** INSERT. 콘텐츠 테이블의 id = block_version.id (1:1 공유 PK) |
| 블록 Live 사본 | `block_live_state`(content, revision, persisted_revision), `block_property_state`(속성별 revision) | 속성 편집 후 **Debounce 1초** 뒤 저장 |
| 템플릿 확정본 | `template`, `template_version`, `template_element`, `template_version_element` | 요소 추가·삭제(element), 이름 변경(template.name)은 즉시, 버전은 저장할 때 |
| 템플릿 Live 사본 | `template_live_state`, `template_live_element`(배치), `template_element_property_state` | 구조 변경은 즉시, 배치 변경은 Debounce 1초 뒤 |

---

## 3. 데이터의 세 가지 상태

같은 내용이 세 곳에 있고, 갱신 시점이 다르다.

| 상태 | 위치 | 갱신 시점 | 상단 저장 표시 |
|---|---|---|---|
| 화면에 보이는 값 | 사용자 replica (UI) | 입력하는 즉시 (낙관적) | "저장하는 중…" |
| 실시간 최신 값 | Redis Live (인프라) | 서버 승인 즉시 → 다른 사용자에게 바로 보임 | "저장하는 중…" (DB 대기) |
| 저장된 Live 사본 | block_live_state 등 (DB) | 입력이 멈추고 1초 뒤 | "모든 변경 사항 저장됨" |
| 확정 버전 | block_version · template_version (DB) | "버전 저장"을 누를 때만 | 버전 기록에 v번호로 남음 |

> 다른 사용자 화면에 바로 보이는 것은 Redis Live 반영 + 실시간 전파 덕분이다. 1초 Debounce는 **DB 저장만** 늦춘다.

---

## 4. 흐름별 정리

표의 각 행은 시간 순서다. `→`는 메시지, 굵은 글씨는 상태가 바뀌는 곳이다.

### 4.1 접속과 동기화

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | 클라이언트가 HELLO / VIEW_TEMPLATE 전송 | WebSocket 연결(WS_OPEN) | 세션 참여 표시 | |
| 2 | | Presence Hash에 접속 상태 기록, Pub/Sub 구독 | 처음 보는 템플릿이면 스냅샷 생성 | template.name 등 읽기 |
| 3 | **SYNC 적용**: 스냅샷 + 놓친 변경을 replica에 반영 | Stream에서 놓친 변경 읽기 | SYNC 응답 (syncWatermark 포함) | |
| 4 | 다른 사용자의 선택·커서 표시 | | | |

### 4.2 요소 선택 (편집 권한, v1.2.8)

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | 요소 클릭 → 선택 상태 변경, **Presence 전송** | Presence Hash 갱신 → Pub/Sub로 다른 사용자에게 | | |
| 2 | 편집 권한 요청 (PROPERTY_LOCK_REQUEST, path `edit`) | | 비어 있고 다른 사람이 그 요소의 속성 Lock도 없으면 **승인** | |
| 3a | 승인: 툴바에 서식 버튼 표시 | **`lock:…:edit` 저장 (TTL 없음)** | PROPERTY_LOCK_GRANTED | |
| 3b | 거부: 선택만 됨. 툴바에 아이콘 + "🔒 사용자 N 편집 중"만 | **`lockwait:` 대기열에 추가** (선택한 순서) | PROPERTY_LOCK_DENIED (대기 n번째) | |
| 4 | 앞사람이 그 요소에서 나감 (다른 요소, 빈 곳, 템플릿 전환, 연결 끊김) | 권한 키 삭제 | 대기열 앞에서부터 **아직 그 요소를 선택하고 있는** 사람에게 넘김 (LOCK_HANDOFF) | |
| 5 | 넘겨받은 사람 화면에 서식 버튼이 나타남 | 권한 키를 새 보유자로 저장 | | |

- 권한을 가진 사람이 있으면 다른 사람의 **내용·서식·위치·순서·삭제 요청은 서버가 모두 거부**한다.
- 다른 사람 화면의 이름표는 요소마다 하나로 모인다: "🔒 사용자 1 · 편집 중" + 선택만 한 사람은 옆에 작게.
- 커서 이동은 순수 Presence라 네트워크 이벤트를 만들지 않는다 (50ms throttle).

### 4.3 텍스트 입력 (속성 편집)

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | 캔버스에서 입력 → `editProperty` intent → op. **replica에 바로 반영** (낙관적), pendingOps에 추가, Undo 기록 | | | |
| 2 | 이 속성의 Lock이 없으면 PROPERTY_LOCK_REQUEST, 있으면 바로 PROPERTY_UPDATE | WebSocket 전송 (10ms) | | |
| 3 | | **`lock:block:{B}:content` (TTL 10초)**, fencingToken 증가 | 편집 권한·Lock 확인 후 GRANTED | |
| 4 | PROPERTY_UPDATE (baseRevision, fencingToken) | | 검증: 사용자 인증 → 권한 → Lock → Fencing Token → Revision | |
| 5 | | **Redis Live 반영**, revision +1, **Stream XADD** | 승인 (PROPERTY_UPDATE_ACK) | |
| 6 | 다른 사용자들의 replica에 **CHANGE 적용** (DELIVERY) | Broadcast 1건 + 사용자별 Delivery N건 | PROPERTY_UPDATED | |
| 7 | 내 pendingOps에서 제거 (확정) | **Debounce 예약** (1초, 다시 입력하면 연장) | DEBOUNCE_SCHEDULED | |
| 8 | 상단 "모든 변경 사항 저장됨" | 예약 삭제 | Debounce 만료 → **DEBOUNCE_SAVE** | **block_live_state.content에 그 속성만 병합**, block_property_state 갱신, persisted_revision 계산 |
| 9 | | | PROPERTY_PERSISTED 알림 | |

- 거부되면(다른 사람 Lock, revision 충돌 등) 그 op만 pendingOps에서 빠지고 화면이 서버 값으로 돌아간다. Undo 기록도 정리한다.
- DB 저장 실패 시 1초 → 2초 → 4초 간격으로 재시도하고, 그래도 실패하면 DEAD(수동 재시도 대상). Live 값은 유지된다.
- 텍스트·제목·목록은 내용에 맞춰 높이가 바뀌므로 `size.height` 변경이 **같은 gesture**로 함께 간다 (실행 취소 한 번에 같이 되돌아감).
- 서식(굵게·기울임·밑줄·취소선, 글자 크기, 색상, 정렬)도 같은 흐름이다. 속성마다 `property_path`와 Lock이 따로다 (`style.bold` 등).

### 4.4 위치 이동·크기 조절 (배치 편집)

4.3과 같은 흐름이고 대상만 다르다.

| 차이점 | 내용 |
|---|---|
| 대상 | `template:{T}` / 요소 E의 `position.x`, `position.y`, `size.width`, `size.height` (각각 따로 Lock) |
| Redis | `lock:template:{T}:element:{E}:{path}`, `live:template:{T}`, `stream:template:{T}` |
| DB | Debounce 뒤 `template_live_element.props`, `template_element_property_state` |
| 묶음 이동 | 여러 요소를 함께 끌면 요소마다 op가 가지만 같은 gesture라 Undo 한 번 |

### 4.5 요소 추가·삭제·순서 변경·이름 변경 (구조 변경)

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | intent → op. 추가는 **임시 ID**(`local-E1`)로 바로 화면에 나타남 | | | |
| 2 | STRUCTURE_COMMAND (baseStructureRevision) | 전송 | 검증: 세션·권한·구조 revision·대상 (삭제·순서는 다른 사람의 편집 권한/Lock 확인) | |
| 3 | | | 추가면 **서버 ID 발급** (E002, B002) | **즉시 트랜잭션** (Debounce 없음): 추가 → block, block_live_state, template_element, template_live_element INSERT / 삭제 → live 행 DELETE + deleted_at / 이름 → template.name UPDATE |
| 4 | | **Redis Live 반영**, 구조 revision +1, Stream 기록. 삭제면 그 요소 Lock·대기열·Debounce 정리 | STRUCTURE_SAVE → STRUCTURE_UPDATE_ACK | |
| 5 | 임시 ID → 서버 ID 치환 (선택·Undo·대기 중 op 포함). 새 요소면 그때 편집 권한 요청 | | STRUCTURE_UPDATED 전파 | |
| 6 | 다른 사용자 화면에 반영 | Delivery | | |

- 새 블록은 `current_version_id = NULL`이고 block_version·콘텐츠 행이 없다. 첫 "버전 저장" 때 생긴다.
- 복제·붙여넣기는 원본 내용·크기를 담은 요소 추가와 같다 (엔진 변경 없음).

### 4.6 버전 저장

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | "버전 저장" (마지막 버전 이후 바뀐 게 없으면 버튼 비활성) → TEMPLATE_SAVE | | | |
| 2 | | | 블록별로 Live 내용 vs current_version 콘텐츠 비교, 구성 비교 → 바뀐 게 없으면 **NO_CHANGES** (버전 안 만듦) | |
| 3 | | 대기 중 Debounce를 같은 트랜잭션 앞단에서 flush | TEMPLATE_SAVE_ACK (요청 승인, 아직 저장 전) | |
| 4 | | | VERSION_SAVE | **바뀐 블록만** block_version + 콘텐츠 행 INSERT, block.current_version_id 갱신 / template_version + template_version_element INSERT, template.current_version_id 갱신 |
| 5 | "v3 버전을 저장했어요" | | TEMPLATE_SAVED 알림 | |

### 4.7 과거 버전 복원

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | 버전 기록에서 👁 미리보기 (DB 읽기만) → "복원" | | | |
| 2 | TEMPLATE_RESTORE | | TEMPLATE_RESTORE_ACK | |
| 2-1 | | 대기 중 Debounce flush | **복원 직전 자동 저장 (v1.2.9)**: 마지막 버전 이후 바뀐 게 있으면 4.6과 같은 저장을 먼저 실행 → VERSION_SAVE + TEMPLATE_SAVED | 지금 상태를 일반 버전으로 INSERT (바뀐 게 없으면 생략) |
| 3 | | | VERSION_SAVE (복원) | **새 template_version 생성** (restored_from_version_id = 원본, 자동 저장 다음 번호), 원본의 TVE 복사 (block_version_id 유지). 기존 버전은 바꾸지 않음 |
| 4 | | Redis Live 템플릿 구성 교체 | STRUCTURE_UPDATED (REPLACE_TEMPLATE_STRUCTURE) 전파 | template_live_element 구성 복원 |
| 5 | 배치가 되돌아감. "복원 전 상태는 v5로 저장해 두었어요". 블록 내용이 그 버전과 다르면 "글 내용은 지금 내용을 유지했어요" | | CONTENT_MISMATCH (블록 Live 내용은 바꾸지 않음) | |
| 6 | 방금 복원한 버전의 복원 버튼은 수정이 생길 때까지 비활성 | | | |

### 4.8 실행 취소 (Undo / Redo)

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | ⌘Z → Undo 스택에서 항목을 꺼내 **되돌리는 op**를 만든다. 먼저 현재 값이 기록과 같은지 확인 (다른 사람이 바꿨으면 UNDO_CONFLICT) | | | |
| 2 | 속성은 PROPERTY_UPDATE, 구조는 STRUCTURE_COMMAND (생성을 되돌린 뒤 Redo는 같은 ID로 ELEMENT_RESTORE) | | 서버도 기대값을 다시 검사 | 일반 편집과 같은 경로로 저장 |
| 3 | 속성 Undo는 명령 처리 뒤 그 Lock을 해제 (편집 권한은 선택하는 동안 유지) | | | |

Undo 스택은 사용자별로 클라이언트(UI 계층)에만 있다. 서버·DB에는 저장하지 않는다.

### 4.9 연결 끊김과 재연결

| 단계 | UI | 인프라 | 백엔드 | DB |
|---|---|---|---|---|
| 1 | 상단 "오프라인", 편집 전송 불가 | 연결 종료. 그 사용자에게 가는 Delivery는 QUEUED | CLIENT_DISCONNECTED. Presence status=disconnected. **편집 권한 해제 → 대기자에게 넘김** | |
| 2 | | 속성 Lock은 TTL(10초)로 만료 | LOCK_EXPIRED | |
| 3 | 재연결 → HELLO | | | |
| 4 | **SYNC로 따라잡기** (놓친 변경 적용), 선택 중이던 요소의 편집 권한 다시 요청 | Stream에서 놓친 변경 읽기 | SYNC | |

---

## 5. Lock과 편집 권한 요약

| 종류 | 키 | 언제 얻나 | 언제 풀리나 | 막는 것 |
|---|---|---|---|---|
| 요소 편집 권한 | `lock:template:{T}:element:{E}:edit` | 요소를 **선택**할 때 | 그 요소에서 나갈 때, 연결이 끊길 때, 요소 삭제 (TTL 없음) | 다른 사용자의 그 요소 전체 편집(내용·서식·위치·순서·삭제) |
| 속성 Lock | `lock:block:{B}:{path}`, `lock:template:{T}:element:{E}:{path}` | 그 속성을 **처음 바꿀** 때 | 요소에서 나갈 때, TTL 10초 만료(입력마다 연장), 속성 Undo 뒤 | 같은 속성의 동시 수정 |

- 대기 순서: 편집 권한을 거부당한 사람은 선택한 순서대로 대기열에 들어가고, 권한이 풀리면 아직 그 요소를 선택하고 있는 첫 사람에게 자동으로 넘어간다.
- 서로 막힘 방지: 다른 사람이 그 요소의 속성 Lock을 가지고 있으면 빈 편집 권한도 주지 않고 기다리게 한다. 그 Lock이 풀리거나 만료되면 넘긴다.
- 입력 포커스 해제, 드래그 종료, 시점 전환은 해제 사유가 아니다.

---

## 6. 주요 수치

| 항목 | 값 | 위치 |
|---|---|---|
| WebSocket 편도 지연 | 10ms | 인프라 |
| 커서 Presence throttle | 50ms | UI → 인프라 |
| 속성 Lock TTL | 10초 (PROPERTY_UPDATE마다 연장) | 인프라 |
| 편집 권한 TTL | 없음 (선택하는 동안 유지) | 인프라 |
| Debounce (DB 저장 지연) | 1초 (속성별, 다시 입력하면 연장) | 백엔드 |
| DB 저장 재시도 | 1초 → 2초 → 4초, 이후 DEAD | 백엔드 |
| 템플릿 이름 길이 | 1~60자 | 백엔드 검증 |

---

## 7. 거부 사유 코드

| 코드 | 언제 | 화면 |
|---|---|---|
| PROPERTY_LOCK_DENIED | 다른 사람이 그 속성 Lock 또는 그 요소의 편집 권한을 가짐 | 서버 값으로 되돌림, "사용자 N이(가) 편집 중이에요" |
| ELEMENT_LOCKED | 다른 사람이 편집 중인 요소를 삭제·순서 변경 | 삭제·순서 버튼이 아예 보이지 않음 |
| REVISION_CONFLICT | 기준 revision이 서버와 다름 | 서버 값으로 되돌림 |
| STRUCTURE_CONFLICT | 기준 구조 revision이 서버와 다름 | 구조 변경 취소 |
| UNDO_CONFLICT | 되돌리려는 값을 다른 사람이 먼저 바꿈 | "다른 사용자가 먼저 바꿔서 되돌릴 수 없어요" |
| INVALID_NAME | 템플릿 이름이 비었거나 60자 초과 | 이름 입력 취소 |
| LOCK_NOT_HELD · FENCING_TOKEN_STALE | Lock이 만료되었거나 오래된 토큰 | 다시 Lock 요청 |
| NO_CHANGES (성공 응답) | 저장할 변경 없음 | "바뀐 내용이 없어 새 버전을 만들지 않았어요" |

---

## 8. 시뮬레이터 전용 요소

실제 서비스에는 없고 동작을 관찰하기 위해 있는 것들이다.

| 요소 | 역할 |
|---|---|
| 사용자 시점 전환 (상단 사용자 1~4) | 어느 사용자의 replica를 화면에 보여 줄지 선택. 네트워크·Lock 변화 없음 |
| Network Timeline (하단) | 모든 메시지·Redis·DB 이벤트를 시간순으로 표시 (Presence는 따로) |
| 모니터 패널 (오른쪽: PostgreSQL · Redis · Live vs PG · Console) | DB 테이블, Redis 키, Live와 DB 차이, 연결 끊기·실패 주입·시나리오 실행 |
| 시계 (재생·일시정지·한 단계·배속) | 시뮬레이션 시각을 조절해 Debounce·TTL·재시도를 눈으로 확인 |
| 개발자 정보 `</>` | 편집기 안에 테이블·ID·경로 같은 내부 용어를 함께 표시 |
