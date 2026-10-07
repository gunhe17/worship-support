# ExecPlan Rules

An ExecPlan is a living implementation specification for substantial work.
Use it when work spans multiple components or milestones, involves meaningful uncertainty or risk,
or would be expensive to reconstruct if the current Codex session ended.

Do not create an ExecPlan for small, local, obvious changes.

## Location

Active ExecPlans live under:

`.agent/plans/active/<short-name>.md`

For this project's initial V1 Core Backend implementation, use:

`.agent/plans/active/core-backend-v1.md`

## Core requirement

A fresh Codex session with only the repository and the active ExecPlan must be able to resume the work safely.
Do not rely on prior chat history or `/compact` for critical project knowledge.

## Required sections

# <Outcome-oriented title>

## Purpose
State the observable system outcome this plan delivers.

## Scope
State what is included and explicitly excluded.

## Relevant Design
Reference the exact `PROJECT_DESIGN.md` sections, invariants, and constraints that govern this work.
Do not duplicate the full design document.

## Progress
Maintain a concise checklist of completed, current, and remaining milestones.
Update this at material stopping points.

## Plan
Break work into meaningful milestones that each produce verifiable progress.
For each milestone describe:
- intended outcome;
- implementation boundary;
- required proof.

## Verification
Record targeted checks used during iteration and milestone/full-gate commands.
Never treat skipped or unavailable required verification as passed.

## Decision Log
Record consequential technical decisions made during implementation:
- decision;
- concrete requirement or evidence;
- relevant alternatives;
- rationale;
- reversibility or migration implications when material.

Do not record trivial implementation preferences.

## Surprises / Discoveries
Record repository, framework, runtime, or provider facts that materially alter the implementation approach.

## Failures / Recovery
Record only failures whose evidence and lesson prevent repeated wasted work.

## Unresolved High-impact Decisions
If a Personal Harness Core DECISION condition is reached:
- record the issue here;
- add a concise entry to `PROJECT.md`;
- stop only the dependent path;
- continue independent work when safe;
- do not invent product/security policy.

## Handoff State
Before a substantial pause, context reset, or fresh session, record:
- exact current milestone and state;
- last verification and result;
- unresolved defects/blockers;
- next executable step.

## Outcomes
At completion record:
- delivered behavior;
- final verification evidence;
- remaining known limitations.

## Operating rules

- Treat the ExecPlan as a living document and keep it current while implementing.
- Do not ask the user to approve routine milestones.
- After a milestone satisfies its completion evidence and required gate, proceed to the next milestone autonomously.
- Keep the plan concise enough to remain useful context.
- `PROJECT_DESIGN.md` remains the product/domain/architecture source of truth.
- `PROJECT.md` remains the human-facing status and high-impact decision surface.
- The ExecPlan must not silently redefine locked product policy.
- Do not use `/compact` as the only mechanism for preserving work state.
