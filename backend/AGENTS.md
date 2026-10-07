# Project Instructions

## Sources of truth

우선순위는 다음과 같다.

1. `PROJECT_DESIGN.md`
2. `PROJECT.md`
3. `.agent/PLANS.md`
4. repository code/tests

제품 정책, 권한 규칙, 도메인 불변식을 Codex가 임의로 재해석하거나 새로 만들지 않는다.

## Project profile

Risk level: **CRITICAL**

Milestone Full Gate:

`./gradlew check`

Final / Clean-environment Gate:

`./gradlew clean check`

High-risk areas:

- Workspace tenant isolation
- Authentication / Session / CSRF
- WorkspaceMembership lifecycle
- OPEN / RESTRICTED document access
- MANAGER / EDITOR / VIEWER authorization
- Last ADMIN / last MANAGER invariants
- Optimistic concurrency
- Google identity linking
- YouTube OAuth credential handling
- Object Storage ↔ DB consistency
- Immutable Export
- External side-effect retries and idempotency


## ExecPlans

프로젝트 루트는 다음 구조를 전제로 한다.

```text
AGENTS.md
PROJECT.md
PROJECT_DESIGN.md
.agent/
  PLANS.md
```

복잡한 기능, 다중 Milestone 작업, 중요한 리팩터링에서는
`.agent/PLANS.md`에 정의된 ExecPlan을 사용한다.

현재 V1 Core Backend 구현은 다중 Milestone 장기 작업이므로
`.agent/plans/active/core-backend-v1.md`를 생성하고 계속 갱신한다.

## External side effects

Codex must not silently perform or depend on real external side effects during implementation or automated verification.

Real provider calls must be isolated behind adapters and explicitly configured.

특히 다음을 자동으로 실행하지 않는다.

- 실제 이메일 발송
- 실제 YouTube Playlist 생성/수정/삭제
- 실제 OAuth token revoke
- 운영 Object Storage 파일 생성/삭제
- 운영 DB destructive migration

Tests must use fakes/stubs/test accounts/local infrastructure as appropriate.

## Project-specific constraints

- Core Backend is a single-deployable Spring Boot Modular Monolith.
- Current Core Backend implementation scope is Milestone 0~7; Agent/LLM implementation belongs to Post-Core Integration.
- Use package-by-feature; do not create a cross-project global controller/service/repository dumping ground.
- Workspace is the tenant boundary.
- Never authorize a Workspace-scoped resource by resource ID alone.
- Spring Security handles authentication infrastructure; domain authorization belongs to Application/Domain AuthorizationPolicy.
- Do not cache WorkspaceRole or DocumentGrant as long-lived browser authorization state.
- Workspace ADMIN does not bypass RESTRICTED Document access.
- Do not add roles beyond those locked in `PROJECT_DESIGN.md`.
- Do not introduce Primary Admin/Workspace Owner in V1.
- Do not introduce Church hierarchy, public document links, global Song catalog, Redis, queue, microservices, CRDT/OT, generic billing, or Agent Runtime infrastructure without an explicit design change.
- JPA entities must not be returned directly from APIs.
- Schema changes must be Flyway migrations; production must use schema validation, not automatic schema creation.
- State-changing Setlist/Document operations must preserve optimistic concurrency semantics.
- External provider calls must not hold long-running DB transactions.
- Agent/AI code must not access the database directly; future Agent integration must call Backend capabilities and pass through Backend authorization.
- If implementation reveals a contradiction with `PROJECT_DESIGN.md`, stop and surface the contradiction instead of inventing a new product rule.
- After a Milestone satisfies its completion evidence and `./gradlew check` passes, proceed to the next Milestone without human approval.
- Ask the human only when a new product/security decision is required, a locked design contradiction is discovered, or an external-system blocker cannot be resolved safely.
