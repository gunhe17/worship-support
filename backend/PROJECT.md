# Project

## Design Lock

Status: LOCKED<br>
Design version/date: 2026-10-07 (P-01–P-06 및 후속 권한 정책 승인 반영)<br>
Risk level: CRITICAL

## Current State

- 문서 시각화 품질 정비 완료(M7c): 기존5개 문서의 ASCII 도식을 인라인 SVG7개로 교체하고 모두 렌더링 확인했다. 아키텍처/인가/외부 transaction/동시 저장/Harness/핵심6테이블 경계를 표현하며 전체26테이블·177필드 사전은 유지한다. 정책 원본과 구현·미완료 범위를 구분하고 member_notice를26번에 정렬했다. 상대 링크37개/필드명/XML/whitespace 대조와 check(6s, UP-TO-DATE) 통과. 새 읽을 문서·ERD viewer·생성기는 추가하지 않았다. 코드/DDL/정책 변경 없음, GitHub 게시는 아직 미실행.

- 문서5개 정리 완료: 사람용 Markdown은 사용 흐름/아키텍처/DB/인증·인가/권한 시나리오 5개뿐이다. 별도 안내·ERD·검토 스냅샷/프롬프트·옛 입력/점검 보고서 8개와 생성기를 삭제하고 고유 결론을 기존 원본/설명/계획에 통합했다. Git b7e224d에서 삭제 전 자료 복구 가능. 52개 상대 링크·fence·26개 테이블/177개 필드명 대조 및 check(7s, UP-TO-DATE) 통과. 코드/DDL 변경은 없으며 이전 clean135/16 증거를 보존한다. 브랜치 auth-workspace-v1와 해당 backend/ 배치·일반 push는 승인됐고 GitHub 게시 전에 문서 정리를 우선했다.

