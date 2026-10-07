# 사람용 안내서를 네 가지 질문으로 통합

상태: 완료된 2026-10-03 문서 개편의 역사적 기록. 2026-10-07 사용자 요청으로 중복 안내·ERD·복제 스냅샷은 삭제했다. 현재 사람용 문서는 루트 README의 Reader guides에 있는 5개뿐이며 진행 중 작업은 backend-v1-team-ready.md를 참조한다. 아래 당시 Outcomes를 현재 지시로 사용하지 않는다.

## Purpose
비개발자와 협업 개발자가 파일을 찾아다니지 않고 서비스 흐름, 구현 방식, 전체 DB 필드, 인증/권한 이유를 이해한다.

## Scope
문서만 변경한다. 기존 architecture/schema를 개선하고 service-flows/auth-flows를 추가한다. README는 유일한 입구로 축소하고 ontology/meeting 중복 본문은 안내 링크로 대체한다. assurance/manifest/Design Lock/ExecPlan은 근거 자료로 유지한다. 악보 포함 최종 콘티 PDF의 미구현 상태를 명확히 기록하되 기능 구현/새 제품 정책은 하지 않는다.

## Relevant Design
PROJECT_DESIGN.md §§1–4 사용자·도메인·Capability, §§6–8 아키텍처·인가·동시성, §10 검증, §12 구현 범위. 사용자 후속 설명: 콘티 최종 파일에는 악보 페이지도 필요함; 현 renderer는 파일명만 출력함.

## Progress
- [x] 설계/현재 상태/기존 문서/실제 인증·인가·다운로드 코드 확인
- [x] 네 안내서 작성, 기존 안내 중복 축소
- [x] 25개 테이블/166개 필드 누락, 링크, 코드 근거, 표현 검토
- [x] 프로젝트 미완료 사항/진행 기록 갱신; 검증한 문서를 scoped local checkpoint로 기록

## Plan
1. 서비스 전체 흐름은 사용자 행동/결과/오류를 중심으로 작성한다.
2. 구현 안내는 feature 구조, 데이터 모델 이유, 개발 Harness, 안전성·외부 실패·검증 방법을 설명한다.
3. DB 안내는 실제 컬럼을 보존하며 쉬운 의미/사용 예/필드 연결을 추가한다.
4. 인증 안내는 가입→세션→초대→문서→파일→계정 종료 순서로 검사 위치와 이유를 설명한다.
5. README/과거 설명 문서는 새 문서로 연결하며 별도 정책 원본으로 만들지 않는다.

## Verification
문서 전용 검증: manifest와 컬럼 목록 일치, 상대 링크와 anchor 대상, 코드 fence, git diff --check, 주요 설명과 코드 대조. 코드/DDL 불변이므로 구현 Milestone full gate를 새로 통과했다고 주장하지 않는다. 최근 2026-10-01 clean gate 89/15는 역사적 결과로 표시한다.

2026-10-03: Ruby 대조로 25 table sections/166 field rows의 순서·타입·NULL/자동 생성 및 설명 존재, 37 실제 FK 연결, 23 CHECK 이름 일치 확인. 68개 local 링크 대상 존재, fence 균형, whitespace/네 주요 문서 Mermaid 없음 확인. 코드 링크의 주요 검사와 권한 재검사 경로 수동 대조. git diff --check 통과. 코드·DDL·manifest·의존성 변경 없음; gradlew gate 재실행 안 함. Anchor 링크를 새로 만들지 않음.

## Decision Log
기존 architecture/schema 경로를 재사용해 상세 원본이 두 벌 생기지 않게 한다. ontology 개념은 사용/구현/권한 문서로 흡수한다. 기술 감사 증거는 assurance에만 유지하고 읽기 필수 목록에서 제외한다.

## Surprises / Discoveries
기존 schema에는 stale V11 artifact NULL 한계 문구와 필수 item.song_id를 선택적이라고 설명한 오류가 남아 있다. 실제 manifest/DDL과 V11에 맞게 정정한다. 브라우저 다운로드 endpoint는 있지만 실제 악보 페이지 합성은 없다.

## Failures / Recovery
없음.

## Unresolved High-impact Decisions
PROJECT.md의 정책/운영 질문은 유지한다. 악보 페이지 합성의 세부 레이아웃/재배열 정책을 이번 문서 작업에서 발명하지 않는다.

## Handoff State
네 문서와 README 개편 완료. 기존 ontology/meeting은 이동 안내이며 assurance는 개발/감사 부록이다. PROJECT/Core ExecPlan에 G-08 미충족을 기록했다. 다음 개발 작업은 별도 ExecPlan에서 실제 악보 포함 PDF와 브라우저 최종 다운로드 요구를 구현·검증하는 것; 이번 문서 요청을 기능 구현으로 확대하지 않는다.

## Outcomes
service-flows는 한 예배 준비 사례로 전체 기능과 실패/계정 종료 흐름을 설명한다. architecture는 구조·모델 분리·Harness·동시성·외부 실패·협업 경계를 설명한다. schema는 모든 실제 필드와 사용 사례/연결을 설명하며 stale NULL 한계와 필수 song_id 설명 오류를 수정했다. auth-flows는 사용자 행동에 따라 인증·권한 검사 위치와 이유, 보장 차이를 설명한다. 모든 자료는 현재 구현/후속 요구/운영 미검증을 구분하고 Design Lock을 바꾸지 않는다.
