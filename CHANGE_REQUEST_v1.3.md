# CHANGE_REQUEST_v1.3.md

# 템플릿 편집기 시뮬레이터 v1.3 변경 요청

## 0. 이 문서의 목적과 작업 방식

이 문서는 2026-11-12 ~ 2026-11-16 사이에 확정한 설계 변경을 정리한 것이다. 기존 프로젝트(v1.2.8 기준, CLAUDE_PROMPT.md §16.1 완료 보고 상태)에 아래 변경을 반영해 주세요.

작업 전에 다음을 먼저 해 주세요.

1. 기존 문서(CLAUDE_PROMPT.md, DB_SCHEMA.md, DB_OVERVIEW.md, SYSTEM_FLOW.md, SIMULATION_SCENARIOS.md)와 현재 코드(src/engine, src/editor, src/monitor, src/scenarios, tests)를 읽고, 이 문서의 각 항목이 어느 파일에 영향을 주는지 목록으로 정리한다.
2. 이 문서와 기존 문서가 충돌하면 **이 문서를 따른다.**
3. 간단한 구현 계획을 먼저 제시하고 진행한다.

기존 원칙은 그대로 유지한다.

- Vite + React 18 + TypeScript(strict), npm, Vitest, CSS Modules
- 엔진(src/engine)은 React를 import하지 않는다.
- 실제 PostgreSQL, Redis, WebSocket 서버를 연결하지 않고 Mock Engine으로 동작한다.
- UI는 EditorIntent만 발생시키고 DB·Redis를 직접 바꾸지 않는다.
- VirtualClock, 결정적 ID, 단일 WorldState, 모든 쓰기는 하나의 트랜잭션(실패 시 전체 롤백)
- 3층 구조: Identity(이름표) / Live(Redis) → Persisted Live(PostgreSQL 편집 중 표) / Version Snapshot(버전 표, INSERT만)

각 Phase가 끝나면 CLAUDE_PROMPT.md §15.7 형식(빌드 결과, 테스트 결과, 구현된 기능, 아직 엔진에 연결되지 않은 기능)으로 보고해 주세요.

---

## 1. 변경 요약

| # | 변경                                                                                   | 종류                            |
| - | -------------------------------------------------------------------------------------- | ------------------------------- |
| 1 | 블록을 템플릿보다 상위 개념으로 둔다. 동기화 블록 / 일반 블록 구분                     | 정책 + DB + UI                  |
| 2 | 동기화 블록 배치·설정·해제·삭제, 블록 조회 페이지                                   | 정책 + DB + UI                  |
| 3 | 컨테이너 블록 (범용, 담을 종류 지정, 중첩 금지, 순서대로 쌓기, 동기화는 컨테이너 단위) | 정책 + DB + UI                  |
| 4 | 블록 단위 버전 저장 (블록 조회 페이지)                                                 | 정책 + DB + UI                  |
| 5 | 템플릿 버전 저장 시 "바뀌었나" 비교 기준 변경                                          | 정책                            |
| 6 | 템플릿 생성·소프트 삭제 흐름 추가                                                     | 정책 + DB + UI                  |
| 7 | **잠금(Lock) 전체 제거, 동시 수정 허용 (마지막 값 우선)**                        | 정책 + Redis + 이벤트 + DB + UI |
| 8 | 주보·콘티용 블록 종류 13개 추가, sermon 제거                                          | DB + UI                         |
| 9 | DB 정합성 보강 (UNIQUE, 묶음 FK, ON UPDATE CASCADE)                                    | DB                              |

---

## 2. 정책 변경

### 2.1 블록은 템플릿보다 상위 개념이다

- 블록은 작업공간(workspace)에 속하며 템플릿 없이도 존재한다.
- 템플릿은 template_element를 통해 블록을 **가져다 배치**한다.
- 블록은 두 가지 모드를 가진다.
  - **일반 블록(normal)**: 살아 있는 배치 자리가 **하나만** 있다.
  - **동기화 블록(synced)**: 여러 템플릿에 배치될 수 있고, 어디서 고쳐도 모든 배치 자리에 반영된다. 이름(name)이 반드시 있어야 한다.
- 동기화는 새 구조가 아니라 기존 구조(블록 내용은 block_live_state 한 줄, 템플릿은 template_element로 블록을 가리킴)를 그대로 쓴다. 바뀌는 것은 전파 대상 계산과 UI다.

### 2.2 동기화 블록 기능

**배치할 때 선택지 (블록 추가 창)**

- 기존 동기화 블록 목록에서 고르기 → 블록을 새로 만들지 않고 template_element만 추가해 기존 block_id를 가리킨다.
- 새 동기화 블록 → block(sync_mode = synced, name)을 만들고 배치한다.
- 일반 블록 → 기존과 같다.

**복사·붙여넣기**

- 붙여넣으면 블록을 화면에 바로 보여주고(로컬 임시 상태, 서버 전송 전), "동기화 블록으로 / 일반 블록으로" 선택창을 띄운다.
- 동기화로 선택: 원본이 일반 블록이면 원본을 synced로 바꾸고 이름을 받는다. 새 자리는 **같은 block_id**를 가리킨다. 한 트랜잭션.
- 일반으로 선택: 원본을 **Redis Live 최신 내용 기준으로** 복제해 새 일반 블록을 만든다. 컨테이너면 자식까지 복제한다.
- 선택창을 닫으면 일반 블록으로 처리한다.

