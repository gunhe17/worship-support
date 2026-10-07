# V1 Backend의 확정 요구를 완성하고 검증된 작업 브랜치로 인계

## Purpose

GitHub 공유 전에 확정된 V1 Backend 요구의 미구현 부분을 완료하고, 전체 아키텍처·스키마·코드의 중요한 결함을 수정한다. 결과물은 재현 가능한 검증, 정확한 API/스키마 설명, 공유 저장소 이력을 보존하는 작업 브랜치다. 사용자 확정 브랜치는 auth-workspace-v1, 그 브랜치의 backend/ 배치와 팀 공개용 일반 push를 승인했다. main 변경/병합/force push/자동 PR는 금지한다. 테이블 수 감소나 계층 추가 자체를 목표로 삼지 않는다.

## Scope

포함: 현재 미커밋 코드 진단, 사용자 검토 결정 반영, 전체 25개 기존 테이블/제약/조회 검토, 인증·인가·트랜잭션·외부 작업 점검, 실제 악보 포함 PDF, 단일 ADMIN/이전·확인 후 MANAGER 승계·Workspace 종료, 필요한 권한 조회 계약, Backend 충돌 계약, 문서 정리, 전체 gate, 안전한 브랜치 반입 준비.

제외: Agent Runtime/LLM orchestration/구체 승인 프로토콜, 타 개발자의 프론트·AI 코드 대행, 자동 병합/CRDT/OT, 실제 provider 부작용, 운영 DB 작업, 임의 보존 기간·영구 삭제, 모델 강제 통일, 근거 없는 대규모 재설계. Figma는 브랜치 커밋 이후 별도 작업이다.

2026-10-07 사용자 후속 요청으로 구현을 시작했다. 원격 기존 문서·코드는 설계/구현 참고 대상이 아니며 원격 파일·이력은 보존한다. 브랜치 auth-workspace-v1 / 해당 backend/ 배치 / 팀 공개를 위한 일반 push는 이후 사용자 승인을 받았다. 검증된 Milestone마다 local checkpoint를 남기며 main 변경/병합/force push/자동 PR는 하지 않는다.

사용자 후속 실행 지시: 1~8번 감사·구현·검증·문서 정리는 자율 진행하고 반드시 필요한 제품/보안 결정·안전하게 해결할 수 없는 blocker만 질문한다. **9번 공유 저장소 브랜치 반입부터, 이후 Figma 작업은 시작 전 반드시 사용자와 소통한다.** 현재 이 경계에 도달하지 않았으며 자동 branch/remote/push/Figma 작업을 하지 않는다.

## Relevant Design

- `PROJECT_DESIGN.md` §3.1/§4.3: 신원·탈퇴·세션과 업무 자료 보존.
- §3.2–3.3/§4.1–4.2: tenant, ACTIVE Membership, 두 역할 축, 마지막 ADMIN/MANAGER, ADMIN의 제한 문서 우회 금지.
- §3.4–3.9: 사용 맥락·구조형 SongForm·Score 저장 실패·Reference·불변 Export.
- §6–7: 기능별 Modular Monolith, 인증/인가 경계, Flyway, 외부 port, 짧은 transaction, 감사·명령 계약.
- §10/§12: critical-risk 검증과 Design Lock. 기존 보장은 유지하며 사용자 확정 정책만 명시적으로 수정한다.
- P-01–P-06 사용자 입력은 Design/PROJECT에 반영했다. 삭제한 입력 원문은 Git b7e224d에서 복구 가능하며 현재 판단은 Design을 사용한다. P-04 배치는 임시 기준이다.
- `PROJECT.md` D-02–D-05, G-02/G-08: 현재 미결정과 결함. 기존 Core M0–7의 역사적 완료는 취소하지 않고 후속 작업을 분리한다.

## Progress

- [x] 2026-10-07: AGENTS/PLANS/PROJECT, 기존 Core 기록, 검토 결정 및 관련 Design 조항 확인.
- [x] 로컬 상태와 공유 저장소 main의 접근·파일 목록·기획 확인.
- [x] 후속 ExecPlan 작성 후 사용자 요청으로 M0/M1 및 M2 초기 보안 수정 진행. branch/remote 변경은 없음.
- [x] M0: 기존 변경은 배치/주석 정리로 확인·보존; 현재 check 101/16 성공.
- [x] M1: P-01–P-06 원칙을 Design/PROJECT에 반영; 미정 표시/통지/복구는 D-04–D-07로 분리. check 성공.
- [x] M2: 현재 production Java 90개와 V1–V16/26개 테이블 검토, 정확성 결함 수정·회귀 완료. 구조 최적화 후보는 사용자 논의 뒤 적용하며 운영 성능/독립 보안 감사는 별도.
  - [x] 초기 보안 checkpoint: Score 다운로드의 저장소 I/O 중 소속 종료/탈퇴 재현·수정; targeted 8개와 full check 103/16 성공.
- [x] M3: 실제 악보 포함 PDF 완료; targeted 22개/전체 check·시각 확인·문서 정리.
- [x] M4: 책임 지정·구성원 식별·권한 화면 계약 완료.
  - [x] M4a: V13 단일 ADMIN backstop, V14 member_notice, ADMIN 이전/본인 알림 계약. targeted·upgrade·HTTP·full check 성공.
  - [x] M4b: 확인 후 유일 MANAGER 승계, 표시 이름/권한 조회, MANAGER 지정 알림 연결. targeted 및 전체 gate 통과.
- [x] M5: 구성원 수와 무관한 ADMIN의 Workspace 종료 완료(D-08이 기존 P-01 제한 대체).
  - [x] V16 ACTIVE/TERMINATED, 영향 확인·소속/초대/알림 원자성, 경합/rollback/late I/O/HTTP/upgrade와 전체 check 성공(3m22s).
