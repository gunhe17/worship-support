import type { Json, UserId } from '../../engine/types';
import type { DocumentView } from './documentModel';
import { elementsOf } from './documentModel';
import type { PlacementPath } from './elementRegistry';
import { jsonEqual } from './jsonPath';
import {
  readBlockProperty,
  readPlacement,
  type EditorOp,
  type ElementCreateOp,
  type ElementDeleteOp,
  type ElementRestoreOp,
} from './ops';

/**
 * Undo/Redo (DB_SCHEMA.md §8.4).
 * Undo는 DB 롤백이 아니라 역방향 편집 명령을 새로 발생시킨다.
 */

export type PropertyTarget =
  | { scope: 'block'; blockId: string }
  | { scope: 'element'; templateId: string; elementId: string };

export interface PropertyChange {
  kind: 'property';
  target: PropertyTarget;
  propertyPath: string;
  before: Json;
  after: Json;
}

export interface StructureChange {
  kind: 'structure';
  /** 적용된 명령 */
  forward: ElementCreateOp | ElementDeleteOp | ElementRestoreOp | Extract<EditorOp, { type: 'ELEMENT_REORDER' | 'TEMPLATE_RENAME' }>;
  /** 되돌리기 명령 */
  inverse: ElementCreateOp | ElementDeleteOp | ElementRestoreOp | Extract<EditorOp, { type: 'ELEMENT_REORDER' | 'TEMPLATE_RENAME' }>;
}

export type Change = PropertyChange | StructureChange;

export interface UndoEntry {
  entryId: string;
  label: string;
  gestureId: string | null;
  changes: Change[];
}

const targetKey = (c: PropertyChange) =>
  c.target.scope === 'block'
    ? `block:${c.target.blockId}:${c.propertyPath}`
    : `element:${c.target.elementId}:${c.propertyPath}`;

/**
 * 같은 gesture(연속 타이핑, 드래그)는 하나의 항목으로 합친다.
 * 속성별로 최초 before와 최신 after를 유지한다.
 */
export function pushUndo(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const top = stack[stack.length - 1];
  if (!top || !entry.gestureId || top.gestureId !== entry.gestureId) return [...stack, entry];

  const merged = [...top.changes];
  for (const change of entry.changes) {
    if (change.kind !== 'property') {
      merged.push(change);
      continue;
    }
    const idx = merged.findIndex((c) => c.kind === 'property' && targetKey(c) === targetKey(change));
    if (idx >= 0) merged[idx] = { ...(merged[idx] as PropertyChange), after: change.after };
    else merged.push(change);
  }
  return [...stack.slice(0, -1), { ...top, changes: merged }];
}

export function readTargetValue(
  view: DocumentView,
  target: PropertyTarget,
  propertyPath: string,
): { value: Json | undefined; lastActorUserId: UserId | null } {
  if (target.scope === 'block') {
    const block = view.blocks[target.blockId];
    if (!block) return { value: undefined, lastActorUserId: null };
    return {
      value: readBlockProperty(block, propertyPath),
      lastActorUserId: block.properties[propertyPath]?.lastActorUserId ?? null,
    };
  }
  const el = view.elements[target.elementId];
  if (!el) return { value: undefined, lastActorUserId: null };
  return {
    value: readPlacement(el, propertyPath as PlacementPath),
    lastActorUserId: el.properties[propertyPath]?.lastActorUserId ?? null,
  };
}

export interface UndoCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Undo/Redo 충돌 검증 (§8.4).
 * - 속성: 현재 값이 기대값(Undo면 after, Redo면 before)과 같고, 마지막 수정자가 본인이어야 한다.
 * - 구조: 대상 요소의 존재 여부/순서가 기대와 같아야 한다.
 */
export function checkChange(
  view: DocumentView,
  change: Change,
  direction: 'undo' | 'redo',
  actorUserId: UserId,
): UndoCheck {
  if (change.kind === 'property') {
    const expected = direction === 'undo' ? change.after : change.before;
    const current = readTargetValue(view, change.target, change.propertyPath);
    if (current.value === undefined) return { ok: false, reason: '대상 요소가 존재하지 않습니다' };
    if (current.lastActorUserId !== null && current.lastActorUserId !== actorUserId)
      return { ok: false, reason: `다른 사용자(${current.lastActorUserId})가 ${change.propertyPath}을(를) 먼저 변경했습니다` };
    if (!jsonEqual(current.value, expected))
      return { ok: false, reason: `${change.propertyPath}의 현재 값이 기록과 다릅니다` };
    return { ok: true };
  }

  const op = direction === 'undo' ? change.inverse : change.forward;
  // 이름 변경: 현재 이름이 기록과 같을 때만 되돌린다 (다른 사용자가 먼저 바꿨으면 충돌)
  if (op.type === 'TEMPLATE_RENAME') {
    const current = view.templates[op.templateId]?.name;
    if (current === undefined) return { ok: false, reason: '템플릿이 존재하지 않습니다' };
    return current === op.previousName ? { ok: true } : { ok: false, reason: '다른 사용자가 템플릿 이름을 먼저 바꿨습니다' };
  }
  const exists = Boolean(view.elements[op.elementId]);
  switch (op.type) {
    case 'ELEMENT_DELETE':
      return exists ? { ok: true } : { ok: false, reason: '요소가 이미 삭제되었습니다' };
    case 'ELEMENT_RESTORE':
    case 'ELEMENT_CREATE':
      return exists ? { ok: false, reason: '요소가 이미 존재합니다' } : { ok: true };
    case 'ELEMENT_REORDER': {
      const other = direction === 'undo' ? change.forward : change.inverse;
      const expectedIndex = other.type === 'ELEMENT_REORDER' ? other.toIndex : -1;
      const ordered = elementsOf(view, op.templateId);
      const idx = ordered.findIndex((e) => e.elementId === op.elementId);
      if (idx < 0) return { ok: false, reason: '요소가 존재하지 않습니다' };
      return idx === expectedIndex ? { ok: true } : { ok: false, reason: '다른 변경으로 요소 순서가 바뀌었습니다' };
    }
  }
}