- **2026-10-07 후속 1–8 완료, 9번 사전 소통 대기.** `./gradlew clean check bootJar --no-daemon` 성공(4m22s, 7 tasks 실제 실행), **135 tests/16 suites, 실패·오류·skip 0**. 빈 로컬 MySQL V1–V16/validate와 배포 JAR 시작·세션 보안/401/CSRF403 확인, 생성 PDF 재시각 확인. 검증 서버·DB는 정상 중지했고 기존 사용자 변경3개는 보존/커밋 제외했다. 실제 provider/프론트/AI/운영 검증 완료는 아니다. 최신 안내는 [5개 문서 목록](README.md#reader-guides), 실행 근거는 [후속 ExecPlan](.agent/plans/active/backend-v1-team-ready.md)이다.

- M7 당시 ERD 검증 이력은 기존 계획에 보존한다. 이후 사용자 요청으로 ERD/인계 사본을 포함한 중복 자료를 실제 삭제했다. 사람용은 5개만 유지하며 실제 공통 Harness 자동 로딩은 아직 적용하지 않았다.

- 2026-10-07 M2/M6 완료: 현 production Java 90개와 V1–V16/26개 테이블 검토, 후보 검색의 외부 I/O 후 현재 권한 재검사 추가. 두 브라우저 HTTP에서 충돌 409/저장 무변경/수동 재저장/Grant 회수 403/로그아웃 401 구분. targeted 및 당시 전체 check **135 tests/16 suites, 실패·오류·skip 0**(3m25s). 구조 최적화 후보는 논의 전 미적용이며 실제 프론트 화면 초안 보존·운영 부하·독립 감사는 별도다.

- M5 완료: Workspace 종료 영향·주의사항 확인/이름 재입력, 모든 소속 종료·초대 무효화·본인 종료 알림의 원자성, 종료 후 접근과 늦은 PDF/Playlist 완료 차단을 구현했다. 신규/기존 DB V16, HTTP·CSRF·경합·rollback·100개 문서 regression 및 전체 check 성공(3m22s). 종료는 hard delete/복구가 아니며 보존 기간은 D-05에서 결정한다.

## Completed Milestones — Historical Evidence

아래 수치와 당시 작업 상태는 단계별 이력이다. 현재 완료 여부·다음 실행은 위 Current State를 우선한다.

- M4b 완료 기록: 확인 후 유일 MANAGER 승계와 구성원 제거의 원자성, 표시 이름 Profile·구성원 조회, 현재 문서 권한/Grant 조회, MANAGER 지정 알림을 구현했다. V15 및 targeted/HTTP/경합/rollback/upgrade 검증과 당시 전체 gate 성공, **121 tests/16 suites, 실패·오류·skip 0**. 후속 M5에서 Workspace 종료도 완료했다.

- 2026-10-07 후속 권한 정책: 단일 ADMIN/ADMIN 이전, 확인 후 유일 MANAGER 승계, 다수 구성원 공간 종료를 Design에 반영하고 M4/M5에서 구현·검증했다. [사용자 및 권한 정책](docs/review/core-backend-v1/user_authorization_policy.md)은 상황별 참고서이며 구현 증거는 이 상태와 ExecPlan/테스트에서 확인한다. 과거 Core gate는 과거 정책 기준의 증거다.

- 2026-10-07 M3 완료(checkpoint `694571d`): 실제 PDF 악보 전체 페이지/회전·PNG/JPEG와 한글 안내·SongForm 합성. targeted 22개 및 전체 check **107 tests/16 suites, 실패·오류·skip 0**, 생성 파일/시각 자료 확인. 프론트 다운로드 버튼·최종 UI·운영 승인과 새 권한 정책 구현은 별도다.

- M4a 완료 기록: 기존 독립 승격을 ADMIN 이전으로 대체하고 V13 단일 ADMIN 제약·V14 서비스 내 알림 저장을 추가했다. 당시 live schema 26 tables/174 columns/39 FK/25 CHECK 대조, legacy upgrade/HTTP/경합/알림 DB 실패 rollback 및 전체 check 성공(2m55s). 승계·표시 이름·종료는 후속 M4b/M5에서 완료했다.

- 2026-10-07 후속 구현 착수: 공유 전 확정 V1 Backend 요구 완료와 전체 아키텍처·테이블·코드 감사는 [후속 ExecPlan](.agent/plans/active/backend-v1-team-ready.md)으로 진행한다. 구조 최적화는 진단과 사용자 논의 후 적용한다. 팀의 기능별 담당/공통 Harness는 아직 합의된 구현 요구가 아니다.
- 2026-10-07 작업 상태: IdentityService/AccountLifecycle/YouTubeAuthorizationService의 기존 미커밋 변경은 diff 대조에서 배치·주석 정리만 확인했고 그대로 보존한다. 후속 baseline check 101/16 성공 후 Score 다운로드 보안 수정의 full check **103 tests/16 suites, 실패·오류·skip 0**을 새로 확인했다. 기존 포맷 변경을 포함한 현재 worktree 기준이며 새 V1 요구 전체의 구현 완료는 아니다.
- M2 초기 보안 수정: 악보 저장소 읽기 중 소속 종료/탈퇴가 커밋되면 bytes를 반환하던 경로를 두 회귀로 재현하고, I/O 이후 현재 인증·소속 재검사로 차단했다. targeted 8개/full 103개 성공. 전체 구조 감사·악보 포함 PDF는 계속 진행한다.
- P-01–P-06 및 D-08의 Backend 구현·조회 계약을 완료했다. 프론트 초안 보존·다운로드 버튼과 AI 통합은 별도다. 브랜치명은 최종 반입 전에 다시 정하고, 원격 기존 문서·코드는 참고하지 않되 파일과 이력은 보존한다.
- Authorization efficiency follow-up complete (2026-10-03): check and clean check passed, **101 tests/16 suites, zero failures/errors/skips**. Direct DocumentService.get SQL 8→5(RESTRICTED)/4(OPEN), explicit shared pure reads/exclusive changes, command snapshots retain write guards, existing ACTIVE membership index used. Schema/roles/permission rules unchanged. Plan/evidence: [.agent/plans/active/authorization-efficiency.md](.agent/plans/active/authorization-efficiency.md). Local measurements are not production load proof.
- Current milestone: V1 Core Backend Milestones 0–7/Final and hardening H1–H4/final clean gate complete; frontend/AI boundary and remaining policy/operations review
- Completed meaningful capabilities: Milestones 0–7, including separate encrypted YouTube authorization, resilient Playlist commands and immutable Korean PDF Export
- D-01 resolved (2026-10-01): 사용자 결정으로 PDF 생성/재시도는 EDITOR/MANAGER만 가능. 조회/다운로드는 READ 유지. Design Lock·코드·회귀 검증 완료.
- Historical hardening verification: `./gradlew check --no-daemon` and `./gradlew clean check --no-daemon` passed (2026-10-01), 89 tests/15 suites, zero failures/errors/skips. H1 V11 NULL-safe backstops; H2 precise race/DB/OIDC negatives; H3 DTO/HTTP contracts; H4 V12 transactional scoped Audit verified. Live schema: 25 tables/166 columns/37 FK/23 CHECK names. Earlier stage counts are retained in ExecPlan/assurance as historical evidence. Disposable MySQL/fake/intercepted providers only; no real side effects/remotes/push.
- 2026-10-03 역사적 요구 발견: 당시 PDF는 실제 악보 없이 파일명·설정·송폼만 출력했다. 2026-10-07 M3에서 실제 악보 합성을 추가했으며, 이전 gate 완료를 새 요구의 증거로 쓰지 않는다.

## Decisions Needed

- D-08 · 결정/Backend 구현 완료: 단일 ADMIN/원자적 이전, 강제 제거에만 확인 후 유일 MANAGER 승계, 인원 수 무관 공간 종료. 자발적 leave/withdraw는 책임 이전 필수. 접근 전 제한 문서 제목 없이 영향 수만 제공하고 실행 전 재검사한다. commit 기준 종료·본인 최소 종료 알림·무관한 사용자 상태 비공개·V1 복구 없음/운영 복구 미보장. legacy 복수 ADMIN 임의 전환 금지. Design/[권한 참고서](docs/review/core-backend-v1/user_authorization_policy.md)와 M4/M5 회귀에 반영했다.

- D-02: password/expiry/reauth/file-limit 등의 implementation-selected baseline을 사용자 노출 정책으로 확정할지 검토한다. 모든 구현 기본값이 Design Lock 위반이라는 뜻은 아니다.
- D-03 · 원칙 결정 완료(P-03): 새 Reference 등록 또는 기존 Reference 선택으로 해당 항목의 선택을 교체한다. V1 공유 URL·제목 자체 편집은 제공하지 않는다. 기존 선택 교체 구현을 계약·회귀와 대조한다.
- D-04 · 결정/Backend 구현 완료: D-08이 기존 P-01 단독 구성원 제한을 대체했다. **유일 ADMIN은 구성원 수와 관계없이 영향 확인/이름 재입력 후 종료할 수 있다.** 종료·모든 ACTIVE 소속 종료·미수락 초대 무효화·알림은 원자적이다. 종료 ≠ 영구 삭제. 사용자용 복구 없음/운영 복구 미보장. 자동 파일 삭제·archive 플랫폼은 추가하지 않았다.
- D-05 · 미결정: **서비스 탈퇴 후 개인정보·업무 이력을 얼마나 보존하고 언제 어떻게 삭제할지** 확정한다. 기존 운영 전 보존·삭제 검토 항목을 식별 가능한 결정으로 구체화했다.
  - 결정할 것: 계정 식별 기록·초대 이메일·인증 시도 기록·Membership/문서/Audit 등 데이터별 삭제/보존/익명화 범위; 보존 목적·기간과 기산점; 백업·파일 저장소 포함 여부; 자동 처리 및 실패 시 재처리/확인 방식. 법적 보존 의무가 있는지는 별도 확인한다.
  - 현 구현은 탈퇴 시 로그인 자료를 제거하고 WITHDRAWN 계정 및 업무 이력 등을 남긴다. 이것이 승인된 보존 기간·완전한 개인정보 삭제를 뜻하지 않는다. 기간과 자동 삭제 방식은 정하지 않았다.
- D-06 · 결정/Backend 구현 완료: 표시 이름만 구성원끼리 공유하고 타인의 이메일은 공개하지 않는다. 이름은 권한 식별자가 아니며 탈퇴 후 null로 최소화한다. 탈퇴한 작성자의 화면 표현은 P-05 프론트 요구다.
- D-07 · 결정/Backend 구현 완료: ADMIN/MANAGER 지정 통지는 서비스 내 알림만 사용하며 이메일/수락은 제외한다. DB 권한 변경과 알림 기록을 함께 commit/rollback한다.

사람용 설명은 사용 흐름·아키텍처·DB 사전·인증/인가 과정·권한 시나리오 5개다. 별도 읽기 안내·점검 보고서·복제 스냅샷은 삭제했다. 정책 원본은 Design, 현재 미결정은 이 PROJECT, 실행 증거는 기존 ExecPlan에 둔다. 이 개발 원본을 추가 사람용 필독으로 요구하지 않는다.

Agent Runtime, LLM orchestration, conversation/context handling and the concrete approval protocol are intentionally deferred to the later integration review with the AI developer. They are not blockers for Core Backend implementation.

## Material Risks / Blockers

Core 구현 gate는 완료했지만 정책·협업 계약·운영 승인이 모두 완료된 것은 아니다. [구조·한계 설명](docs/review/core-backend-v1/architecture.md)의 Open 항목:

- G-03 계약 보강 완료: payload/parameter/error/security와 DTO/실제 HTTP 검증 통과. 프론트 도구별 생성 클라이언트 수용 검증은 별도다.
- G-04 추적 보강 완료: typed target/tenant/member/document ID와 비밀정보 없는 변경값, rollback/삭제 credential 추적 검증. 개인정보/history retention·Audit 관리 UI·tamper-proof 운영 보장은 별도다.
- G-06 해소: V11 NULL-safe CHECK와 거부/upgrade 회귀 통과. 기존 잘못된 행은 자동 추정/수정하지 않고 migration이 중단되며, 운영자 확인 후 교정이 필요하다.
- G-01 조회 직렬화 개선: 불필요한 계정 상세 조회 제거 및 공유 조회/쓰기 변경 경로 분리, 권한/종료/rollback 경쟁과 로컬 혼합 부하 검증. 변경은 여전히 Workspace 단위 잠금이며 공유 조회도 변경을 기다리게 할 수 있음. 운영 부하/절대 최적성 검증은 아님. G-02 cross-feature Store/lifecycle cycle·강제 모듈 격리 미검증은 유지.
- 실제 provider/production storage/deployment 운영 검증 미수행.
- G-08 Backend 출력 해소: 실제 악보 페이지 합성과 원래 선택을 유지하는 재시도 구현·검증. 프론트 버튼/최종 UI/운영 검증은 별도다. renderer는 완전한 악성 PDF sanitizer나 hard heap/time 제한을 보장하지 않는다.

Primary implementation risks:

- tenant isolation
- authorization bypass
- membership/document responsibility lifecycle
- concurrent Setlist modification
- OAuth/external side effects
- Object Storage/DB consistency

## Next Meaningful Milestone

- Outcome: 사용자와 브랜치명/Backend 배치를 정한 뒤 공유 main 기반 안전한 M9 반입·local commit·새 checkout 검증. remote push/PR와 Figma는 자동 실행하지 않는다.
- Completion evidence:
  - Audit current code/schema/tests and preserve uncommitted work; complete actual Score-page PDF with immutable inputs and browser download contracts.
  - Preserve completed 1–8 and clean gate evidence; discuss before M9 shared-repository import, branch naming and placement. Do not overwrite shared main/files/history or merge unrelated histories blindly.
  - Decide D-05 per-data retention/deletion before production sign-off and review D-02 exposed defaults. Never pick arbitrary retention periods.
  - Consume verified OpenAPI payload/error contracts, scoped Audit and V11/V12 DB backstops; frontend-specific client generation/integration acceptance remains separate
  - Review Backend Application Capability and Authorization contracts using the meeting pack and traceable evidence
  - Separately decide Agent approval protocol and integration boundaries
  - Do not automatically introduce Agent Runtime, LLM orchestration or conversation/context implementation


## V1 이후 후속 개발 기록

- 팀 협업·구조 개선 후보는 [아키텍처 안내의 협업 기준](docs/review/core-backend-v1/architecture.md#팀에-전달할-협업-기준)에 통합했다. 실제 동료 규칙 파일/도구 버전·기능 담당·클라이언트 계약·운영 목표를 확인한 뒤 개선 범위를 정한다. 과거 복제 스냅샷과 검토 프롬프트는 삭제했다.
- 협업 편집의 초안 보존·3-way 비교·안전한 병합/사용자 선택·재저장 및 실시간 공동편집 기술 검토: [PROJECT_DESIGN.md — V1 이후 협업 편집](PROJECT_DESIGN.md#v1-이후-협업-편집--초안-보존과-충돌-해결-검토). 2026-10-06 논의 기록이며 현재 V1 구현 범위나 병합 정책 확정은 아니다.

검증 완료 Milestone마다 local checkpoint commit을 남기고 다음 Milestone으로 진행한다. 원격 push는 별도 명시 요청 전까지 하지 않는다. 브랜치명은 최종 반입 전 사용자와 정한다. 후속 진행/복구는 `.agent/plans/active/backend-v1-team-ready.md`, 기존 Core 역사적 증거는 `.agent/plans/active/core-backend-v1.md`에 기록한다.