- [x] M6: 두 브라우저 HTTP의 409/무변경/명시적 수동 재저장/권한 회수 403/로그아웃 401 계약 검증. 실제 화면 초안 보존은 프론트 통합 미확인.
- [x] M7: 네 안내서/ERD/manifest/API 설명을 V16과 일치, 과거 스냅샷·사용자 입력 보존/날짜 표시, 로컬 실행 안내·compose 검증. 팀 도구 설정이 없으므로 실제 공통 Harness 자동 로딩은 미적용으로 명시.
- [x] M8: clean check/bootJar 실제 실행, 135/16 전부 통과, 빈 로컬 DB의 V16/validate/배포 JAR 시작과 보안 응답 확인, 생성 PDF 재확인·반입 파일/이력 검사 완료.
- [x] M7b: 사람용5개만 유지. 중복 자료8개와 ERD 생성기 삭제·고유 결론 통합·52개 링크/fence/필드명 대조·check(7s, UP-TO-DATE) 완료.
- [x] M7c: 5개 문서의 ASCII 도식을 인라인 SVG7개로 교체, 전부 렌더링 확인 및 링크37개/26테이블177필드/XML 대조·check(6s, UP-TO-DATE) 완료. 별도 읽을 문서/ERD viewer/생성기 추가 없음.
- [ ] M9: 공유 main 기반 브랜치에 안전하게 반입·commit·재검증.

## Plan

### M0 — 기존 작업을 보존하고 현재 baseline 확보

3개 dirty Java 파일의 diff를 의미 변경/정리로 구분하고 의도를 코드와 테스트로 확인한다. 사용자 변경을 임의 revert하거나 전부 stage하지 않는다. Git 상태·현재 commit·diff와 환경을 기록하고 Java/Docker/MySQL Testcontainers를 확인한다. 로컬 히스토리와 공유 main의 공통 조상 여부는 별도 fetch/clone 단계에서 확인하며, 서로 다른 이력을 가정해 무작정 merge하지 않는다.

증거: 현재 작업 상태에서 `./gradlew check` 실행 결과. 실패는 환경/기존 결함/변경 회귀로 구분하고 수정 후 재검증. 과거 101개 성공 기록을 현재 증거로 사용하지 않음. 필요한 로컬 파일과 비밀값은 추적 대상에서 제외.

### M1 — 사용자 결정과 원본 설계 맞추기

P-01 종료 예외, P-02 수락 없는 지정과 통지, P-03 Reference 등록/선택 교체, P-04 악보 전체 페이지 임시 구성, P-05 공동 자료 보존, P-06 화면 내 초안 보존의 범위를 Design/PROJECT에 구분 반영한다. 이미 결정한 내용을 재승인받지 않는다. 종료 ≠ 영구 삭제, 지정 ≠ 다른 ADMIN 강등, 화면 보존 ≠ 브라우저 종료 후 복구를 명확히 한다.

미정 결정은 아래 목록으로 관리한다. 보존 기간은 운영 전 정책이며 자동 삭제 구현을 막지만 독립적인 PDF 구현을 막지 않는다. 실제 프론트/AI 계약을 받기 전 임의 profile·알림 플랫폼·권한 서버를 만들지 않는다.

증거: 정책별 원본/코드/API/테스트 대응표, 기존 불변식과의 모순 없음. `./gradlew check`.

### M2 — 전체 구조와 스키마를 실제 흐름으로 감사

전체 production Java와 해당 테스트를 기능별로 확인한다. 25개 테이블 각각의 사용 경로, 필드 의미/NULL/길이/타입, 복합 tenant FK, unique/check/index, 생명주기·삭제 관계, migration과 JPA 정합성을 대조한다. 추가/유지/통합 후보를 변경 이득·위험과 함께 판단한다. 모든 테이블이 필수라고 미리 결론내리지 않는다.

코드에서는 권한 경계, DTO 검증/오류 계약, 잠금 순서·원자성, 문서 version, lifecycle 순환, 교차 Store 변경, 조회 수, 외부 호출 transaction 범위, retry/idempotency/attempt fencing, secret/audit 노출을 확인한다. 성능은 작은/예상 규모 데이터의 SQL·응답 크기·잠금 대기로 평가한다. 임의 운영 목표나 테이블 수를 지표로 삼지 않는다.

위반·정확성 결함은 먼저 수정한다. 일반 리팩터링은 자율 수행하되 구조/테이블 최적화 후보는 사용자와 논의 후 적용한다는 기존 요청을 유지한다. DDL 변경은 새 Flyway migration; 이미 적용된 V1–V12 재작성 금지.

증거: 발견별 재현/영향/수정 또는 보류 이유. 정상뿐 아니라 거부·경합·rollback 테스트 확인. 중요한 회귀는 가능한 경우 수정 전 실패를 입증하고 `./gradlew check`.

### M3 — 악보 포함 최종 콘티 PDF

현재 파일 메타데이터만 출력하는 renderer를 실제 PDF/PNG/JPEG 페이지를 포함하도록 보완한다. 곡 순서/안내·송폼/선택 악보의 전체 페이지를 P-04 임시 기준으로 구성한다. 다운로드 API를 재사용하고 Backend가 브라우저 다운로드에 필요한 응답을 제공하는지 확인한다.

악보 입력의 tenant·고정 식별/파일 불변성·수명을 확인하고, 재시도에서도 같은 입력을 사용한다. 무조건 전체 파일 복제하지 않는다. 렌더링/저장소 호출은 장기 DB transaction 밖에서 수행한다. 기존 EDIT 생성/READ 다운로드와 완료 직전 인가, hash·보상·attempt fencing 유지. 총 파일 크기/페이지/메모리/처리 시간 제한은 안전한 설정과 실패 계약으로 설계하며 사용자 정책이 달라지는 제한은 논의한다.

증거: 혼합 형식/회전/다중 페이지/한글을 실제 생성 파일로 열어 가독성·누락·순서를 확인. 손상·암호화·누락 입력, 외부 실패·보상, source 변경 후 retry, 권한 회수/경합 검증. `ExportIntegrationTest`, `ScoreReferenceIntegrationTest`, HTTP 계약과 `./gradlew check`.

### M4 — 사람이 사용할 수 있는 책임 지정 계약

단일 ADMIN/이전으로 기존 승격 계약을 대체하고 Document Grant 지정을 재사용한다. 기존 복수 ADMIN 데이터가 있으면 임의 생존자를 고르지 않고 migration을 안전하게 중단/보고한다. 강제 MEMBER 제거 시 유일 MANAGER 영향 확인·ADMIN 승계·소속 종료를 원자적으로 처리한다. 자발적 leave/withdraw는 먼저 책임 이전을 요구한다. 실제 화면에 필요한 최소 구성원 식별, 본인 허용 작업, MANAGE 권한하의 Grant 목록, 본인의 탈퇴를 막는 책임 조회를 설계한다. 타인의 이메일·권한 없는 RESTRICTED 제목을 공개하지 않고 영향 수만 안내한다. 확인 이후 영향 범위 변경은 재확인을 요구한다.

