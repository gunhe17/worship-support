# Current authorization with concurrent safe reads

## Purpose
Keep current DB-backed tenant/document authorization and atomic lifecycle rules while reducing unnecessary account-detail queries and serialization of pure reads.

## Scope
Identity authentication guard, Workspace read/write guard, explicit Document pure-read policy, feature query callers and command snapshot callers, deterministic concurrency/SQL measurements and updated reader guides. No roles/cache/Redis/new isolation policy/DDL/provider side effects. Existing mutation/last-responsibility locks remain exclusive.

## Relevant Design
PROJECT_DESIGN §§3.1–3.4, 4.1–4.3, 6.2–6.3, 7–8, 10: current membership/grant authorization, last ADMIN/MANAGER, fresh rejoin identity, exact-version commands, no long provider transactions, optimistic concurrency. READ permission is not the same as a pure-read execution; command snapshot creation remains a write-guarded path.

## Progress
- [x] Review current source, Design Lock and critical constraints
- [x] E1: baseline SQL/read contention evidence, remove account detail queries, targeted/full gate, local checkpoint
- [x] E2: concurrent shared read guards with unchanged write guards, race/SQL/performance verification, full gate, local checkpoint
- [x] Final: clean check, docs/current state, final checkpoint

## Plan
E1 introduces a lean authenticated account guard but retains existing exclusive locks, with SQL statement tracing to prove no email/password/Google profile fetch for authorization. E2 adds explicit pure-read account/Workspace shared locks, preserves account→Workspace lock order, keeps mutations exclusive from entry, and separates command Setlist snapshots from ordinary reads to avoid lock upgrades. Avoid inferring execution mode solely from HTTP verb or READ permission. Measure the same direct capability queries with disposable MySQL before and after; use deterministic held transactions to prove overlapping reads and queued changes. Timing is local evidence, not production throughput claims.

## Verification
Add AuthorizationEfficiencyIntegrationTest: per-thread SQL trace, repeated ordinary document reads and a held transaction contention probe; permission/access changes first vs reads first; membership end, session invalidation/withdrawal; no read-to-write upgrades; provider command existing regressions. Run relevant Identity/Workspace/Document/Setlist/Export/YouTube tests, ./gradlew check each milestone and ./gradlew clean check final. Never substitute skipped/failed verification for passed. Record actual statements and lock waits rather than count data categories.

Baseline (2026-10-03): phase=baseline targeted suite passed (2 tests). 40 direct DocumentService.get calls after 5 warmups each execute 8 SQL: account FOR UPDATE, emails, password credential, Google identities, Workspace FOR UPDATE, membership, document, grant. Local p50 3.630625ms/p95 5.077667ms. Another account's read of same Workspace does not finish within 250ms while first read transaction is held (observation 250.862125ms); it succeeds after release. build/reports/authorization/baseline-*.txt contains SQL/probe. No production throughput claim; latency across isolated runs may vary.

E1 RED: phase=lean query regression failed on unchanged code (all 40 calls execute 8, expected 5). After lean mandatory-transaction Identity guard, targeted Authorization/Identity/Workspace/Document/YouTube suites passed in 43s. All 40 reads now execute 5 SQL, no email/password/identity fetches; local p50 2.513959ms/p95 4.467833ms. Held-reader contention still present by design (E1 keeps exclusive locks). Added direct guard outside transaction rejection and invalidated-session denial.

E1 gate: ./gradlew check --no-daemon passed in 1m47s; XML 92 tests/16 suites, failures/errors/skipped=0. Ready for scoped local checkpoint then E2. Full check repeats lean SQL/probe; no strict latency threshold.

