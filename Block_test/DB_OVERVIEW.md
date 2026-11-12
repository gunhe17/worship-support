# DB 한눈에 보기

템플릿 편집기 시뮬레이터의 PostgreSQL(Mock) 전체 구조입니다. 실제 PostgreSQL이 아니라 브라우저 메모리 안의 MockDatabase이며, 실행 중 데이터는 화면 오른쪽 **PostgreSQL** 탭(DB Explorer)에서 볼 수 있습니다.

- 출처: [src/engine/db/schema.ts](src/engine/db/schema.ts)(테이블 정의), [src/engine/seed.ts](src/engine/seed.ts)(초기 데이터), [src/engine/fixtures.ts](src/engine/fixtures.ts)(시나리오 K Fixture). 이 문서는 코드에서 생성했습니다.
- 정책 상세: [DB_SCHEMA.md](DB_SCHEMA.md)

## 1. 데이터 계층

| 계층 | 의미 | 테이블 | 갱신 시점 |
| --- | --- | --- | --- |
| Identity | 데이터의 정체성 | block, template, template_element | 생성·삭제(deleted_at) |
| Live (Redis) | 서버가 승인한 최신 상태 (실시간 화면의 원본) | `live:block:*`, `live:template:*` (PostgreSQL 아님) | 승인 즉시 |
| Persisted Live | Live를 PostgreSQL에 저장한 상태 | block_live_state, block_property_state, template_live_state, template_live_element, template_element_property_state | 속성 변경: Debounce 1초 후 / 구조 변경: 즉시 |
| Version Snapshot | 사용자가 명시적으로 저장한 확정 상태 | block_version, block_text 외 콘텐츠 9개, template_version, template_version_element | 저장 버튼·복원 시 INSERT만 (수정·삭제 없음) |

## 2. 테이블 목록 (21개)

| # | 그룹 | 테이블 | 설명 | PK | 컬럼 | 시드 행 | 계층 | 갱신 시점 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Block (정체성·버전) | `block` | 블록 정체성 | id | 6 | 1 | Identity | 요소 추가 시 INSERT, 저장 시 current_version_id UPDATE |
| 2 | Block (정체성·버전) | `block_version` | 블록 확정 버전 (명시적 저장 시에만 INSERT) | id | 5 | 1 | Version Snapshot | 명시적 저장 시 INSERT만 |
| 3 | Block content (버전별 콘텐츠) | `block_text` | 텍스트 콘텐츠 | id | 3 | 1 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 4 | Block content (버전별 콘텐츠) | `block_title` | 제목 콘텐츠 | id | 4 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 5 | Block content (버전별 콘텐츠) | `block_image` | 이미지 콘텐츠 | id | 5 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 6 | Block content (버전별 콘텐츠) | `block_file` | 파일 콘텐츠 | id | 5 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 7 | Block content (버전별 콘텐츠) | `block_link` | 링크 콘텐츠 | id | 3 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 8 | Block content (버전별 콘텐츠) | `block_song` | 음악 콘텐츠 | id | 5 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 9 | Block content (버전별 콘텐츠) | `block_list` | 목록 콘텐츠 | id | 2 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 10 | Block content (버전별 콘텐츠) | `block_table` | 표 콘텐츠 | id | 2 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 11 | Block content (버전별 콘텐츠) | `block_video` | 동영상 콘텐츠 | id | 3 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 12 | Block content (버전별 콘텐츠) | `block_embed` | 임베드 콘텐츠 | id | 3 | 0 | Version Snapshot | 명시적 저장 시 INSERT만 (블록 종류에 맞는 테이블 1개) |
| 13 | Block live (편집 중 상태) | `block_live_state` | 현재 편집 중인 블록 콘텐츠 (Debounce 후 갱신) | block_id | 8 | 1 | Persisted Live | 요소 추가 INSERT, Debounce flush UPDATE, 저장 시 base UPDATE |
| 14 | Block live (편집 중 상태) | `block_property_state` | 블록 속성별 revision/저장 상태 | block_id, property_path | 6 | 0 | Persisted Live | Debounce flush 시 INSERT/UPDATE |
| 15 | Template (정체성·버전) | `template` | 템플릿 정체성 | id | 6 | 1 | Identity | 저장·복원 시 current_version_id UPDATE |
| 16 | Template (정체성·버전) | `template_version` | 템플릿 확정 버전 | id | 6 | 1 | Version Snapshot | 저장·복원 시 INSERT만 |
| 17 | Template (정체성·버전) | `template_element` | 템플릿 요소 정체성 | id | 5 | 1 | Identity | 요소 추가 INSERT, 삭제·복원 시 deleted_at UPDATE |
| 18 | Template (정체성·버전) | `template_version_element` | 확정 버전의 요소 배치 | id | 7 | 1 | Version Snapshot | 저장·복원 시 INSERT만 |
| 19 | Template live (편집 중 상태) | `template_live_state` | 템플릿 구조 revision/저장 상태 | template_id | 6 | 1 | Persisted Live | Debounce flush·구조 변경·복원 시 UPDATE |
| 20 | Template live (편집 중 상태) | `template_live_element` | 현재 편집 중인 요소 배치 | template_id, template_element_id | 7 | 1 | Persisted Live | 구조 변경 즉시 INSERT/UPDATE/DELETE, Debounce flush UPDATE |
| 21 | Template live (편집 중 상태) | `template_element_property_state` | 요소 배치 속성별 revision/저장 상태 | template_id, template_element_id, property_path | 7 | 0 | Persisted Live | Debounce flush 시 INSERT/UPDATE |