통지는 서비스 내 알림으로 구현하고 역할 변경/알림 기록을 같은 DB transaction에서 처리한다. 이메일과 범용 큐·알림 플랫폼은 추가하지 않는다. 종료 알림의 본인 ENDED 조회 예외는 M5에서 제한적으로 구현한다.

증거: 두 권한 축을 분리하여 수락 없는 지정 가능, 역할별 조회 거부, 다른 tenant/ENDED 대상 거부, 마지막 책임 이전 후 leave/withdraw, 통지 실패 선택 정책 검증. OpenAPI/DTO와 `./gradlew check`.

### M5 — 유일 ADMIN의 공간 종료

사용자 승인 D-08에 따라 구성원 수와 관계없이 유일 ADMIN의 종료를 구현한다. ACTIVE / TERMINATED 상태, 영향 확인/이름 재입력 및 실행 전 재검사를 적용하고, 종료와 모든 ACTIVE 소속 종료·초대 무효화·종료 알림 기록을 하나의 transaction에서 처리한다. DB commit이 종료 확정 시점이다. 활성 공간의 일반 탈퇴 책임자 보호와 다중 공간 계정 탈퇴의 all-or-nothing도 보존한다.

종료 뒤 목록/본문/Score/Export/초대/외부 명령의 접근과 확정을 차단한다. 종료 당시 구성원의 본인 계정에 최소 알림/상태만 제공하고 무관한 사용자에게 공간 존재/종료 여부를 공개하지 않는다. 실행 중 외부 작업은 provider rollback을 보장하지 않고 최종 상태·실패를 관찰 가능하게 유지한다. 공동 자료를 즉시 삭제하지 않는다. V1 사용자용 복구 없음/운영 복구 미보장이다.

증거: 단독/다수 구성원 종료 성공, MEMBER 종료 거부, 확인 후 변경 재확인, 종료/초대 수락 및 권한 이전 경쟁, rollback, 기존 세션/URL/초대/늦은 Export 완료 차단, 종료 알림 수신자 격리. 새/기존 DB migration과 `./gradlew check`.

### M6 — 충돌과 권한 상실의 계약 완성

Backend의 stale version 거부·원자성·구분 가능한 오류를 검증하고 최신본을 권한 범위 안에서 조회하도록 계약을 정리한다. expectedVersion만 바꿔 초안을 자동 재전송하지 않는 프론트 요구를 인계한다. 401/403과 version conflict를 구분한다.

화면 초안 유지/최신본 비교/복사/수동 재저장은 프론트 담당 구현이다. 프론트 코드가 없다면 Backend 계약 테스트까지만 완료 표시하고 사용자 흐름 통합은 미확인으로 남긴다. 대체 Backend 테스트를 프론트 완료 증거로 삼지 않는다.

증거: 두 사용자 수정과 늦은 저장 거부, 기존 데이터 유지, 재조회 권한 회수, 오류 HTTP/DTO 검증. 프론트가 제공되면 두 창에서 초안 보존·수동 반영 확인. `./gradlew check`.

### M7 — 협업 가능한 자료와 Harness

사람용 네 문서/ERD/manifest/OpenAPI를 실제 최종 스키마·API와 맞춘다. 리뷰 스냅샷은 역사적 자료로 표시하고 정책 원본으로 승격하지 않는다. 불필요 중복은 제거하되 검증 역사·유용한 규칙을 손실시키지 않는다. 삭제는 정확한 대상과 Git 복구 가능성을 확인한다.

팀의 실제 도구 설정을 받은 뒤 공통 정책·검증과 얇은 도구별 진입 파일을 구성한다. 해당 도구 공식 지침/skill을 먼저 확인하며 자동 규칙 로딩을 가정하지 않는다. 도구 설정이 없으면 현재 규칙과 제안만 정리한다. root AGENTS가 가리키는 완료 Core 계획을 단독 이동하지 않는다.

증거: 문서 링크·정책 중복/충돌·API/DDL 일치 확인, 신규 담당자가 환경 변수 이름/가짜 provider/local 실행/테스트를 재현할 수 있음. 실제 도구 공통화는 읽기·작업 범위·gate 실행 실험으로 확인. `./gradlew check`.

### M8 — 업로드 전 최종 검증

tenant/permission matrix/lifecycle/concurrency/migration/external failure/핵심 HTTP E2E를 최종 코드에서 실행한다. 테스트 기대값을 정책과 대조하고 denied 요청의 DB/외부 무변경, rollback/경합을 확인한다. 깨끗한 DB와 직전 schema upgrade를 모두 확인한다. `.gitignore`뿐 아니라 반입 파일과 필요한 경우 이력의 비밀값·로컬 파일·생성물도 검사한다.

증거: `./gradlew clean check`와 `./gradlew bootJar`, 실제 악보 PDF 확인, 정확한 commit/환경/실행 결과. skip/환경 실패를 통과로 표시하지 않는다. 미정 운영 정책·실 provider/프론트/AI 검증은 별도 표시하며 V1 Backend 미구현을 남겨놓고 전체 완료라고 주장하지 않는다.

### M9 — 공유 저장소 기반 브랜치 반입과 인계

사용자와 최종 브랜치명을 정한 뒤 최신 upstream main과 이름 충돌을 확인한다. 별도 안전한 checkout에서 공유 main 기반 작업 브랜치를 준비하고 검증된 Backend를 명시적 파일 목록으로 반입한다. 현재 로컬 main을 원격 main에 덮어쓰거나 unrelated histories를 무작정 합치지 않는다. 기존 파일과 이력은 보존하되 기존 문서·코드를 설계/구현의 참고 대상으로 사용하지 않는다. .gitignore 보완은 안전한 파일 반입을 위한 기술적 처리로 한정한다. Backend 하위 경로 등 배치 원칙은 팀의 저장소 계획과 맞춘다.

local checkpoint 이력과 기존 작업은 보존한다. 기존 문서를 임의 삭제하지 않고 역사적 기획/현재 V1 원본의 관계를 표시한다. 실제 저장소 경로에서 clean gate와 실행 안내를 재검증한 뒤 local commit한다. 원격 push/PR는 명시 요청이 있을 때만 수행하고 force push하지 않는다. 브랜치 커밋 이후 스키마가 확정되면 Figma를 별도 진행한다.

증거: shared main이 작업 브랜치의 조상, 기존 원격 파일 보존, 의도한 diff만 포함, 새 checkout에서 `./gradlew clean check` 성공, 브랜치/commit/제한사항 인계. 원격 게시되지 않았다면 명시한다.