E2 RED: phase=shared held-read probe fails on E1 code because second reader remains blocked. After shared guards, Authorization/Identity/Workspace/Document/Setlist/Export/YouTube targeted suites pass in 1m. Expanded Authorization suite (9 tests) passes in 18s; read-first OPEN→RESTRICTED, writer-first Grant revoke, writer-first membership remove + fresh rejoin, read-first password change/withdrawal, same-account simultaneous readers, exclusive command snapshot SQL and mixed reads/writes verified. Added rollback and OPEN-read-no-Grant regressions; Authorization/Document/Audit batch passes in 31s. Mixed sample 300 reads+25 changes completes in 0.301582084s (~1077.65 combined ops/s, read p50 2.232833ms/p95 6.769708ms), no lost versions. Local synthetic fixture only, no baseline mixed-load comparison or production capacity claim. Index/Authorization/Workspace/Document/schema batch passes in 36s: 50 ENDED histories +1 ACTIVE, EXPLAIN uses existing active_membership unique index with rows estimate 1. No DDL. E2 full gate subsequently passed (below).

E2 full ./gradlew check --no-daemon passed in 1m43s, 101 tests/16 suites, failures/errors/skips=0. E2 checkpoint 93dd086. Final ./gradlew clean check --no-daemon passed in 1m48s (all 5 tasks executed), same 101/16 zero failures/errors/skips including 12 new Authorization tests. Schema remains 25 tables/166 columns/37 FK/23 CHECK names. Local links/fences/whitespace and reader-schema coverage checked.

## Decision Log
Chosen low-risk staged refinement: slim queries first, shared account/Workspace locks for pure reads next. Lock-free multi-query reads can alter race guarantees; cache adds invalidation and operational costs; narrower document-level mutation locks require broader lifecycle redesign. Neither is needed for this task. Shared locks allow readers to overlap but still block mutations and are not an absolute optimum.

Use the existing generated active_user column (read-only JPA mapping) to target UNIQUE(workspace_id,active_user) in active membership lookup. Avoid new DDL/indexes and history scans; keep ACTIVE predicate. OPEN READ returns after account/membership/document authorization without unused Grant lookup; EDIT/MANAGE still require Grant. Setlist getForCommand and Identity getForChange require an existing transaction and retain exclusive guards, whereas ordinary getters use shared guards. No READ→WRITE lock promotion is introduced in command call graphs.

## Surprises / Discoveries
Baseline IdentityService.get built full AccountView even for member checks; WorkspaceStore.workspace always locked exclusively. Shared-read/write guard split now preserves mutation/lifecycle protection. Export/Playlist used ordinary Setlist.get for command snapshots; now explicit getForCommand prevents shared→exclusive promotion in those call graphs. Existing generated active_user unique index can bound active lookup without new DDL.

## Failures / Recovery
None yet.

## Unresolved High-impact Decisions
None for this scoped optimization. Existing D-02..05 and G-08 remain unchanged. Authorization commit order preserved; network responses/downloaded content cannot be recalled by DB transactions.

## Handoff State
Complete. E1 a276c40, E2 93dd086, final clean 101/16 green. Core plan/PROJECT/architecture/auth-flows/assurance refreshed; final local evidence checkpoint follows. No external changes. D-02..05 and G-08 remain separate follow-ups; do not automatically implement policy answers or claim production performance readiness.

## Outcomes
Delivered lean mandatory authentication guards, concurrent shared pure reads, retained exclusive mutation/command boundaries, OPEN read Grant short-circuit and existing-index membership lookup. No cache/roles/DDL/isolation change/external effects. Baseline actual direct read SQL 8; after restricted 5/Open 4. Final clean sample (40 reads/5 warmups): restricted p50 1.304583ms/p95 1.8345ms vs baseline 3.630625/5.077667ms; different isolated runs, not a controlled percentage speedup. Held first read: baseline second reader waits beyond 250ms; after completes before release (1.526667ms observation). Final mixed 300 reads+25 changes: 0.305883209s, ~1062.50 combined ops/s, read p50 2.194667ms/p95 7.144417ms, all complete with exact final version. No before mixed-load benchmark/production capacity claim. 50 ended+1 active histories EXPLAIN selects existing active_membership with estimated rows=1 (estimate, not actual row-count instrumentation). Shared guards still delay mutations; workspace-wide mutation serialization, item expansion queries, large/production workloads remain unoptimized/unmeasured. HTTP session plumbing is excluded from direct capability SQL count. Existing race/permission/migration/provider/HTTP E2E gates reverified.