**우클릭 메뉴**

- 일반 블록: "동기화 블록으로 설정"(이름 입력) → block.sync_mode = synced, name 설정
- 동기화 블록: "동기화 해제", "삭제"(이 템플릿에서만), "동기화 블록 삭제"(모든 템플릿에서)

**동기화 해제**

- 대상은 블록이 아니라 **배치 자리(templateId + elementId)**다.
- 이 블록이 살아 있는 자리 하나에만 있으면 sync_mode = normal로 바꾸기만 한다.
- 여러 자리에 있으면 Redis Live 최신 내용으로 새 일반 블록을 복제하고(컨테이너면 자식까지), **template_element.block_id를 새 블록으로 바꾼다.** 자리 ID(elementId)는 유지한다. template_live_element.block_id는 §3.5의 ON UPDATE CASCADE로 함께 바뀐다.
- 과거 template_version_element는 그때의 block_version_id를 가리키므로 영향 없다.

**동기화 블록 삭제 (모든 템플릿에서)**

- 우클릭 메뉴와 블록 조회 페이지에서 할 수 있다. 확인창에 영향받는 템플릿 수를 보여준다.
- 소프트 삭제다. 한 트랜잭션에서:
  - 대기 중 Debounce flush를 먼저 반영
  - block.deleted_at 설정 (컨테이너면 자식 블록들도)
  - 이 블록을 가리키는 살아 있는 template_element 전부에 deleted_at 설정, template_live_element 행 DELETE, 각 템플릿 나머지 sequence 당기기, 각 template_live_state revision 증가
- 영향받는 템플릿들의 구조 처리 순서는 **templateId 오름차순**으로 잡는다(교착 방지).
- 삭제 후 이 블록에 오는 편집 요청은 TARGET_NOT_FOUND(또는 TARGET_DELETED)로 거절한다.

**블록 조회 페이지**

- 동기화 블록 목록과, 블록마다 배치된 템플릿 목록을 보여준다.
- 템플릿에서 **빼낸 자리**(template_element.deleted_at 있음)는 보여주지 않는다.
- **삭제된 템플릿**(template.deleted_at 있음)은 "템플릿 이름 (삭제됨)"으로 보여준다.
- 블록을 열어 편집할 수 있고, 여기서 고치면 모든 템플릿에 한 번에 반영된다.
- 블록 단위 버전 저장 버튼이 있다(§2.5).

### 2.3 컨테이너 블록

- 컨테이너는 **블록들의 집합소**다. 안의 블록 하나하나는 block 표에 한 줄씩 있는 독립된 블록이다.
- 범용 컨테이너 하나(kind = container)에 **담을 종류(container_child_kind)**를 지정한다. 예: 'song'
- 자식 블록 규칙
  - 컨테이너 하나에만 속한다(parent_block_id).
  - template_element에 직접 배치할 수 없다.
  - 혼자서는 동기화 블록이 될 수 없다. **동기화는 항상 컨테이너 단위**다.
  - kind는 부모의 container_child_kind와 같아야 한다.
- 컨테이너 안에 컨테이너는 넣을 수 없다.
- 자식은 **순서대로 쌓인다**(sequence만 있고 위치·크기 props는 없다).
- 자식 추가·삭제·순서 변경은 구조 변경처럼 **Debounce 없이 즉시** 트랜잭션으로 저장하고, 컨테이너 단위로 직렬 처리하며, 컨테이너의 block_live_state.revision을 증가시킨다.
- 자식 삭제: 자식 block.deleted_at 설정 + block_container_item 행 DELETE + sequence 당기기
- 컨테이너는 "작은 템플릿"으로 본다. 대응 관계:
  - template_element ↔ block.parent_block_id (소속)
  - template_live_element ↔ block_container_item (지금 순서)
  - template_version_element ↔ block_version_item (버전 속 순서와 자식 버전 고정)
- 동기화 컨테이너 안 자식을 고치면 전파 대상은 **자식 → 부모 컨테이너 → blockusage:{컨테이너}** 순서로 찾는다.

### 2.4 소프트 삭제

| 대상                 | 방식                                                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 템플릿 삭제          | template.deleted_at만 설정. template_element는 건드리지 않는다(블록 조회 페이지 "(삭제됨)" 표시용). Redis blockusage에서 이 템플릿을 제외해 전파 대상에서 뺀다. 보고 있던 사용자에게 TEMPLATE_DELETED |
| 템플릿에서 요소 삭제 | 기존과 같음 (template_element.deleted_at, live 행 DELETE)                                                                                                                                             |
| 동기화 블록 삭제     | §2.2                                                                                                                                                                                                 |
| 컨테이너 자식 삭제   | §2.3                                                                                                                                                                                                 |

버전 표(block_version, 내용 표, template_version, template_version_element, block_version_item)는 어떤 경우에도 수정·삭제하지 않는다.

### 2.5 블록 단위 버전 저장