## Verification

M9 반입 gate 완료: `/private/tmp/worship-team-import.xghq94/repository/backend`에서 `./gradlew clean check bootJar --no-daemon` 성공(3m35s,6 tasks 실제 실행·clean은 빈 신규 경로에서 UP-TO-DATE). XML135 tests/16 suites, failures/errors/skips0. JAR SHA256 d05e8f0d360955d73f1e02fb126d1a9bfd8e24b64cb77ca89b079a5da5a975e0로 기존 검증본과 동일. 전체159파일 source bytes 일치, 상대 링크56개 정상, 제한적 secret 패턴 후보0. main 조상/기존 root파일 무변경 및 backend만stage 확인. Gradle wrapper Windows bat의 원래 CRLF를 보존하여 cr-at-eol 허용 whitespace 검사를 통과했다. main=c876286 재확인 및 원격 작업브랜치 미존재 확인. 다음은 local commit/명시 ref push/원격SHA 확인이며 아직 게시 완료로 표시하지 않는다.

M9 진행(2026-10-07): 사용자 진행 승인 후 HTTPS ls-remote에서 공유 main=c876286cf1681f0c67bd7e1fdda4ffd8f2265657, auth-workspace-v1 미존재 확인. 명시 ref push --dry-run 인증 성공(원격 ref 변경 없음). 별도 checkout `/private/tmp/worship-team-import.xghq94/repository`에 공유 main을 clone했다. 기존 파일은 경로 목록만 확인했고 설계/구현에 참고하지 않는다. root에는 .gitignore/docs만 있으며 backend/ 충돌 없음. Java dirty3은 블록 주석/whitespace 제거 비교에서 코드 동일. 현재 검증한 bytes를 공유 backend/에 복사하여 함께 검증·게시하며 원본 파일은 수정/stage하지 않는다. root 기존파일 무변경, clean gate, 명시 브랜치 push 후 원격 SHA 확인을 진행한다.

M7c 완료: 아키텍처/사용 흐름/권한 경계/외부 transaction/Harness/핵심 테이블/저장 경쟁의 벡터 도표7개를 기존5개 Markdown에 삽입했다. Quick Look으로 모두 렌더링 확인했고 수정한 화살표·표기는 재렌더링하여 확인했다. SVG XML 정상, reader 상대 링크37개 정상, ASCII text도식0, manifest26테이블/177필드명 수록 및 whitespace 정상. 핵심 관계도는6개 테이블 요약이며 전체 사전을 유지한다. member_notice를26번으로 정렬하고 정책 참고서가 Design 원본을 대체하지 않게 수정했다. `./gradlew check --no-daemon` 성공(6s, 4 tasks UP-TO-DATE)은 문서 gate이며 새 테스트 실행 증거가 아니다. 이전 M8 clean135/16 증거를 보존한다. 코드/DDL/제품 정책 변경 없음. 사용자 dirty3 SHA 불변·stage 제외. PNG 검토 산출물은 ignored build/reports/doc-visuals이며 독자 문서로 추가하지 않는다. 모든 Markdown 뷰어에서 동일하게 표시됨을 검증했다는 주장은 하지 않는다.

M7b 완료: docs 폴더에 사람용 Markdown 정확히5개와 기계 검증용 manifest만 남았다. 기존 문서/원본/계획 전체 52개 상대 링크와 fence 균형, 26개 테이블/177개 컬럼 이름 수록, git diff whitespace 통과. 런타임 코드·DDL·manifest·OpenAPI는 변경하지 않았고 사용자 dirty3 SHA-256 불변. `./gradlew check --no-daemon` 성공(7s, 4 tasks UP-TO-DATE)은 문서 gate이며 새 테스트 실행으로 주장하지 않는다. 이전 M8 clean135/16+배포 startup는 동일 Backend 기준 증거로 보존한다. 삭제 원문은 Git b7e224d에서 복구 가능하며 새 archive/이동 사본/대체 보고서는 만들지 않았다.

M8 최종: `./gradlew clean check bootJar --no-daemon` BUILD SUCCESSFUL **4m22s**, 7 tasks 모두 실제 실행. XML **135 tests / 16 suites, failures/errors/skips 모두 0**. 새 DB migration 및 기존 DB upgrade·불법 legacy 거부, tenant/HTTP permission matrix, 단일 ADMIN/마지막 MANAGER·재가입/종료·withdraw all-or-nothing, 버전/책임/종료 경쟁, 알림 INSERT 실패 rollback, 외부 render/storage/OAuth/Playlist 실패·늦은 완료 fencing, HTTP 업무 E2E를 같은 gate에서 실행했다. `build/reports/export-score/preview.png`를 다시 열어 8페이지의 안내/실제 PDF 페이지/PNG/JPEG 순서·내용을 확인했다(테스트용 합성 자료이며 실제 사용자의 악보 UI 승인 아님).

배포 파일: `build/libs/worship-core-0.1.0-SNAPSHOT.jar`, SHA-256 `d05e8f0d360955d73f1e02fb126d1a9bfd8e24b64cb77ca89b079a5da5a975e0`. 별도 compose project `worship-v1-m8-verification`의 빈 MySQL 8.4에서 16개 migration 적용/현재 version16·27 physical tables(업무26+Flyway1)·177 업무 columns, Hibernate validate, Java25 packaged JAR startup(16.964s)을 확인했다. HTTP csrf200/세션 Secure·HttpOnly·Lax/미인증 profile401 AUTHENTICATION_REQUIRED/CSRF없는변경403, workspace 행0 확인. 시작한 JAR는 TERM graceful shutdown, 해당 DB는 stop(삭제/volume 정리 안 함)했고 다른 환경을 건드리지 않았다. 실제 SMTP/Google/YouTube/운영 저장소 호출 없음.

반입 검사: 추적161파일에 로컬 `.env`/build/.local/.gradle 생성물 없음, 주요 private-key/token 패턴 후보0, 로컬34개 commit 같은 패턴 후보0. 완전한 비밀값/개인정보 감사로 확대하지 않는다. 사용자 dirty3 SHA-256 불변/커밋 제외, remote 없음/push 없음. Gradle10 호환 deprecation 및 테스트의 deprecated API 경고는 향후 업그레이드 항목이며 현재9.7.1 gate 실패가 아니다.

