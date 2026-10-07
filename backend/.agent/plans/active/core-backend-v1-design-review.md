# Make the V1 architecture and ontology reviewable with traceable evidence

Status: COMPLETED / historical 2026-10-01 review. Initial READ interpretation and G-03/04/06 findings below were later superseded by user D-01 and H1–H4. Current status: PROJECT.md; latest verification: authorization-efficiency.md. Paths for obsolete ontology/meeting bodies are no longer current reading instructions. Do not resume the finished initial review as unfinished implementation.

## Purpose

회의에서 제품 온톨로지, User/Role/Membership 권한 모델, 구현 아키텍처, 실제 테이블 구조, 개발 Harness의 통제와 한계를 설명할 수 있는 자료를 제공한다. 구현 검증 성공과 정책 승인·설계 완결성을 혼동하지 않는다.

## Scope

설계/코드/마이그레이션/테스트 최종 대조, 회의용 Markdown·ERD, 25개 테이블 정의, 기계 판독 가능한 물리 스키마 manifest, MySQL 실물 대조 테스트, 차이·미정 결정·Harness 평가, 프로젝트 상태 정정. 제품 정책, production schema, 기존 Application 동작은 변경하지 않는다. Agent Runtime·OWL/RDF 플랫폼·새 Role·실제 외부 side effect·remote/push 제외.

## Relevant Design

PROJECT_DESIGN.md §§2–4 (Actor, Identity, Membership, Grant, lifecycle, capability), §§5–8 (tenant, modular monolith, authentication/authorization, DB/ports), §§9–10 (risk/evidence/gates), §12 (Design Lock). AGENTS.md와 .agent/PLANS.md의 우선순위와 DECISION 규칙 적용. Harness는 개발 과정 제어이며 제품 runtime/Domain Role이 아니다.

## Progress

- [x] 기준 문서와 기존 검토·저장소 상태 확인
- [x] 실제 코드/스키마/검증 근거 대조
- [x] 온톨로지·아키텍처·ERD·테이블 정의·회의 요약 작성
- [x] 설계 차이와 Harness 평가 및 미정 정책 표시
- [x] 자료 manifest targeted 검증과 ./gradlew clean check
- [x] 프로젝트 상태·ExecPlan 갱신 (local checkpoint로 함께 기록)

## Plan

1. As-designed/as-built/evidence/decision을 분리해 source-backed 평가한다.
2. docs/review/core-backend-v1에 회의 안내, 온톨로지/권한, 아키텍처, 테이블/ERD, 차이/증거/Harness 문서를 만든다. ontology는 개념·관계 모델이며 새 ontology runtime을 구현하지 않는다.
3. schema-manifest.json의 25개 application/session 테이블과 column type/nullability/PK/UK/FK/check를 disposable MySQL information_schema와 대조한다. Flyway 관리 테이블은 별도 기술 metadata로 제외한다.
4. 기존 테스트와 새 문서 대조 테스트를 targeted 실행한 후 ./gradlew clean check. 발견된 정책 질문은 미정으로 남기고 독립적인 자료 작업만 계속한다.
5. PROJECT.md의 None/완료 단정을 정정한다. 설계 원문은 보존하고 기존 Core ExecPlan에도 후속 점검 결과를 연결한다. 검증된 자료 checkpoint만 main에 로컬 commit한다.

## Verification

Baseline: 8021908, 이전 ./gradlew clean check 76 tests/12 suites, no failures/skips (2026-10-01). 이전 테스트 통과는 별도 정책 승인이나 독립 보안 심사를 뜻하지 않는다.

Targeted: ./gradlew test --tests '*DesignAssuranceIntegrationTest' --no-daemon passed, 3 tests. All 25 tables / 158 columns / 34 FK constraints / 20 CHECK names, type/nullability/generated flags, ordered PK/UK/FK/delete rules match live MySQL V10. Nullable CHECK probes reproduce two gaps; passing these probes records defects, not successful DB enforcement.

Final: ./gradlew clean check --no-daemon passed in 1m32s on 2026-10-01; XML 79 tests/13 suites, 0 failures/errors/skips. Nine Markdown files have 53 valid local links and balanced code fences; JSON parses and all table sections exist. git diff --check passed; production source/DDL/PROJECT_DESIGN/AGENTS/PLANS unchanged. Mermaid sources not separately rendered. No real providers/production DB or remote/push.

## Decision Log

- Markdown/Mermaid와 JSON manifest로 저장소 안에서 회의 자료를 재현 가능하게 유지한다. 특정 슬라이드/문서 도구나 외부 계정을 요구하지 않는다.
- 미정 Export 생성 권한은 READ 현재 구현과 원문의 비명시를 함께 기록한다. 이 자료는 READ/EDIT 중 하나를 승인하지 않는다.
- 운영 수치, 조회 쓰기 잠금, 모듈 결합, API schema, audit 맥락, Reference update 의미를 평가 대상에 포함한다. 단일 구현 결과로 Harness 전체 성능 점수를 만들지 않는다.

## Surprises / Discoveries

기존에는 설계 원문·25개 테이블 migration·ExecPlan·부분 OpenAPI만 있고 ERD/테이블 정의서/회의용 개념 모델이 없다.

G-06 confirmed: V3 permits ENDED membership with end_reason NULL; V8 permits SUCCEEDED export with object/hash non-null but byte_size NULL. Rolled-back synthetic inserts prove the current weakness; application paths normally populate the values. Follow-up forward migration/negative tests required, not performed in documentation scope.

## Failures / Recovery

서버 재시작 후 git status clean과 문서 목록을 확인했다. 중단 전에는 보고만 하고 파일을 변경하지 않았으므로 중복 산출물은 없다.

Schema comparison initially expected implicit FK RESTRICT; information_schema reports NO ACTION. Corrected expected default and table-definition wording, then targeted test passed. This is metadata wording alignment, not DDL change.

## Unresolved High-impact Decisions

D-01 follow-up resolved (2026-10-01): user explicitly requires EDITOR/MANAGER generation/retry; READ metadata/download remains. Implementation and current verification follow core-backend-v1.md; original 79-test review evidence below/above is historical.
D-02 사용자에게 노출되는 security defaults: password 12–128, recent reauth/expiry 등은 implementation-selected baseline이며 합의된 제품 정책으로 승격하지 않는다.
D-03 Reference update: 선택 변경과 등록 Reference 자체 수정의 의미를 구분할 필요가 있다.

## Handoff State

Review scope complete at d985d55: targeted 3 and clean 79 tests passed with zero skips/failures/errors; that review made no production/DDL/policy edits. Subsequent D-01 user policy implementation/evidence is maintained in core-backend-v1.md and supersedes the initial READ interpretation. Next: clarify D-03 and review D-02 implementation baselines, separately scope API/audit/backstop remediation. No environment blocker/provider side effects/remotes/push. G findings remain open and no Agent implementation is authorized by this review.

## Outcomes

Delivered repository-native meeting materials with semantic ontology/role matrix, intended/as-built architecture, frontend/AI boundaries, 25-table ERD/definitions/manifest, evidence map, explicit D/G findings and Harness self-review. Added three MySQL tests; clean gate 79/13 passes, no skips. Previous completeness/None statements corrected without altering Design Lock. Historical review limitations: D-01/02/03 were open; D-01 subsequently resolved by user-directed EDIT generation (see core plan). Remaining limitations: OpenAPI/Audit/DB backstops incomplete, unmeasured lock/module concerns, no real provider/production or independent audit proof. This completes the review/materials task, not remediation or Agent implementation.