- 블록 조회 페이지에서 블록 하나의 버전을 저장할 수 있다.
- 처리: BLOCK_SAVE → 검증, Live 내용과 block.current_version_id 비교 → BLOCK_SAVE_ACK → VERSION_SAVE 트랜잭션 → BLOCK_SAVED
- 트랜잭션: 이 블록(컨테이너면 자식들까지)의 대기 중 Debounce flush → 바뀐 경우 block_version + 내용 행 INSERT → block.current_version_id, block_live_state.base_block_version_id 갱신
- 컨테이너: 바뀐 자식마다 자식 버전을 먼저 만들고, 컨테이너 버전 + block_container + block_version_item(자식별 child_block_version_id, sequence)을 만든다.
- **템플릿 버전(template_version_element)은 건드리지 않는다.** 템플릿은 자기 저장 때 블록 버전을 가져간다.
- 바뀐 것이 없으면 noChanges = true로 응답하고 버전을 만들지 않는다.

### 2.6 템플릿 버전 저장의 비교 기준 변경 (DB_SCHEMA §7.7 수정)

- 블록이 바뀌었는지는 **block.current_version_id가 아니라, 그 템플릿의 마지막 template_version_element가 가리키는 block_version**과 비교한다.
  - 이유: 동기화 블록은 다른 템플릿이나 블록 페이지에서 먼저 저장해 current_version_id가 앞서 있을 수 있다. 그 경우 기존 규칙은 NO_CHANGES로 잘못 판단한다.
- 템플릿에 처음 배치된 블록(마지막 버전에 없는 자리)은 바뀐 것으로 본다.
- 바뀐 블록의 Live 내용이 block.current_version_id 내용과 같으면 **새 block_version을 만들지 않고 그 버전을 재사용**한다. 다르면 새로 만든다.
- 컨테이너는 자식 단위로 같은 규칙을 적용한다.

### 2.7 잠금 제거와 동시 수정 (기존 Lock 정책 전부 대체)

**제거한다**

- 속성 Lock, 요소 편집 권한(…:edit), 편집 권한 대기열(lockwait), Fencing Token, Lock TTL·만료
- 블록 단위 편집 권한(설계 중 검토했던 lock:block:{B}:edit 포함)
- 다른 사용자가 편집 중이라 삭제·순서 변경을 막던 규칙(ELEMENT_LOCKED), 동기화 블록 삭제를 막던 규칙(BLOCK_LOCKED)
- UI의 Lock 소유자 표시, 편집 진입 차단, 대기 순번 표시

**새 규칙: 마지막 값 우선(Last Write Wins)**

- 같은 속성을 여러 사용자가 동시에 고치면 서버는 **도착 순서대로 모두 승인**하고, **마지막에 승인된 값이 최종 값**이 된다.
- PROPERTY_UPDATE는 baseRevision 불일치로 거절하지 않는다. baseRevision은 클라이언트 동기화 확인용으로만 보낸다.
- 서버는 승인할 때마다 PROPERTY_UPDATED로 최종 값을 전파해 모든 replica를 맞춘다. 요청자의 낙관적 값이 다른 사람의 값으로 덮이면 replica는 서버 값으로 맞춘다.
- 구조 변경(요소 추가·삭제·순서, 컨테이너 자식 추가·삭제·순서)은 **기존처럼 템플릿/컨테이너 단위 직렬 큐와 structureRevision 검사를 유지**한다(STRUCTURE_CONFLICT 유지). 이것은 잠금이 아니라 처리 순서 보장이다.
- UNDO_CONFLICT(되돌리려는 값을 다른 사람이 이미 바꿈)는 유지한다.
- Debounce flush의 최신 revision 보호(STALE_REVISION)는 유지한다.
- 다른 사람이 편집 중인 요소도 삭제할 수 있다. 요소만 템플릿에서 빠지고 블록은 남으므로, 그 블록에 이미 승인된 편집은 정상 저장된다.

---

## 3. DB 변경

### 3.1 block 표: 칸 추가

```sql
ALTER TABLE block
  ADD COLUMN sync_mode text NOT NULL DEFAULT 'normal'
    CHECK (sync_mode IN ('normal', 'synced')),
  ADD COLUMN name text,                                   -- 동기화 블록 이름
  ADD COLUMN parent_block_id text REFERENCES block (id),  -- 컨테이너 자식이면 부모
  ADD COLUMN container_child_kind text,                   -- 컨테이너가 담을 종류
  ADD COLUMN deleted_at timestamptz;                      -- 소프트 삭제

ALTER TABLE block ADD CONSTRAINT chk_synced_has_name
  CHECK (sync_mode = 'normal' OR name IS NOT NULL);
ALTER TABLE block ADD CONSTRAINT chk_child_not_synced
  CHECK (parent_block_id IS NULL OR sync_mode = 'normal');
ALTER TABLE block ADD CONSTRAINT chk_container_not_nested
  CHECK (kind <> 'container' OR parent_block_id IS NULL);
ALTER TABLE block ADD CONSTRAINT chk_container_child_kind
  CHECK ((kind = 'container') = (container_child_kind IS NOT NULL));
ALTER TABLE block ADD CONSTRAINT chk_child_kind_not_container
  CHECK (container_child_kind IS NULL OR container_child_kind <> 'container');

ALTER TABLE block ADD CONSTRAINT uq_block_id_parent UNIQUE (id, parent_block_id);
```

### 3.2 template 표: 칸 추가