M7 완료: `node scripts/render-schema-erd.mjs --check`로 26개 테이블/177개 필드/39 FK SVG·HTML 생성 정합성 통과. 현재 설명 자료의 상대 링크 96개 존재 및 26개 테이블/177개 컬럼 이름의 schema.md 수록 대조 통과(의미 전체의 자동 증명은 아님). compose config 검증, diff whitespace 통과. 브라우저 스킬의 Node REPL 실행 도구는 제공되지 않아 이 경로 사용을 중단하고, 사용자 세션/프로필과 분리된 headless Chrome으로 local HTML만 확인했다. 26/177/39 DOM, Grant 두 복합 FK 설명·연결 강조, 68% 확대/전체 맞춤 초기화, 데스크톱·좁은 화면 캡처를 검증했다. overview/grant-detail 캡처를 실제 열어 확인(`build/reports/erd/`, 추적 제외). `./gradlew check --no-daemon` 성공(7s, UP-TO-DATE)은 문서 gate이며 새 테스트 실행 증거가 아니다. 현재 backend 실행 증거는 앞의 full 135/16이다.

M2/M6 완료: 후보 검색 응답 중 Membership 제거/Workspace 종료가 commit된 두 회귀가 실제로 RED(41s, 기대 거부 없이 후보 반환)였음을 확인. 외부 I/O 뒤 현재 계정/소속/공간 상태를 짧은 공유 transaction으로 재검사한다. Setlist/ScoreReference/CoreEndToEnd targeted 성공(57s). `./gradlew check --no-daemon` 성공(3m25s), 실제 test 실행, **135 tests/16 suites, 실패·오류·skip 0**. 새 두 브라우저 HTTP 테스트는 409 VERSION_CONFLICT 무변경, 명시적 수동 재저장, Grant 회수 후 403, logout 후 401을 구분하며 화면 초안 보존 구현이라고 주장하지 않는다. 전체 production 90개 파일과 feature SQL/제약을 대조했으며 assurance의 통합/조회 최적화 후보는 미적용이다.

M5 full XML: **132 tests / 16 suites, 실패·오류·skip 0**.

M5 완료: 100개 문서/긴 이름 preview→승계→재확인→종료 포함 targeted 성공(1m51s). `./gradlew check --no-daemon` 실제 test 실행, BUILD SUCCESSFUL(3m22s). 전체 XML 집계는 아래 최종 기록/PROJECT에 반영한다. 신규 MySQL V16 schema/177 columns와 manifest 일치, 기존 upgrade 내용 유지, 실제 provider 부작용 없음. 사용자 dirty 3개 SHA-256 불변. 다음은 M2 잔여 외부 후보 응답 재검사 및 M6 두 사용자 충돌 계약이다.

M5 첫 신규 targeted: Workspace/Export/YouTube 종료·경합·중간 notice 실패 rollback·late renderer/provider 완료 거부 포함 성공(57s). 확장 HTTP/CSRF/Score 다운로드/upgrade/live manifest/OpenAPI targeted 성공(1m58s). 전체 gate는 아직 미실행. 추가 100개 문서 regression은 기존 hash token 512자 제한으로 RED(33s, Invalid token); 영향 fingerprint를 WorkspaceService의 전용 SHA-256으로 분리하고 재검증 중이다. 로그인 token 길이 방어/기존 사용자 dirty IdentityService는 변경하지 않는다.

M4a full check: 114 tests/16 suites, 실패·오류·skip 0, checkpoint `ac4688d`. M4b 기존 Document/Workspace targeted 성공(51s), 신규 승계/재확인/복수 MANAGER 미승계/둘째 알림 실패 rollback/권한 view/이름 privacy targeted 성공(59s). 경합/HTTP/upgrade/manifest/OpenAPI 추가 targeted 성공(1m29s). 전체 XML 121 tests/16 suites, 실패·오류·skip 0 확인. 후속 `./gradlew check --no-daemon` 성공(5s, UP-TO-DATE)으로 gate 완료 상태 확인. V15 live manifest 26 tables/175 columns 일치. 사용자 변경 3개는 checkpoint에서 제외한다.

M4a GREEN: Workspace/Audit/MigrationUpgrade/DesignAssurance/OpenApi/CoreEndToEnd targeted 성공(1m29s), 알림 HTTP/CSRF/타인 읽음 거부/페이지네이션/FK 추가 targeted 성공(47s). full `./gradlew check --no-daemon` 성공(2m55s, test 실제 실행). live MySQL V14 manifest 26 tables/174 columns/39 FK/25 CHECK 일치. 단일 ADMIN DB 거부·이전/퇴장 경합·동시 이전 한 승자·알림 INSERT CHECK 실패 후 두 역할/Audit/알림 rollback, legacy 복수 ADMIN upgrade 중단/역할 무변경과 유효 legacy 데이터 유지, 16조합 HTTP 문서 권한 행렬·기존 PDF·외부 회귀 통과. ERD는 아직 V12이고 명시적으로 표시했으며 M7 갱신 예정. 사용자 dirty 3파일 SHA-256 불변 확인. MANAGER 승계/표시 이름/종료 구현은 이 checkpoint에 포함하지 않는다.

M3 전체 check XML: 107 tests/16 suites, 실패·오류·skip 0. checkpoint `694571d`.

M4a RED: DB에 두 번째 ACTIVE ADMIN을 직접 지정하는 targeted 회귀가 기존 스키마에서 예외 없이 허용되어 실패(31s). V13 unique generated active_admin backstop과 원자적 책임 이전을 추가했다. 기존 Workspace/Audit targeted는 정책에 맞게 이전 경로로 바꿔 성공(44s). 새 경합/수신자 격리/알림 rollback/upgrade 거부·보존/live manifest/HTTP 계약 검증은 진행 중이다. `/promote`를 `/transfer-admin`으로 대체하고 ADMIN 문서 우회 거부 행렬은 유지한다.

M3 최종: ExportIntegrationTest/ScoreReferenceIntegrationTest 22 tests, 실패/오류/skip 0(1m26s). 손상·암호화 파일/누락/페이지·출력 제한 거부, 혼합 PDF/PNG/JPEG 실제 페이지·회전·상속 리소스·한글, 원본 선택 변경 후 retry, 기존 인가·경합·보상 검증. `./gradlew check --no-daemon` 성공(3m25s, test 실제 실행). preview.png와 mixed-score-setlist.pdf 시각 확인(8페이지). Renderer는 파일/DB 접근 없는 port이고, Application이 frozen Score IDs의 bytes를 짧은 인가 검사/I/O 후 재검사로 전달한다. schema/API/snapshot JSON은 변경하지 않았다. input 100MiB/page500/output100MiB는 설정 가능 구현 안전장치이며 hard heap/time/완전 악성 PDF sanitizer 보장이 아니다. 실제 provider의 write-once 계약/프론트 UI 승인 미검증. 최초 실제 페이지 테스트는 기존 구현에서 marker 누락으로 실패했고, 회전 fixture를 upright 좌표로 바로잡은 뒤 통과했다. 사용자 포맷 변경 3개의 SHA-256은 원래 값 그대로다.