## 3. 관계 (FK)

| 테이블 | 컬럼 | 참조 | NULL 허용 | 비고 |
| --- | --- | --- | --- | --- |
| `block` | current_version_id | `block_version.id` | O | block ↔ block_version 순환 참조. MockDatabase는 FK를 커밋 시점에 검사 |
| `block_version` | block_id | `block.id` | — |  |
| `block_text` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_title` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_image` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_file` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_link` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_song` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_list` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_table` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_video` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_embed` | id | `block_version.id` | — | 콘텐츠 행 id = block_version.id |
| `block_live_state` | block_id | `block.id` | — |  |
| `block_live_state` | base_block_version_id | `block_version.id` | O |  |
| `block_property_state` | block_id | `block.id` | — |  |
| `template` | current_version_id | `template_version.id` | O |  |
| `template_version` | template_id | `template.id` | — |  |
| `template_version` | restored_from_version_id | `template_version.id` | O | 자기 참조 (복원 원본) |
| `template_element` | template_id | `template.id` | — |  |
| `template_element` | block_id | `block.id` | — |  |
| `template_version_element` | template_version_id | `template_version.id` | — |  |
| `template_version_element` | template_element_id | `template_element.id` | — |  |
| `template_version_element` | block_version_id | `block_version.id` | — |  |
| `template_live_state` | template_id | `template.id` | — |  |
| `template_live_element` | template_id | `template.id` | — |  |
| `template_live_element` | template_element_id | `template_element.id` | — |  |
| `template_live_element` | block_id | `block.id` | — |  |
| `template_element_property_state` | template_id | `template.id` | — |  |
| `template_element_property_state` | template_element_id | `template_element.id` | — |  |

관계 요약:

```
template 1 ─ N template_version 1 ─ N template_version_element N ─ 1 block_version N ─ 1 block
template 1 ─ N template_element N ─ 1 block            (같은 block을 여러 템플릿이 공유 가능)
template 1 ─ 1 template_live_state
template 1 ─ N template_live_element (= 현재 배치, 삭제된 요소는 행 없음)
block    1 ─ 1 block_live_state,  block 1 ─ N block_property_state
block_version 1 ─ 1 block_<kind> (block_text, block_title, …)
```

## 4. 테이블 상세

### block

블록 정체성 · Block (정체성·버전)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK |  | 블록 고유 ID (B001 …) |
| workspace_id | text | — |  |  | Workspace ID |
| kind | text | — |  |  | text · title · image · file · link · song · list · table · video · embed |
| current_version_id | text | O | FK | block_version.id | 현재 확정 버전. 신규 블록은 NULL (첫 저장에서 생성) |
| created_by | text | — |  |  | 생성 사용자 |
| created_at | timestamptz | — |  |  | 생성 시각 |

시드 데이터:

| id | workspace_id | kind | current_version_id | created_by | created_at |
| --- | --- | --- | --- | --- | --- |
| B001 | W001 | text | BV001 | U001 | 2026-01-01 14:00:00.000 |

### block_version

블록 확정 버전 (명시적 저장 시에만 INSERT) · Block (정체성·버전)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK |  | 블록 버전 ID (BV001 …). 콘텐츠 테이블 id와 같은 값 |
| block_id | text | — | FK | block.id | 대상 블록 |
| version | integer | — |  |  | 블록별 버전 번호 |
| changed_by | text | — |  |  | 저장 사용자 |
| changed_at | timestamptz | — |  |  | 저장 시각 |

시드 데이터:

| id | block_id | version | changed_by | changed_at |
| --- | --- | --- | --- | --- |
| BV001 | B001 | 1 | U001 | 2026-01-01 14:00:00.000 |

### block_text

텍스트 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| body | text | — |  |  | 본문 텍스트 |
| style | jsonb | O |  |  | { fontSize, color, textAlign } — v1.1 확장 컬럼 **(v1.1 확장 컬럼 (DB_SCHEMA §7.1))** |

시드 데이터:

| id | body | style |
| --- | --- | --- |
| BV001 | 안녕하세요 | `{"fontSize":16,"color":"#000000"}` |

### block_title

제목 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| content | text | — |  |  | 제목 텍스트 |
| level | integer | — |  |  | 제목 레벨 1~3 |
| style | jsonb | O |  |  | { fontSize, color, textAlign } — v1.1 확장 컬럼 |

시드 데이터: 없음 (빈 테이블로 시작)

### block_image

이미지 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| file_url | text | O |  |  | 파일·이미지 URL (없으면 NULL) |
| alt_text | text | — |  |  | 대체 텍스트 |
| width | integer | — |  |  | 너비 |
| height | integer | — |  |  | 높이 |

시드 데이터: 없음 (빈 테이블로 시작)

### block_file

파일 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| file_url | text | O |  |  | 파일·이미지 URL (없으면 NULL) |
| file_name | text | — |  |  | 파일명 |
| mime_type | text | — |  |  | MIME 타입 |
| size_bytes | bigint | — |  |  | 크기(byte) |

시드 데이터: 없음 (빈 테이블로 시작)

### block_link

링크 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| url | text | — |  |  | 링크 URL |
| title | text | — |  |  | 제목 |

시드 데이터: 없음 (빈 테이블로 시작)

### block_song

음악 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| title | text | — |  |  | 제목 |
| description | text | — |  |  | 설명 |
| reference_url | text | O |  |  | 참고 URL |
| musical_key | text | — |  |  | 조성 (C, G …) |

시드 데이터: 없음 (빈 테이블로 시작)

### block_list

목록 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| items | jsonb | — |  |  | 목록 항목 배열 |

시드 데이터: 없음 (빈 테이블로 시작)

### block_table

표 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| data | jsonb | — |  |  | 표 데이터 (2차원 배열, 첫 행은 머리글) |

시드 데이터: 없음 (빈 테이블로 시작)

### block_video

동영상 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| video_url | text | O |  |  | 영상 URL |
| metadata | jsonb | — |  |  | { title, duration | provider } |

시드 데이터: 없음 (빈 테이블로 시작)

### block_embed

임베드 콘텐츠 · Block content (버전별 콘텐츠)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK, FK | block_version.id | block_version.id와 같은 값 |
| embed_url | text | O |  |  | 임베드 URL |
| metadata | jsonb | — |  |  | { title, duration | provider } |

시드 데이터: 없음 (빈 테이블로 시작)

### block_live_state

현재 편집 중인 블록 콘텐츠 (Debounce 후 갱신) · Block live (편집 중 상태)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| block_id | text | — | PK, FK | block.id | 대상 블록 |
| base_block_version_id | text | O | FK | block_version.id | 기준 확정 버전 (신규 블록은 NULL) |
| content | jsonb | — |  |  | 현재 콘텐츠 JSON (아래 "JSON 컬럼 구조") |
| revision | integer | — |  |  | PostgreSQL에 쓰는 시점의 Redis Live 블록 revision |
| persisted_revision | integer | — |  |  | 1번부터 연속으로 저장 완료된 최대 revision |
| updated_by | text | O |  |  | 마지막 수정 사용자 |
| updated_at | timestamptz | — |  |  | 마지막 수정(승인) 시각 |
| persisted_at | timestamptz | O |  |  | 마지막 DB 저장 시각 |

시드 데이터:

| block_id | base_block_version_id | content | revision | persisted_revision | updated_by | updated_at | persisted_at |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B001 | BV001 | `{"body":"안녕하세요","style":{"fontSize":16,"color":"#000000"}}` | 0 | 0 | NULL | 2026-01-01 14:00:00.000 | 2026-01-01 14:00:00.000 |

### block_property_state

블록 속성별 revision/저장 상태 · Block live (편집 중 상태)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| block_id | text | — | PK, FK | block.id | 블록 ID |
| property_path | text | — | PK |  | content, style.fontSize, style.color … |
| revision | integer | — |  |  | 속성 변경 순번 |
| persisted_revision | integer | — |  |  | 속성 저장 순번 |
| last_fencing_token | bigint | — |  |  | 마지막으로 저장에 사용된 fencing token |
| updated_at | timestamptz | — |  |  | 마지막 변경 시각 |

시드 데이터: 없음 (빈 테이블로 시작)

### template

템플릿 정체성 · Template (정체성·버전)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK |  | 템플릿 ID (T001 …) |
| workspace_id | text | — |  |  | Workspace ID |
| name | text | — |  |  | 템플릿 이름 (편집기에서 읽기 전용) |
| current_version_id | text | O | FK | template_version.id | 현재 확정 템플릿 버전 |
| created_by | text | — |  |  | 생성 사용자 |
| created_at | timestamptz | — |  |  | 생성 시각 |

시드 데이터:

| id | workspace_id | name | current_version_id | created_by | created_at |
| --- | --- | --- | --- | --- | --- |
| T001 | W001 | 자기소개 템플릿 | TV001 | U001 | 2026-01-01 14:00:00.000 |

### template_version

템플릿 확정 버전 · Template (정체성·버전)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK |  | 템플릿 버전 ID (TV001 …) |
| template_id | text | — | FK | template.id | 템플릿 ID |
| version | integer | — |  |  | 템플릿별 버전 번호 |
| created_by | text | — |  |  | 저장 사용자 |
| created_at | timestamptz | — |  |  | 생성 시각 |
| restored_from_version_id | text | O | FK | template_version.id | 복원으로 만든 버전이면 원본 버전 |

시드 데이터:

| id | template_id | version | created_by | created_at | restored_from_version_id |
| --- | --- | --- | --- | --- | --- |
| TV001 | T001 | 1 | U001 | 2026-01-01 14:00:00.000 | NULL |

### template_element

템플릿 요소 정체성 · Template (정체성·버전)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK |  | 요소 ID (E001 …). 버전이 바뀌어도 유지 |
| template_id | text | — | FK | template.id | 템플릿 ID |
| block_id | text | — | FK | block.id | 사용하는 블록 (여러 템플릿이 같은 블록 공유 가능) |
| created_at | timestamptz | — |  |  | 생성 시각 |
| deleted_at | timestamptz | O |  |  | 삭제 시각 (복원 시 NULL) |

시드 데이터:

| id | template_id | block_id | created_at | deleted_at |
| --- | --- | --- | --- | --- |
| E001 | T001 | B001 | 2026-01-01 14:00:00.000 | NULL |

### template_version_element

확정 버전의 요소 배치 · Template (정체성·버전)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| id | text | — | PK |  | 버전별 배치 행 ID (TVE001 …) |
| template_version_id | text | — | FK | template_version.id | 템플릿 버전 |
| template_element_id | text | — | FK | template_element.id | 요소 ID |
| block_version_id | text | — | FK | block_version.id | 참조하는 블록 버전 |
| sequence | integer | — |  |  | 배치 순서 |
| render_zone | text | — |  |  | 배치 영역 (main) |
| props | jsonb | — |  |  | 위치·크기 JSON |

시드 데이터:

| id | template_version_id | template_element_id | block_version_id | sequence | render_zone | props |
| --- | --- | --- | --- | --- | --- | --- |
| TVE001 | TV001 | E001 | BV001 | 1 | main | `{"position":{"x":100,"y":100},"size":{"width":300,"height":100}}` |

### template_live_state

템플릿 구조 revision/저장 상태 · Template live (편집 중 상태)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| template_id | text | — | PK, FK | template.id | 템플릿 ID |
| revision | integer | — |  |  | 현재 템플릿 revision (배치 + 구조 변경) |
| persisted_revision | integer | — |  |  | 연속 저장 완료된 최대 revision |
| updated_by | text | O |  |  | 마지막 수정 사용자 |
| updated_at | timestamptz | — |  |  | 마지막 변경 시각 |
| persisted_at | timestamptz | O |  |  | 마지막 저장 시각 |

시드 데이터:

| template_id | revision | persisted_revision | updated_by | updated_at | persisted_at |
| --- | --- | --- | --- | --- | --- |
| T001 | 0 | 0 | NULL | 2026-01-01 14:00:00.000 | 2026-01-01 14:00:00.000 |

### template_live_element

현재 편집 중인 요소 배치 · Template live (편집 중 상태)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| template_id | text | — | PK, FK | template.id | 템플릿 ID |
| template_element_id | text | — | PK, FK | template_element.id | 요소 ID |
| block_id | text | — | FK | block.id | 블록 ID |
| sequence | integer | — |  |  | 현재 순서 |
| render_zone | text | — |  |  | 배치 영역 |
| props | jsonb | — |  |  | 현재 위치·크기 JSON |
| updated_at | timestamptz | — |  |  | 수정 시각 |

시드 데이터:

| template_id | template_element_id | block_id | sequence | render_zone | props | updated_at |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | E001 | B001 | 1 | main | `{"position":{"x":100,"y":100},"size":{"width":300,"height":100}}` | 2026-01-01 14:00:00.000 |

### template_element_property_state

요소 배치 속성별 revision/저장 상태 · Template live (편집 중 상태)

| 컬럼 | 타입 | NULL | 키 | 참조 | 설명 |
| --- | --- | --- | --- | --- | --- |
| template_id | text | — | PK, FK | template.id | 템플릿 ID |
| template_element_id | text | — | PK, FK | template_element.id | 요소 ID |
| property_path | text | — | PK |  | position.x, position.y, size.width, size.height |
| revision | integer | — |  |  | 속성 변경 순번 |
| persisted_revision | integer | — |  |  | 속성 저장 순번 |
| last_fencing_token | bigint | — |  |  | 마지막으로 저장에 사용된 fencing token |
| updated_at | timestamptz | — |  |  | 변경 시각 |

시드 데이터: 없음 (빈 테이블로 시작)

## 5. 작업별 변경 테이블 (CRUD 매트릭스)

I = INSERT, U = UPDATE, D = DELETE. 빈 칸은 변경 없음.

| 테이블 | Debounce flush | 요소 추가 | 요소 삭제 | 삭제 복원 (Undo) | 순서 변경 | 명시적 저장 | 버전 복원 | Fixture K |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `block` |  | I |  |  |  | U (current_version_id) |  |  |
| `block_version` |  |  |  |  |  | I (변경된 블록만) |  |  |
| `block_<kind> (콘텐츠 10개)` |  |  |  |  |  | I (변경된 블록만) |  |  |
| `block_live_state` | U | I |  |  |  | U (base_block_version_id) |  |  |
| `block_property_state` | I / U |  |  |  |  |  |  |  |
| `template` |  |  |  |  |  | U (current_version_id) | U (current_version_id) | I |
| `template_version` |  |  |  |  |  | I | I (restored_from_version_id) | I |
| `template_element` |  | I | U (deleted_at) | U (deleted_at = NULL) |  |  | U (deleted_at) | I |
| `template_version_element` |  |  |  |  |  | I (전체 구성) | I (원본 복사) | I |
| `template_live_state` | U | U | U | U | U |  | U | I |
| `template_live_element` | U (props) | I | D (+ 다른 요소 sequence U) | I (+ sequence U) | U (sequence) |  | I / U / D | I |
| `template_element_property_state` | I / U |  |  |  |  |  |  |  |

- 명시적 저장과 버전 복원은 트랜잭션 앞단에서 대기 중인 Debounce flush도 함께 실행합니다 (Debounce flush 열의 변경 포함).
- 버전 복원은 `block_live_state`와 `block.current_version_id`를 바꾸지 않습니다 (공유 블록 보호).
- 요소 삭제는 블록(`block`, `block_live_state`)과 과거 버전 행을 지우지 않습니다.
- 모든 쓰기는 하나의 트랜잭션으로 처리되며, 실패하면 전체 롤백됩니다.

## 6. JSON 컬럼 구조

`block_live_state.content`는 블록 종류별 콘텐츠 테이블의 컬럼(id 제외)과 같은 키를 가집니다. 명시적 저장 시 이 값이 그대로 콘텐츠 행이 됩니다.

| kind | 콘텐츠 테이블 | content 키 | property_path (Lock·property_state 단위) |
| --- | --- | --- | --- |
| text | `block_text` | body, style | content(→body), style.fontSize, style.color, style.textAlign |
| title | `block_title` | content, level, style | content, level, style.color, style.textAlign |
| image | `block_image` | file_url, alt_text, width, height | file_url, alt_text, width, height |
| file | `block_file` | file_url, file_name, mime_type, size_bytes | file_url, file_name, mime_type, size_bytes |
| link | `block_link` | url, title | url, title |
| song | `block_song` | title, description, reference_url, musical_key | title, description, reference_url, musical_key |
| list | `block_list` | items | items |
| table | `block_table` | data | data |
| video | `block_video` | video_url, metadata | video_url, metadata |
| embed | `block_embed` | embed_url, metadata | embed_url, metadata |

배치 JSON (`template_live_element.props`, `template_version_element.props`):

| 경로 | 의미 | property_path |
| --- | --- | --- |
| position.x / position.y | 페이지 좌표 (800 × 1040) | position.x, position.y |
| size.width / size.height | 크기 | size.width, size.height |

## 7. 시나리오 K Fixture (T002)

Console의 "시나리오 K: T002 추가" 버튼 또는 시나리오 실행기(K)가 추가하는 데이터입니다. FIXTURE 이벤트로 기록됩니다.

| 테이블 | 행 |
| --- | --- |
| `template` | `{"id":"T002","workspace_id":"W001","name":"경력 템플릿","current_version_id":"TV101","created_by":"U001","created_at":"2026-01-01 14:00:00.000"}` |
| `template_version` | `{"id":"TV101","template_id":"T002","version":1,"created_by":"U001","created_at":"2026-01-01 14:00:00.000","restored_from_version_id":null}` |
| `template_element` | `{"id":"E101","template_id":"T002","block_id":"B001","created_at":"2026-01-01 14:00:00.000","deleted_at":null}` |
| `template_version_element` | `{"id":"TVE101","template_version_id":"TV101","template_element_id":"E101","block_version_id":"BV001","sequence":1,"render_zone":"main","props":{"position":{"x":40,"y":40},"size":{"width":200,"height":80}}}` |
| `template_live_state` | `{"template_id":"T002","revision":0,"persisted_revision":0,"updated_by":null,"updated_at":"2026-01-01 14:00:00.000","persisted_at":"2026-01-01 14:00:00.000"}` |
| `template_live_element` | `{"template_id":"T002","template_element_id":"E101","block_id":"B001","sequence":1,"render_zone":"main","props":{"position":{"x":40,"y":40},"size":{"width":200,"height":80}},"updated_at":"2026-01-01 14:00:00.000"}` |

## 8. 함께 쓰는 Redis 키 (참고)

PostgreSQL보다 앞서는 실시간 상태는 Redis(Mock)에 있습니다. 화면 오른쪽 **Redis** 탭에서 볼 수 있습니다.

| 키 | 자료형 | 내용 |
| --- | --- | --- |
| `live:block:{blockId}` | string(JSON) | 승인된 최신 블록 콘텐츠, revision, 속성별 revision, 미저장 revision 목록 |
| `live:template:{templateId}` | string(JSON) | 요소 배치, revision, structureRevision, 미저장 revision 목록 |
| `lock:block:{blockId}:{path}` | string(JSON, TTL 10s) | 속성 Lock (userId, connectionId, lockToken, fencingToken, expiresAt) |
| `lock:template:{templateId}:element:{elementId}:{path}` | string(JSON, TTL 10s) | 배치 속성 Lock |
| `fence:{lockKey}` | string(number) | Fencing Token (INCR) |
| `debounce:block:{blockId}:{path}` / `debounce:template:{tid}:element:{eid}:{path}` | string(JSON) | 저장 예약 (dueAt, status WAITING/FLUSHING/FAILED/DEAD, attempt, retryCount, nextRetryAt) |
| `presence:template:{templateId}` | hash + Pub/Sub 채널 | 접속자별 상태·선택·커서 |
| `stream:block:{id}` / `stream:template:{id}` | stream | 승인된 변경 기록 (재연결 따라잡기) |
| `seq:stream` | string(number) | 전역 순번 (INCR) |