```sql
ALTER TABLE template ADD COLUMN deleted_at timestamptz;
```

### 3.3 컨테이너용 새 표 3개

```sql
-- 버전 속 컨테이너 자체 내용 (내용 표, PK = FK)
CREATE TABLE block_container (
  id    text PRIMARY KEY REFERENCES block_version (id),
  title text
);

-- 컨테이너의 지금 순서 (Persisted Live)
CREATE TABLE block_container_item (
  container_block_id text NOT NULL,
  child_block_id     text NOT NULL,
  sequence           integer NOT NULL,
  updated_at         timestamptz NOT NULL,
  PRIMARY KEY (container_block_id, child_block_id),
  UNIQUE (child_block_id),
  UNIQUE (container_block_id, sequence) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (child_block_id, container_block_id)
    REFERENCES block (id, parent_block_id)
);

-- 버전 속 컨테이너 순서와 자식 버전 고정 (Version Snapshot)
CREATE TABLE block_version_item (
  container_block_version_id text NOT NULL REFERENCES block_version (id),
  child_block_id             text NOT NULL REFERENCES block (id),
  child_block_version_id     text NOT NULL REFERENCES block_version (id),
  sequence                   integer NOT NULL,
  PRIMARY KEY (container_block_version_id, child_block_id)
);
```

- 컨테이너의 구조 revision은 별도 칸 없이 **컨테이너의 block_live_state.revision**을 사용한다.
- 표 이름은 위 이름을 그대로 쓴다(이름 규칙 변경 안 함).

### 3.4 블록 종류: 주보·콘티용 13개 추가, sermon 제거

모두 **글 한 칸(body)**만 가진다. property_path는 `content`(→ body) 하나이고, block_live_state.content는 `{"body": "..."}`다.

| kind           | 화면 이름        | 쓰는 곳                | 값 예시                                            |
| -------------- | ---------------- | ---------------------- | -------------------------------------------------- |
| scripture      | 성경봉독 / 말씀  | 주보, 콘티 (같은 종류) | 사도행전 27장 27-37절                              |
| creed          | 사도신경         | 주보                   | 다같이                                             |
| praise_team    | 찬양             | 주보                   | 청년부 찬양팀                                      |
| opening_prayer | 대표기도         | 주보                   | 김정빈 청년                                        |
| preacher       | 설교             | 주보                   | 고석창 목사님                                      |
| prayer_song    | 적용송           | 주보                   | 감사                                               |
| benediction    | 축도             | 주보                   | 고석창 목사님                                      |
| date           | 날짜             | 주보, 콘티             | 2026년 11월 15일                                   |
| worship_type   | 예배종류         | 콘티                   | 청년부 예배                                        |
| sermon_subject | 제목 (설교 제목) | 콘티                   | 믿음의 풍랑 속에서도                               |
| contemplation  | 묵상             | 콘티                   | (긴 글)                                            |
| song_list      | 콘티정보         | 콘티                   | 입례 / 적용송 / 1~4번 곡 / 파송곡 목록             |
| song_form      | 송폼 정보        | 콘티                   | Intro4/A-B(도돌이x)/A-B/C/C(목소리, 도돌이x)/rita. |

기존 종류 재사용: 악보 사진 → image, "예배 순서 안내" → title, 안내 문구·교회명 → text

```sql
CREATE TABLE block_scripture      (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_creed          (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_praise_team    (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_opening_prayer (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_preacher       (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_prayer_song    (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_benediction    (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_date           (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_worship_type   (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_sermon_subject (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_contemplation  (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_song_list      (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
CREATE TABLE block_song_form      (id text PRIMARY KEY REFERENCES block_version (id), body text NOT NULL);
```

block.kind CHECK:

```sql
CHECK (kind IN (
  'text','title','image','file','link','song','list','table','video','embed',
  'container',
  'creed','praise_team','opening_prayer','scripture','preacher','prayer_song','benediction',
  'date','worship_type','sermon_subject','contemplation','song_list','song_form'
))
```

- 설계 중 만들었던 sermon / block_sermon은 **만들지 않는다**(preacher로 대체).
- 설계 중 검토했던 scripture의 구절 범위 칸(book, chapter_start …)은 **만들지 않는다**. 글 한 칸만 둔다.
- 편집기의 요소 추가 도구(ToolRail)와 Inspector 레지스트리에 13종을 추가한다.

### 3.5 정합성 보강

```sql
-- (1) 한 템플릿 버전에 같은 자리는 한 번만
ALTER TABLE template_version_element
  ADD CONSTRAINT uq_tve UNIQUE (template_version_id, template_element_id);

-- (2) 이름표와 공책의 중복 정보를 묶고, 동기화 해제 시 자동으로 같이 바뀌게
ALTER TABLE template_element
  ADD CONSTRAINT uq_te_triple UNIQUE (id, template_id, block_id);
ALTER TABLE template_live_element
  ADD CONSTRAINT fk_tle_te
  FOREIGN KEY (template_element_id, template_id, block_id)
  REFERENCES template_element (id, template_id, block_id)
  ON UPDATE CASCADE;

-- (3) 한 템플릿·영역 안에서 순서 번호는 하나씩만 (맞바꿀 때 잠깐 겹치므로 커밋 때 검사)
ALTER TABLE template_live_element
  ADD CONSTRAINT uq_tle_seq UNIQUE (template_id, render_zone, sequence)
  DEFERRABLE INITIALLY DEFERRED;

-- (4) 같은 버전 번호는 한 번만 (블록 버전을 만드는 곳이 템플릿 저장·블록 저장 두 곳이 됨)
ALTER TABLE block_version
  ADD CONSTRAINT uq_bv_number UNIQUE (block_id, version);
ALTER TABLE template_version
  ADD CONSTRAINT uq_tv_number UNIQUE (template_id, version);
```