2026-10-07 D-08 문서 반영: Design의 흐름/도메인/탈퇴/검증 조건을 수정하고 권한 참고서에 빠른 찾기·역할표·탈퇴/승계/종료·경쟁/실패·데이터 전환 기준을 보완했다. 기존 사람용 안내서에 새 정책과 이전 구현의 구분을 표시했다. `./gradlew check --no-daemon` 성공(5s, 4 tasks UP-TO-DATE); Java/테스트 변경 없는 문서 검증이므로 새 정책 테스트 실행/구현 완료 증거로 사용하지 않는다. `git diff --check`도 확인한다.

2026-10-07 M3 작업 중 전체 gate: 실제 악보 PDF/PNG/JPEG 포함, 누락·재시도·출력 제한 테스트를 포함한 `./gradlew check --no-daemon` 성공(3m 5s). PDF 시각 확인도 수행했다. M3 문서/증거 정리와 checkpoint는 아직 남아 있으므로 milestone 완료 체크는 보류한다.

초기 계획 수립 시에는 읽기 전용 조사만 수행했다. 이후 실행 증거는 아래에 기록한다. 기존 2026-10-03 `83947a1`의 101 tests/16 suites 성공은 역사적 기록이다.

2026-10-07 M0/M1: `./gradlew check --no-daemon` BUILD SUCCESSFUL (3m38s), test 101 / suite 16 / failure 0 / error 0 / skip 0. test task와 compileJava가 실제 실행됨. 현재 사용자 포맷 변경 3개와 원본 정책 변경을 포함한 worktree 기준이며, 정책의 신규 기능 구현을 증명하는 결과가 아니다. `git diff --check` 성공. shell Java는 21이지만 Gradle은 설정된 Java 25 toolchain으로 컴파일했다.

M2 RED: `./gradlew test --tests 'com.worship.core.ScoreReferenceIntegrationTest.*DuringStorageRead*' --no-daemon` (38s)에서 두 테스트 모두 기대한 401/403 거부가 없어서 실패했다. 가짜 저장소가 bytes를 읽고 응답하기 직전에 실제 소속 종료/탈퇴 transaction을 커밋하는 결정적 interleaving이다. 저장소 내부 transaction 부재도 검사한다. 기존 코드를 약화시키는 oracle 변경이 아니라 이미 종료된 소속/계정의 응답 방어를 검증한다. 수정은 저장소 I/O 후 짧은 현재 인증/소속 재검사이며 전체 재설계/DB 변경이 아니다.

M2 GREEN: `./gradlew test --tests com.worship.core.ScoreReferenceIntegrationTest --no-daemon` 성공(28s, 8 tests, 실패/오류/skip 0). 이어 `./gradlew check --no-daemon` 성공(2m58s, 103 tests / 16 suites, 실패/오류/skip 0). storage I/O는 여전히 transaction 밖이고 응답 전에 현재 account/session/membership을 재검사한다. 기존 정상 다운로드·다른 tenant 거부·업로드 보상·Reference 회귀도 통과. 이는 전체 M2 감사 완료나 악보 포함 PDF 완료 증거는 아니다.

각 구현 Milestone: 관련 `./gradlew test --tests '<실제 클래스명>'`, completion evidence, `./gradlew check`, 실패 수정·재검증, 계획/PROJECT 갱신, local checkpoint 순서. 최종 및 공유 checkout: `./gradlew clean check`; 배포 JAR은 `./gradlew bootJar`. MySQL 통합 테스트는 disposable Testcontainers이며 실제 provider/운영 파일/운영 DB를 사용하지 않는다.

## Decision Log

- 2026-10-07 문서 정리 정정: 사람용은 service-flows/architecture/schema/auth-flows/user_authorization_policy 5개만 유지한다. docs README/schema-diagram/HTML/SVG/team-review context·prompt/옛 검토 입력/assurance와 생성기를 삭제한다. 고유 결정은 Design/PROJECT, 구조·협업·감사 한계는 architecture, 필드/관계는 schema, 검증 이력은 기존 계획에 통합한다. 별도 archive·대체 보고서는 만들지 않는다. 원문은 Git b7e224d에서 복구 가능하다. manifest/OpenAPI/DDL/AGENTS/PLANS는 개발 원본·검증 입력으로 보존하고 사람용 필독으로 요구하지 않는다.
- 2026-10-07 사용자 확정: auth-workspace-v1 브랜치, 그 브랜치 backend/ 배치, 팀이 볼 수 있게 gunhe17/worship-support에 일반 push 승인. main 변경/병합/force push/자동 PR는 금지한다. 문서 재정리를 먼저 처리한다. 앞선 읽기 전용 인증 조회는 사용자 중단으로 결과 미확인, 실제 branch/remote/push는 없다.

- M5: 종료 영향은 feature-owned WorkspaceTerminationParticipant로 Document ID/version과 RUNNING Export/Playlist attempt를 모으고, API에는 수·진행 여부·주의문·fingerprint만 반환한다. WorkspaceStore에 다른 feature SQL을 모으지 않는다. ongoingWork는 저장된 PDF/Playlist RUNNING 명령 범위임을 응답에서 명시하며 모든 동기 네트워크 요청을 집계한다고 주장하지 않는다. 모든 요청은 종료 후 현재 상태 검사로 차단한다. 종료는 기존 행/파일 보존이며 기간/복구/자동 정리는 구현하지 않는다.
- M5: provider I/O 이후 Playlist 최종 SUCCEEDED 확정 및 Invitation 응답에도 현재 권한을 재검사한다. 이미 외부에 반영된 결과를 취소한다고 주장하지 않으며 종료 뒤 실패/보상 metadata만 관찰 기록할 수 있다. 짧은 DB transaction을 유지하고 provider 호출 동안 잠금을 잡지 않는다.

