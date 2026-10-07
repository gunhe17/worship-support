# Make the service and development Harness reviewable across the team

Historical plan: exported reader artifacts were removed at the user's request on 2026-10-07. Use Design/PROJECT and backend-v1-team-ready.md for current work; do not recreate or recommend the old snapshots/ERD.

## Purpose
Provide one self-contained, detailed Markdown context document and a companion prompt for a fresh ChatGPT review, without presenting prior test success as proof of architectural optimality.

## Scope
Read-only architecture/schema diagnosis; documentation consolidation, current/historical evidence separation, meeting context and tool-neutral Harness proposals. No application/schema optimization before discussion with the user. Preserve unrelated dirty Java files and existing document edits. No provider calls, remote/push, operational deletion, or automatic Claude/Codex configuration migration.

## Relevant Design
PROJECT_DESIGN §§1–8, 10–12 govern product scope, tenancy, identity/authorization, concurrency, provider boundaries, gates and Design Lock. AGENTS.md and .agent/PLANS.md govern priority and recovery. User request 2026-10-07 requires full context, no omissions through summarization, and discussion before optimization.

## Progress
- [x] Inventory current docs, dirty worktree, schema and recorded gates
- [x] Compare design, implementation, evidence and current tool documentation
- [x] Write complete review context and dialogue/research prompt
- [x] Remove redundant pointers/duplicate diagram field listing; fix stale claims and links
- [x] Verify field/contract/source coverage, fences/links and preserved non-document changes
- [x] Record outcomes and unresolved team decisions

## Plan
1. Inspect all relevant design/current-state/readers, code dependencies, migrations and test evidence. Distinguish verified historical baseline from unverified dirty source.
2. Build a self-contained review export with narrative, complete original policy/harness/reader/schema/API/config/evidence appendices and explicit source precedence. Exports are snapshots, never a competing policy source.
3. Keep four topical guides; remove redundant ontology/meeting redirect files after checking inbound links. Reduce diagram.md to visual entry/legend rather than a duplicate field dictionary. Keep ERD/manifest/OpenAPI and unique evidence. Leave completed ExecPlans at instructed locations, labeled historical where applicable.
4. Supply a prompt preserving all meeting concerns, requiring evidence-ranked critique, alternatives/costs/safety, small conversational steps and no automatic policy decisions.
5. Check docs only. Do not run/claim new full code gate because unrelated source is dirty; record prior 101/16 gate as historical, not current worktree validation.

## Verification
Local Markdown targets/fences, JSON/YAML source counts, all 25 tables/166 fields/37 FK/23 CHECK names in snapshot, all shipped API contract lines retained, source appendices mechanically equal originals, git diff --check for touched docs and unchanged dirty Java hashes. No new code test result is claimed.

2026-10-07: 40 complete source blocks byte-equal originals (547153 source bytes), including full Design/PROJECT/AGENTS/PLANS, four readers, assurance, manifest, build/config, four historical ExecPlans, all V1–V12 migrations, full OpenAPI and eight representative current Java files. JSON schema counts 25/166/37/23; YAML inventory 60 paths/71 operations/48 schemas. Test method/cross-feature import inventory appended with explicit limitations. Technical Flyway table 10 fields included separately. 20 Markdown files/87 local link targets and fences valid; scoped git diff --check passes. Pre-existing dirty Java SHA-256 remain AccountLifecycle 47ec052b63d2787323a6389a4f5245376aca125fb5b5f41cf18c151d280324bc; IdentityService 767a6c7c7070bb2d4d8038b5650769d4b77070ee74387f3dc55d995c80f3b4ac; YouTubeAuthorizationService d24c72f42744ddb4fb1504001184cb73de0ee8e4e7d8528c87a7469018cc3456. No new Gradle gate/operational/independent-review result claimed.

## Decision Log
Prefer a single disposable export to manual long-lived copies. Preserve unique policy/evidence; remove only identified redundant documentation. Tool-specific loaders are not product authorization and are not equivalent across Codex/Claude Code.

Verified official Codex AGENTS discovery and Claude Memory/import/paths behavior using the openai-docs skill and provider documentation. Record loader facts separately from proposed common Harness; no CLAUDE/settings/AGENTS loader changes. Keep completed ExecPlans at existing linked paths (Core path explicitly required by AGENTS), add historical banners rather than move/break recovery links. Remove ontology/meeting redirect-only files after verifying no current inbound file links; preserve domain explanations/team context elsewhere. Replace duplicated schema-diagram field dictionary with a short visual ERD entry, retain schema/manifest/DDL/SVG for their distinct roles. Correct stale root README and Design's None status with PROJECT pointer, not new policy. Capture full API despite length; prompt must report reading scope rather than pretend all attachment content fits one context window.

## Surprises / Discoveries
At start, three Java files have pre-existing uncommitted changes; current working tree has not been proven by the historical 2026-10-03 clean gate. Root README still incorrectly says resolved OpenAPI/Audit/DB CHECK gaps need follow-up. PROJECT_DESIGN ends with 'Human Decisions Remaining: None' despite PROJECT D-02–05. These need current-status pointers, not invented answers.

## Failures / Recovery
Chunked snapshot insertion added blank lines at 500-line boundaries in Design/schema/OpenAPI. Byte-equality check found only these three mismatches; replaced their source block contents with exact concatenated originals and reverified all 40. Do not insert separator whitespace inside raw source chunks. One attempted no-op architecture replacement did not match the full paragraph; no change was applied; later inserted a scoped current-status note at its actual section heading.

Staged whitespace check (untracked exports are not checked by ordinary git diff) found two original Markdown hard-break trailing spaces inside raw copies. A documentation checkpoint had already been created before noticing the failed result; a forward correction replaces those two status hard breaks with explicit <br> in originals and their snapshot, refreshes both source hashes/byte counts, and reruns staged checks. No policy meaning changed, no history rewrite.

## Unresolved High-impact Decisions
Team repository topology, actual Claude rule files/globs/tool versions, feature ownership, integration definition of done, traffic/cost targets and newly mentioned product requirements are not supplied. Record as unknown; do not infer architecture changes. Existing D-02–05/G-08 remain.

## Handoff State
Historical handoff only. The user subsequently requested removal of the review snapshot, prompt and duplicate reader artifacts. Current reading routes are root README Reader guides and backend-v1-team-ready.md, not old attachment instructions. Decisions/limitations are incorporated into Design/PROJECT/the five guides and existing plans. Preserve the three unrelated dirty Java files; structure optimization remains discussion-first.

## Outcomes
Delivered a detailed Korean narrative retaining all meeting concerns plus 40 complete source appendices, physical schema/field meanings, migrations, full HTTP contract, Harness and evidence. Companion prompt requests evidence-ranked independent critique across all 25 tables, architecture/cost/security, document/loader design, feature-team workflows and user's missed deliverables, with one-topic-at-a-time dialogue and a bounded first response. Four daily readers remain; two redundant redirects removed and ~600 repeated diagram lines consolidated. Stale completion/None statements corrected and historical evidence distinguished from dirty worktree. No application/schema/provider change; no new product decision. Limits: actual peer setup/repositories/meeting expectations/operating targets absent, full repository/test bodies not attached, historical tests not rerun, export must be refreshed after source changes.