- MockDatabase에 UNIQUE(DEFERRABLE 포함), 묶음 FK, ON UPDATE CASCADE 검사가 없으면 추가한다.
- 버전 번호 UNIQUE 위반 시 서버는 번호를 다시 받아 같은 트랜잭션을 재시도한다.
- template_live_element.template_id/block_id는 template_element와 항상 같아야 한다(위 (2)로 보장).

### 3.6 삭제하는 칸

```sql
ALTER TABLE block_property_state            DROP COLUMN last_fencing_token;
ALTER TABLE template_element_property_state DROP COLUMN last_fencing_token;
```

### 3.7 CHECK로 못 막는 규칙 (트리거 또는 서버 검사)

다른 표 정보를 봐야 해서 서버 검사로 구현하고, MockDatabase에 트리거 성격의 검사로도 넣는다.

1. 일반 블록은 살아 있는 template_element가 **하나만** 있어야 한다.
2. parent_block_id가 있는 블록은 template_element에 배치할 수 없다.
3. 자식의 kind = 부모의 container_child_kind
4. parent_block_id가 가리키는 블록은 kind = container여야 한다.
5. deleted_at이 있는 블록은 새로 배치하거나 편집할 수 없다.

### 3.8 인덱스

```sql
CREATE INDEX idx_te_block ON template_element (block_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_block_synced ON block (workspace_id)
  WHERE sync_mode = 'synced' AND deleted_at IS NULL;
CREATE INDEX idx_block_parent ON block (parent_block_id);
```

### 3.9 바뀌지 않는 것

block_version, 기존 내용 표 10개(block_text 등), block_live_state, block_property_state(fencing 칸 제외), template_version, template_live_state, template_element_property_state(fencing 칸 제외)의 칸과 의미는 그대로다.

### 3.10 보류

- block_version.restored_from_version_id: 블록 버전 **복원** 기능을 만들 때 추가한다. 이번 범위에는 블록 복원이 없으므로 만들지 않는다.

---

## 4. Redis 변경

**추가**