- M4b: 제거 preview는 제목/문서 ID 없이 영향 수와 현재-state SHA-256 fingerprint만 반환한다. fingerprint는 권한/신원/인간 확인 증명이 아니며 실행 시 ADMIN·ACTIVE 대상·현재 영향 재검사를 별도로 한다. 승계 없는 제거는 기존 요청도 허용하고, 승계가 필요하거나 확인 이후 영향이 달라지면 409 재확인 요구다. 실제 승계는 같은 workspace transaction에서 Grant/문서 version/소속/Audit/알림을 함께 처리한다. 자발적 leave/withdraw 경로는 승계를 사용하지 않는다.
- M4b: 표시 이름은 nullable legacy 필드이며 이메일 기반 추정/backfill이 없다. 본인 Profile API로 1–80자/control 금지 baseline을 적용하고, 이름 없는 구성원은 ‘이름 미설정’으로 표시한다. 이름은 unique/auth identifier가 아니고 권한은 membership ID로 지정한다. 회원탈퇴 시 새 필드를 null로 최소화한다. 구성원/Grant 조회는 joined projection으로 이름을 가져오고 이메일을 반환하지 않는다. 기존 사용자 dirty IdentityService/AccountLifecycle 파일은 건드리지 않았다.

- M4a: generated active_admin UNIQUE는 DB의 at-most-one 방어이고, 정확히 한 명 보장은 생성/이전/일반 탈퇴 transaction과 workspace lock에서 유지한다. 이전 중 release를 먼저 flush한 뒤 acquisition하며 실패는 전부 rollback한다. 기존 복수 ADMIN migration은 역할을 추정/수정하지 않고 중단한다. 운영 전 별도 조회로 ACTIVE 공간의 ADMIN 수가 정확히 1인지도 확인해야 한다; index만으로 0명 legacy 공간을 치유하지 않는다.
- M4a: 서비스 내 알림은 요구에 필요한 member_notice 한 테이블로 추가한다. user_id/email/content를 복제하지 않고 scoped Membership·Document FK를 둔다. MemberNoticeRecorder는 현재 transaction에 참여하여 역할과 함께 commit/rollback한다. 본인 알림 조회는 현재 소속/문서 접근으로 필터하고 종료 알림에만 ENDED 예외를 준비한다. 범용 큐·이메일·신규 권한 역할을 추가하지 않는다. 조회는 id cursor로 100개씩 제한하는 구현 baseline이며 M5 종료 발행과 M4b MANAGER 발행은 아직 연결하지 않았다.

- 2026-10-07 사용자 명시 승인(D-08): 권한 참고서의 단일 ADMIN/이전·확인 후 MANAGER 승계·다수 구성원 종료와 보완안 전체를 채택했다. 기존 P-01 제한과 복수 ADMIN 정책을 Design에서 대체했다. 자발적 탈퇴는 책임 이전 필수, 접근 전 제한 문서 제목 비공개/영향 수 안내, 실행 전 영향 재검사, commit 기준 종료, 본인 최소 종료 알림, V1 복구 없음/운영 복구 미보장, 기존 복수 ADMIN 자동 선택 금지. 정책 변경의 코드/테스트/스키마 이행은 M4/M5이며 문서 정리만으로 완료하지 않는다.

- 2026-10-07: 완료된 Core 계획은 역사적 증거로 유지하고 후속 작업은 이 계획으로 분리한다. 완료 M0–7를 재개하지 않는다.
- 2026-10-07: 업로드 전 확정된 Backend 요구를 완료한다. 팀 담당 기능은 계약/통합 증거와 분리하며 준비 안 된 제품 기능을 ‘완료’로 숨기지 않는다.
- 2026-10-07: 구조 최적화는 진단→사용자 논의→필요한 변경 순서다. 보안/정확성 수정과 일반 코드 정리는 별도 불필요 승인 없이 진행한다.
- 2026-10-07: 원격 main 기반 안전한 반입을 우선한다. 로컬/원격 이력·파일 검토 전 merge 전략이나 프로젝트 배치를 확정하지 않는다.
- 2026-10-07 사용자 후속 결정: 원격의 기존 문서·코드는 참고하지 않는다. 기존 기획과 V1의 관계 확인을 blocker로 두지 않는다. `feat/core-backend-v1` 제안은 철회하고 최종 반입 전 이름을 다시 정한다.
- M2 보안 checkpoint: Score도 Export와 같이 외부 I/O 후 현재 소속/세션을 재검사한다. 장기 DB 잠금을 잡는 대안은 배제했다. 이미 클라이언트에 전달된 bytes를 회수하거나 마지막 검사 이후의 네트워크 전송 전체를 DB와 원자적으로 묶는 보장은 하지 않는다. DB/role/API 계약은 변경하지 않았다.

## Surprises / Discoveries

- 로컬 HEAD `2de08ab`; remote 없음. IdentityService/AccountLifecycle/YouTubeAuthorizationService가 dirty, 검토 결정 MD가 untracked다. 변경은 사용자 작업으로 보존한다.
- GitHub main HEAD 확인값 `7fe6b3446501a8a08f564c8b57ce9259f40f604e`. recursive tree는 `.gitignore`, `docs/project.txt`뿐이며 main의 실제 구현 코드는 없다. 다른 branch의 작업 존재 여부는 미확인.
- 기존 원격 기획은 Project–Template–Block–Render 중심이다. 현재 Workspace/Setlist V1과 다른 범위이며 임의로 현재 제품 정책을 바꾸는 근거가 아니다. 출처: https://github.com/gunhe17/worship-support/blob/7fe6b3446501a8a08f564c8b57ce9259f40f604e/docs/project.txt
- 원격 .gitignore는 Python 중심. Java/Gradle/local runtime 제외 규칙을 병합해야 한다.
- M2 초기 감사: V1–V12 SQL 328줄 전체와 조회/인가/다운로드 경로를 읽음. Score 원본 다운로드는 저장소 I/O 이후 현재 소속/세션을 다시 확인하지 않지만 Export 다운로드는 재확인한다. 저장소 접근 도중 소속 종료/계정 탈퇴가 커밋되는 경우를 먼저 재현해 일관된 응답 전 검사로 보완한다. 전체 83 Java 파일 감사 완료를 뜻하지 않는다.

## Failures / Recovery

- PDF READ 생성 해석 및 이를 정답으로 삼은 테스트/None 완료 보고는 정책 판단 실패였다. D-01 사용자 결정으로 EDIT 생성/READ 다운로드를 수정했고 D-03은 P-03으로 해결했다. metadata-only PDF green은 실제 악보 합성 증거가 아니었으며 M3에서 보완했다. 원문 미변경·테스트 통과·정책 승인·운영 검증을 혼동하지 않는다. 별도 보고서 대신 기존 복구 기록에 교훈을 보존한다.

- M5 영향 fingerprint에 IdentityService.hash(token)의 512자 입력 제한을 재사용하면 많은 문서의 preview가 400 Invalid token으로 실패했다. 100개 제한 문서/긴 공간 이름 회귀에서 먼저 재현하고 전용 state fingerprint로 분리했다. 영향 수 제한이라는 새 제품 정책을 만들거나 token 방어를 약화하지 않는다.

- M4a 알림 INSERT 실패를 트리거로 주입하려던 테스트가 disposable MySQL의 binary log/SUPER 권한 제한(1419)으로 실패했다. production 권한 확대 없이 테스트용 CHECK를 일시 추가/해제하여 실제 INSERT가 실패하도록 교체했다. 역할 변경·Audit의 rollback oracle은 유지했다. OpenAPI 새 endpoint/nullable DTO candidate 차이는 검토 후 apply_patch로 반영했으며 테스트 oracle을 제거하지 않았다.

- 웹 open은 cache miss, sandbox Git 조회는 DNS 차단. 허용된 읽기 전용 `git ls-remote`/GitHub API 조회로 main 및 파일 목록 확인. 이를 비공개 저장소/권한 없음으로 단정하지 않음. 원격 쓰기는 수행하지 않았다.

## Unresolved High-impact Decisions

2026-10-07 D-08은 사용자 승인 및 M4/M5 구현·회귀로 해결했다. 자발적 탈퇴 책임 이전, 종료 알림의 ENDED 예외, 제한 문서 정보 비공개/영향 재검사, legacy 복수 ADMIN 임의 선택 금지를 적용했다. 승인/구현 대기가 아니다.

1. 구성원 표시 정보: D-06/M4 구현 완료. 표시 이름만 공유하고 타인의 이메일은 공개하지 않는다.
2. 책임 지정 통지: D-07/M4 구현 완료. 서비스 내 알림만 권한 변경과 원자적으로 기록하며 이메일/상대 수락은 제외한다.
3. 종료 결과: D-08에서 유일 ADMIN의 직접 종료, V1 복구 없음/운영 복구 미보장과 최소 알림으로 결정 완료. 기존 단독 구성원 경로의 별도 정책 승인 대기는 해소했다.
4. 데이터별 보존 기간·기산점·삭제/익명화·백업·운영 담당: D-05. 운영 sign-off 전 결정; 자동 영구 삭제를 임의 구현하지 않는다.
5. 저장소 배치/브랜치 규칙, 타 팀의 실제 연결 계약: 필요한 통합 단계에서 확인. 기존 원격 기획과 현재 V1 관계의 확인은 사용자 지시에 따라 요구하지 않는다. 브랜치명은 최종 반입 전에 다시 정한다.

결정이 필요한 경로만 멈추고 독립적인 감사/PDF/검증을 계속한다. 실행 중 DECISION이 실제 필요해지면 PROJECT에도 기록한다. 외부 부작용·파괴 작업이 필요한 경우 별도 승인한다.

## Handoff State

복구 기준(사용자 2026-10-07 재강조): compaction의 요약을 단독 근거로 삼지 않고 AGENTS → Design/PROJECT → 이 계획 → 실제 diff/test XML을 다시 대조한다. 새 제품 정책 임의 생성 금지. 1–8 자율, 9 공유 반입/브랜치 및 이후 Figma 시작 전 사용자 소통, remote/push/PR 미실행. 사용자 dirty 3파일(AccountLifecycle/IdentityService/YouTubeAuthorizationService)은 원래 SHA-256 그대로이며 stage하지 않는다. M5 `adf2275`, M2/M6 `eac0954`, M7 `f15bcdf`; M8 결과는 위 최종 증거다.

현재 실행: M7c 검증 완료, local checkpoint 후 M9 준비 상태. 사람용5개 유지, SVG7개는 인라인 삽화이며 별도 ERD viewer/스크립트/설명서 없음. 사용자 확정 auth-workspace-v1 / 그 브랜치 backend/ / 일반 push 승인; main 변경/병합/force push/자동 PR 금지. 이전 인증 조회는 중단되어 결과 미확인, 실제 branch/remote/push 미실행. 다음 원격 실행은 GitHub 인증/쓰기 권한·이름 충돌 확인과 안전한 별도 checkout 반입이다. dirty3 SHA 그대로/stage 제외. Figma는 게시 이후 별도 소통한다.

확정 정책: D-08 ACTIVE 공간 ADMIN 정확히 1명/원자적 이전; 강제 제거에만 확인 후 필요한 MANAGER 승계; 자발적 leave/withdraw 책임 이전; 인원 수 무관 ADMIN 종료·이름 재입력·현재 영향 확인; 원자적 상태/소속/초대/본인 알림; 종료 당시 구성원 최소 상태만, 자료/제목/구성원 및 무관한 사용자 상태 비공개; 즉시 삭제/사용자 복구 없음·운영 복구 미보장; legacy 복수 ADMIN 임의 선정 금지. D-06 표시 이름만 공유, D-07 ADMIN/MANAGER 지정 통지 서비스 내(이메일 제외), D-05 보존기간 운영 전 미정. PDF 생성 EDIT, 다운로드 READ. Agent Runtime/실제 provider 부작용은 제외.

M0–M8/M7b/M7c 완료. M9의 브랜치/배치는 사용자 확정했고 인증/반입은 미실행이다. Figma는 게시 이후 별도 소통한다.

## Outcomes

공유 전 Backend 준비(1–8): 실제 악보 불변 PDF/다운로드 계약, 승인 권한 이전·승계·종료·본인 알림·표시 이름/권한 조회, 외부 I/O 후 현재 권한 재검사, 두 브라우저 충돌 계약, 26개 테이블 감사와5개 설명서를 전달한다. 최종 clean135/16 및 packaged startup 통과. 구조 통합/추가 성능 최적화는 논의 전 미적용이며 절대 최선이라고 단정하지 않는다. M2의 항목별 조회 측정은 1/10/30 항목에서 7/16/36 statements이며 bulk 최적화는 논의 전 보류한다. 공유 저장소 반입/commit(M9), Figma, 프론트/AI 통합과 운영 승인(D-02/D-05/실 provider/부하/키관리)은 미완료이며 별도 범위다.