| 키                                | 내용                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blockusage:{blockId}`          | 이 블록이 배치된**살아 있는(삭제되지 않은) 템플릿** 집합. 전파 대상 계산에 쓴다. 배치, 요소 삭제, 동기화 해제, 동기화 블록 삭제, 템플릿 삭제 때 갱신 |
| `presence:block:{blockId}`      | 블록 조회 페이지에서 이 블록을 보고 있는 사용자 (Hash + Pub/Sub)                                                                                           |
| `live:block:{containerId}` 확장 | 컨테이너면 자식 목록(childBlockIds 순서)과 structureRevision 포함                                                                                          |
| `stream:block:{containerId}`    | 컨테이너 구조 변경(STRUCTURE_UPDATED, scope = container) 기록                                                                                              |

**삭제**

`lock:block:*`, `lock:template:*`, `lock:…:edit`, `lockwait:*`, `fence:*`

**전파 대상 계산 (PROPERTY_UPDATED, PROPERTY_PERSISTED, BLOCK_SAVED 등)**

- 블록 B: `blockusage:B`의 각 템플릿을 보는 사용자 ∪ `presence:block:B`
- 자식 블록 C: 부모 P를 찾아 `blockusage:P` ∪ `presence:block:P` ∪ `presence:block:C`
- 요청자는 기존 규칙대로 응답(ACK)으로 받고, 알림(PERSISTED 등)은 요청자 포함

---

## 5. 이벤트 변경

### 5.1 신호의 종류

- **WebSocket 메시지**: 변경 요청, 전파 알림, 구독(VIEW_*)
- **조회 요청**: 목록을 한 번 읽어 오는 요청(HTTP GET 성격). 아무것도 바꾸지 않고 전파하지 않는다. 시뮬레이터에서는 Network Timeline에 "QUERY" 카테고리로 표시한다.
- **업로드 요청**: 파일을 Mock 파일 저장소에 올리고 file_url을 받는다. DB에는 파일을 넣지 않는다. Timeline에 "UPLOAD" 카테고리로 표시한다.

### 5.2 추가 이벤트

| 이벤트                                                          | 종류                | 의미 / payload                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TEMPLATE_CREATE / _ACK / _REJECTED                              | WS 요청·응답       | 새 템플릿. name(1~60자), workspaceId. DB: template(current_version_id NULL), template_live_state                                                                               |
| TEMPLATE_DELETE / _ACK / TEMPLATE_DELETED                       | WS 요청·응답·알림 | 템플릿 소프트 삭제                                                                                                                                                             |
| SYNCED_BLOCK_LIST                                               | 조회                | 작업공간의 동기화 블록 목록 (synced, 삭제 안 됨, 부모 없음)                                                                                                                    |
| BLOCK_LIBRARY_LIST                                              | 조회                | 동기화 블록 + 배치된 템플릿(이름, deleted_at). 빼낸 자리 제외                                                                                                                  |
| VIEW_BLOCK                                                      | WS 구독             | 블록 페이지에서 블록 보기 시작. 응답 SYNC(Redis Live 스냅샷, 컨테이너면 자식 포함)                                                                                             |
| STRUCTURE_COMMAND ELEMENT_CREATE`mode` 확장                   | WS 요청             | `normal` / `new_synced`(name) / `attach_synced`(blockId) / `paste_synced`(sourceBlockId, name?) / `clone`(sourceBlockId). 종류가 container면 containerChildKind 포함 |
| BLOCK_SET_SYNCED                                                | WS 요청             | blockId, name                                                                                                                                                                  |
| BLOCK_UNSYNC                                                    | WS 요청             | templateId, elementId                                                                                                                                                          |
| SYNCED_BLOCK_DELETE                                             | WS 요청             | blockId                                                                                                                                                                        |
| BLOCK_META_UPDATED                                              | WS 알림             | sync_mode, name 변경                                                                                                                                                           |
| BLOCK_DELETED                                                   | WS 알림             | 블록 페이지 구독자에게                                                                                                                                                         |
| BLOCK_USAGE_CHANGED                                             | WS 알림             | 블록 페이지 구독자에게 배치 목록 변경                                                                                                                                          |
| CONTAINER_COMMAND ITEM_CREATE / ITEM_REORDER / ITEM_DELETE      | WS 요청             | containerBlockId, baseContainerStructureRevision, (임시 ID, 대상, 위치)                                                                                                        |
| CONTAINER_COMMAND_ACK / _REJECTED                               | WS 응답             | 임시 ID → 서버 ID 매핑                                                                                                                                                        |
| STRUCTURE_UPDATED (scope = container)                           | WS 알림             | 컨테이너 구성 변경                                                                                                                                                             |
| STRUCTURE_UPDATED (op = ELEMENT_BLOCK_REPLACED)                 | WS 알림             | 동기화 해제로 자리의 블록 교체                                                                                                                                                 |
| BLOCK_SAVE / BLOCK_SAVE_ACK / BLOCK_SAVED / BLOCK_SAVE_REJECTED | WS 요청·응답·알림 | 블록 단위 버전 저장. TEMPLATE_SAVE와 같은 거부 공통 payload                                                                                                                    |
| FILE_UPLOAD                                                     | 업로드              | 파일 → file_url                                                                                                                                                               |

### 5.3 삭제 이벤트와 거절 코드

- 이벤트: PROPERTY_LOCK_REQUEST, PROPERTY_LOCK_GRANTED, PROPERTY_LOCK_DENIED, PROPERTY_LOCK_RELEASE, LOCK_HANDOFF, LOCK_EXPIRED
- 거절 코드: PROPERTY_LOCK_DENIED, LOCK_NOT_HELD, FENCING_TOKEN_STALE, ELEMENT_LOCKED, BLOCK_LOCKED, REVISION_CONFLICT(속성 편집에 한해)
- 재시도 불가 오류 분류(§8.12.2)에서 FENCING_TOKEN_STALE 제거. STALE_REVISION은 유지

### 5.4 바뀐 처리

**PROPERTY_UPDATE 검증 단계**: 사용자 인증 → 권한(보고 있는 템플릿 또는 블록) → 대상 존재·삭제 여부 → (Undo면 UNDO_CONFLICT 검사) → 승인 → Redis 기록 → 전파 → Debounce 예약

**Debounce flush**: fencing 검사 제거. 나머지(속성별 병합, 연속 persisted_revision, STALE_REVISION 보호, 재시도 1s·2s·4s, DEAD)는 그대로

---

## 6. 동작별 DB 쓰기 요약

| 동작                       | DB 쓰기 (한 트랜잭션)                                                                                                                                      | 시점               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 템플릿 생성                | template I, template_live_state I                                                                                                                          | 즉시               |
| 템플릿 삭제                | template U(deleted_at)                                                                                                                                     | 즉시               |
| 배치: 일반 / 새 동기화     | block I, block_live_state I, template_element I, template_live_element I, template_live_state U                                                            | 즉시               |
| 배치: 기존 동기화 연결     | template_element I, template_live_element I, template_live_state U                                                                                         | 즉시               |
| 붙여넣기: 동기화           | (원본 일반이면 block U sync_mode·name) + template_element I, template_live_element I, template_live_state U                                               | 즉시               |
| 붙여넣기: 일반(복제)       | block I, block_live_state I (+ 자식 block·block_live_state·block_container_item I) + 자리 I                                                              | 즉시               |
| 동기화로 설정              | block U                                                                                                                                                    | 즉시               |
| 동기화 해제(단독)          | block U(sync_mode)                                                                                                                                         | 즉시               |
| 동기화 해제(복제)          | block I, block_live_state I(+자식), template_element U(block_id) → template_live_element CASCADE, template_live_state U                                   | 즉시               |
| 요소 삭제(이 템플릿만)     | 기존과 같음                                                                                                                                                | 즉시               |
| 동기화 블록 삭제           | flush → block U(deleted_at, +자식), template_element U(deleted_at) 전부, template_live_element D 전부, sequence U, template_live_state U 각각             | 즉시               |
| 컨테이너 자식 추가         | block I(parent), block_live_state I, block_container_item I, 컨테이너 block_live_state U(revision)                                                         | 즉시               |
| 컨테이너 자식 순서         | block_container_item U(sequence), 컨테이너 block_live_state U                                                                                              | 즉시               |
| 컨테이너 자식 삭제         | block U(deleted_at), block_container_item D, sequence U, 컨테이너 block_live_state U                                                                       | 즉시               |
| 속성 편집 (모든 블록 종류) | block_live_state U, block_property_state I/U                                                                                                               | 마지막 입력 1초 뒤 |
| 블록 버전 저장             | flush → block_version I, 내용 I(+자식 버전, block_container, block_version_item I), block U, block_live_state U                                           | 즉시               |
| 템플릿 버전 저장           | flush → (§2.6 규칙으로 필요한 블록만) block_version I, 내용 I, block U, block_live_state U → template_version I, template_version_element I, template U | 즉시               |

---

## 7. UI 변경

- **블록 추가 창**: "기존 동기화 블록(이름 목록) / 새 동기화 블록(이름 입력) / 일반 블록" 세 갈래. 블록 종류에 §3.4의 13종 추가
- **동기화 표시**: 동기화 블록과 동기화 컨테이너에 아이콘·배지(색상만으로 구분하지 않음)
- **우클릭 메뉴**: 일반 블록 "동기화 블록으로 설정" / 동기화 블록 "동기화 해제", "삭제", "동기화 블록 삭제"
- **붙여넣기 선택창**: "동기화 블록으로 / 일반 블록으로", 닫으면 일반
- **동기화 블록 삭제 확인창**: 영향받는 템플릿 수와 이름
- **블록 조회 페이지(새 화면)**: 동기화 블록 목록, 블록별 배치 템플릿("(삭제됨)" 표시), 블록 열기·편집, 블록 버전 저장, 블록 버전 기록, 동기화 블록 삭제
- **템플릿 목록**: 새 템플릿, 템플릿 삭제
- **컨테이너**: 안에 담을 종류의 "+ 추가" 버튼, 순서대로 쌓인 자식, 드래그로 순서 변경, 자식 삭제
- **이미지 블록**: 파일 선택 → 업로드(Mock 파일 저장소) → file_url 반영. 외부 리소스는 여전히 불러오지 않는다
- **제거**: Lock 소유자 표시, 편집 진입 차단, "🔒 사용자 N 편집 중", 대기 순번, Console의 Lock 수동 요청·해제
- **모니터**: DB Explorer에 새 표 16개(내용 13 + 컨테이너 3) 표시, Redis 탭에 blockusage·presence:block 표시, Timeline에 QUERY·UPLOAD 카테고리

---

---

## 8. 기존 시나리오·검증·테스트 영향

Claude Code가 현재 코드를 분석해 정확한 목록을 만든 뒤 처리한다. 예상 영향:

| 대상                                      | 처리                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| 시나리오 A, E, F                          | Lock 요청·승인 단계 제거, 나머지 기대값 유지                |
| 시나리오 C (서로 다른 속성 동시 편집)     | Lock 없이 동시 편집, 속성별 flush 기대값 유지                |
| 시나리오 D (동일 속성 Lock 충돌)          | **"동일 속성 동시 수정 → 마지막 값 우선"으로 재정의** |
| 시나리오 H (요소 삭제)                    | ELEMENT_LOCKED 관련 제거                                     |
| 시나리오 K (공유 블록)                    | 동기화 블록 정책으로 설명 갱신, Lock 키 3종 기대값 제거      |
| 시나리오 L, L-DEAD                        | FENCING_TOKEN_STALE 분류 제거, 나머지 유지                   |
| 검증 10, 11 (Lock 획득·충돌)             | 동시 수정·마지막 값 우선 검증으로 대체                      |
| ED-4, ED-8, MU 중 Lock 관련               | 제거 또는 재정의                                             |
| §8.10.5 Lock 해제 시점, v1.2.8 편집 권한 | 제거                                                         |
| tests/ 의 Lock·Fencing 테스트            | 제거 또는 재작성                                             |

---

## 9. 추가 검증 조건

| ID     | 검증                                                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V13-1  | 기존 동기화 블록 배치 시 block이 새로 생기지 않고 template_element만 추가된다                                                                             |
| V13-2  | 동기화 블록을 한 템플릿(또는 블록 페이지)에서 고치면 배치된 모든 템플릿 보는 사용자와 블록 페이지 구독자에게 전파되고, DB는 block_live_state 1행만 바뀐다 |
| V13-3  | 일반 블록은 살아 있는 자리가 2개 이상이 될 수 없다                                                                                                        |
| V13-4  | 붙여넣기 동기화는 같은 block_id, 일반은 Redis Live 기준 복제(컨테이너면 자식 포함)                                                                        |
| V13-5  | 동기화 해제(여러 자리)는 그 자리만 새 블록으로 바뀌고 elementId 유지, template_live_element.block_id가 CASCADE로 함께 바뀐다. 다른 템플릿은 영향 없음     |
| V13-6  | 동기화 블록 삭제 시 모든 자리 소프트 삭제, 블록·자식 deleted_at, 과거 버전 행 변경 없음                                                                  |
| V13-7  | 블록 조회 페이지: 빼낸 자리 제외, 삭제된 템플릿은 "(삭제됨)"                                                                                              |
| V13-8  | 템플릿 삭제는 template.deleted_at만 바꾸고 template_element는 그대로, 전파 대상에서 제외                                                                  |
| V13-9  | 컨테이너: 자식은 하나의 컨테이너에만, 직접 배치 불가, 단독 동기화 불가, 담을 종류 일치, 중첩 불가                                                         |
| V13-10 | 컨테이너 자식 추가·삭제·순서는 즉시 저장, 컨테이너 revision 증가, 컨테이너가 배치된 모든 템플릿에 전파                                                  |
| V13-11 | 블록 버전 저장은 템플릿 버전을 바꾸지 않는다. 컨테이너는 block_version_item으로 자식 버전을 고정한다                                                      |
| V13-12 | 템플릿 버전 저장 비교는 그 템플릿의 마지막 버전 기준이며, Live = current_version이면 재사용한다 (N3 7·8번)                                               |
| V13-13 | 같은 속성 동시 수정은 거절 없이 모두 승인되고 마지막 승인 값으로 모든 replica가 수렴한다                                                                  |
| V13-14 | 잠금 관련 이벤트·Redis 키·DB 칸이 전혀 남아 있지 않다                                                                                                   |
| V13-15 | §3.5의 UNIQUE·묶음 FK·DEFERRABLE·CASCADE가 MockDatabase에서 동작한다(위반 시 롤백)                                                                    |
| V13-16 | 새 블록 종류 13개가 추가·편집·버전 저장·DB Explorer 표시까지 동작한다                                                                                  |
| V13-17 | 이미지 업로드는 DB에 파일을 넣지 않고 file_url만 저장한다                                                                                                 |
| V13-18 | 조회 요청(SYNCED_BLOCK_LIST, BLOCK_LIBRARY_LIST)은 DB·Redis를 바꾸지 않고 전파하지 않는다                                                                |

---

## 10. 문서 갱신

- **DB_SCHEMA.md**: §9 "v1.3 확정 정책"을 추가하고 이 문서의 §2~§5를 반영. §7.5(Lock), §7.7(저장 비교 기준), §8.10.5(Lock 해제), §8.12.2(FENCING_TOKEN_STALE), v1.2.8 편집 권한을 "v1.3에서 제거/변경"으로 표시
- **DB_OVERVIEW.md**: 코드에서 다시 생성 (표 37개: 기존 21 + 내용 13 + 컨테이너 3, kind 목록, FK, CRUD 매트릭스, Redis 키)
- **SYSTEM_FLOW.md**: Lock·편집 권한 절 제거, 동기화·컨테이너·블록 페이지·템플릿 생성/삭제 흐름 추가
- **SIMULATION_SCENARIOS.md**: §9의 기존 시나리오 수정, N1~N3 추가
- **CLAUDE_PROMPT.md**: §17 "v1.3 변경"으로 이 문서 요약과 완료 보고 추가

---

## 11. 미결 사항 (결정 전까지 기본값으로 구현하고 TODO 표시)

| # | 미결                                                                                                          | 기본값                                                                   |
| - | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1 | 긴 글(묵상 등)을 여러 사람이 동시에 타이핑할 때 한 사람 글이 덮이는 문제. 글자 단위 합치기(CRDT/OT) 도입 여부 | 마지막 값 우선(LWW). 엔진의 속성 적용부를 교체 가능한 구조로 분리해 둔다 |
| 2 | 삭제된 동기화 블록이 들어 있는 과거 템플릿 버전을 복원할 때                                                   | 그 자리는 복원에서 제외하고 경고(DELETED_BLOCK_SKIPPED) 알림             |
| 3 | 동기화 블록 삭제를 Undo로 되살리기                                                                            | 지원하지 않음                                                            |
| 4 | 블록 버전 복원(블록 페이지)                                                                                   | 이번 범위 아님 (§3.10)                                                  |

---

## 12. 구현 순서

| Phase | 범위                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 13-1  | 잠금 전체 제거, 마지막 값 우선 적용, 관련 이벤트·Redis 키·DB 칸·UI·테스트 정리, 기존 시나리오 재정의(§9). 전체 테스트 통과 확인 |
| 13-2  | DB 변경(§3), MockDatabase 제약 보강(UNIQUE·DEFERRABLE·묶음 FK·CASCADE), 새 블록 종류 13개(렌더러·Inspector·DB Explorer)        |
| 13-3  | 템플릿 생성·삭제, 동기화 블록(배치 3종, 설정, 해제, 붙여넣기, 삭제), blockusage 기반 전파, 템플릿 저장 비교 기준 변경               |
| 13-4  | 블록 조회 페이지, VIEW_BLOCK, 블록 단위 버전 저장, 조회 요청·업로드 요청(Mock 파일 저장소)                                          |
| 13-5  | 컨테이너 블록(표 3개, CONTAINER_COMMAND, 버전 저장, 동기화, 복제)                                                                    |
| 13-6  | 시나리오 N1~N3, 검증 V13-1~18 테스트, 문서 갱신(§11), 최종 보고                                                                    |
