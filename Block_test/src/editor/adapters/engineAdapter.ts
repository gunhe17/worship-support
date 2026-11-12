import type { OpRejection } from '../../engine/client/clientRuntime';
import type { SimulationEngine } from '../../engine/engine';
import type { StructureOp } from '../../engine/protocol';
import type { UserId } from '../../engine/types';
import { elementsOf } from '../model/documentModel';
import { kindDef, type PlacementPath } from '../model/elementRegistry';
import type { EditorIntent, EditorPort, IntentResult, LocalStatePatch } from '../model/intents';
import { jsonEqual } from '../model/jsonPath';
import { readBlockProperty, readPlacement, type ElementCreateOp, type PropertyUpdateOp } from '../model/ops';
import { remapIds } from '../model/remap';
import { renderView, type ReplicaState } from '../model/replica';
import { checkChange, pushUndo, type Change, type PropertyChange, type StructureChange, type UndoEntry } from '../model/undo';
import { clampPosition, nextFlowPosition, restoreSnapshot } from './localAdapter';

/**
 * Engine Adapter.
 * - 속성: EditorIntent → PROPERTY_UPDATE → engine.submitOp (Optimistic → Lock → 서버 승인/거부)
 * - 구조: 요소 추가·삭제·순서 변경 → ELEMENT_* → engine.submitStructure (Optimistic → 템플릿 직렬 처리 → 즉시 저장)
 *   새 요소는 임시 ID(local-E1)로 즉시 표시하고, 서버 승인 시 서버 ID(E002)로 바뀐다.
 * - 거부되면 해당 작업만 pendingOps에서 빠지고, 기록한 Undo 항목도 정리한다.
 * - 명시적 저장(버전 생성)과 복원은 Phase 5에서 연결된다.
 */

export interface AdapterNotice {
  userId: UserId;
  tone: 'warning' | 'danger' | 'info' | 'success';
  title: string;
  detail: string;
  /** 사용자 언어 문구 (개발자 정보를 끈 화면용). 없으면 title/detail 사용 */
  plain?: { title: string; detail?: string };
}

const REJECT_TITLES: Record<string, string> = {
  PROPERTY_LOCK_DENIED: 'Lock 거부',
  UNDO_CONFLICT: 'Undo 충돌',
  REVISION_CONFLICT: 'Revision 충돌',
  STRUCTURE_CONFLICT: '구조 변경 충돌',
  LOCK_NOT_HELD: 'Lock 없음',
  FENCING_TOKEN_STALE: 'Fencing Token 만료',
  DISCONNECTED: '연결 끊김',
  FORBIDDEN: '권한 없음',
  NOT_JOINED: '세션 미참여',
  TARGET_NOT_FOUND: '대상 없음',
  ELEMENT_LOCKED: '삭제 거부 · 편집 중',
  INVALID_NAME: '이름 변경 거부',
  DB_WRITE_FAILED: 'DB 저장 실패',
};

/** 거부 사유의 사용자 언어 문구 */
const PLAIN_REJECT: Record<string, string> = {
  INVALID_NAME: '템플릿 이름은 1~60자로 입력해 주세요',
  PROPERTY_LOCK_DENIED: '다른 사용자가 편집 중이라 반영하지 못했어요',
  ELEMENT_LOCKED: '다른 사용자가 편집 중이라 삭제할 수 없어요',
  UNDO_CONFLICT: '다른 사용자가 먼저 바꿔서 되돌릴 수 없어요',
  STRUCTURE_CONFLICT: '다른 사용자의 변경과 겹쳐 반영하지 못했어요',
  REVISION_CONFLICT: '다른 사용자의 변경과 겹쳐 반영하지 못했어요',
  DISCONNECTED: '연결이 끊겨 반영하지 못했어요',
};


type EntryRef = { userId: UserId; stack: 'undo' | 'redo'; entryId: string; change: Change };

export function createEngineAdapter(
  engine: SimulationEngine,
  onNotice: (n: AdapterNotice) => void = () => {},
): EditorPort & { dispose(): void } {
  const counters = new Map<string, number>();
  const nextId = (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}${n}`;
  };
  /** opId → 이 작업을 기록한 Undo 항목 (거부 시 정리용) */
  const opEntries = new Map<string, EntryRef>();

  const replicaOf = (userId: UserId) => engine.store.getState().clients[userId].replica;
  const updateReplica = (userId: UserId, fn: (r: ReplicaState) => ReplicaState) => engine.updateReplica(userId, fn);

  const offRejection = engine.onRejection((r: OpRejection) => {
    const owner = r.ownerUserId ? ` (소유자 ${r.ownerUserId})` : '';
    const what =
      r.op.type === 'PROPERTY_UPDATE' ? r.op.propertyPath : r.op.type === 'TEMPLATE_RENAME' ? `${r.op.type} "${r.op.name}"` : `${r.op.type} ${r.op.elementId}`;
    onNotice({
      userId: r.userId,
      tone: r.code === 'PROPERTY_LOCK_DENIED' || r.code === 'UNDO_CONFLICT' || r.code === 'STRUCTURE_CONFLICT' ? 'warning' : 'danger',
      title: `${r.userId} · ${REJECT_TITLES[r.code] ?? r.code}`,
      detail: `${what}: ${r.message}${owner}`,
      plain: { title: PLAIN_REJECT[r.code] ?? '변경을 반영하지 못했어요' },
    });
    // 거부된 작업의 Undo 기록 정리 (값이 반영되지 않았으므로)
    const rec = opEntries.get(r.op.opId);
    if (!rec) return;
    opEntries.delete(r.op.opId);
    updateReplica(rec.userId, (rep) => {
      const key = rec.stack === 'undo' ? 'undoStack' : 'redoStack';
      const stack = rep[key]
        .map((e) => (e.entryId === rec.entryId ? { ...e, changes: e.changes.filter((c) => !sameChange(c, rec.change)) } : e))
        .filter((e) => e.changes.length > 0);
      return { ...rep, [key]: stack };
    });
  });

  // 전체 초기화: 이전 세대의 Undo 추적과 임시 ID 순번을 버린다
  const offReset = engine.onReset(() => {
    opEntries.clear();
    counters.clear();
  });

  // 명시적 저장·복원 결과 알림
  const offVersion = engine.onVersionResult((userId, o, phase) => {
    if (phase === 'mismatch') {
      onNotice({
        userId,
        tone: 'warning',
        title: `CONTENT_MISMATCH ${o.mismatches?.length ?? 0}건`,
        detail: (o.mismatches ?? []).map((m) => `${m.blockId}: ${m.blockVersionId}와 Live 콘텐츠가 다름 (${m.fields.map((f) => f.path).join(', ')})`).join(' · '),
        plain: { title: '배치는 복원했고, 글 내용은 지금 내용을 유지했어요', detail: `${o.mismatches?.length ?? 0}개 요소의 내용이 그 버전과 달라요` },
      });
      return;
    }
    const what = o.kind === 'save' ? '저장' : '복원';
    if (!o.ok) {
      onNotice({ userId, tone: 'danger', title: `${userId} · ${what} 실패`, detail: `${o.code}: ${o.message ?? ''}`, plain: { title: `${what}하지 못했어요`, detail: o.message ?? undefined } });
      return;
    }
    if (o.code === 'NO_CHANGES') {
      onNotice({ userId, tone: 'info', title: `${userId} · 변경 없음`, detail: o.message ?? 'NO_CHANGES', plain: { title: '바뀐 내용이 없어 새 버전을 만들지 않았어요' } });
      return;
    }
    const detail =
      o.kind === 'save'
        ? `${o.templateVersionId} (v${o.version}) · block_version 신규 ${o.createdBlockVersions?.length ?? 0} · 재사용 ${o.reusedBlockVersions?.length ?? 0}`
        : `${o.preservedTemplateVersionId ? `복원 전 자동 저장 ${o.preservedTemplateVersionId} · ` : ''}${o.restoredFromVersionId} → ${o.templateVersionId} · 구성 전체 교체`;
    const plain =
      o.kind === 'save'
        ? { title: o.version !== undefined ? `v${o.version} 버전을 저장했어요` : '버전을 저장했어요' }
        : {
            title: '선택한 버전의 배치로 복원했어요',
            detail: o.preservedVersion !== undefined ? `복원 전 상태는 v${o.preservedVersion}로 저장해 두었어요` : undefined,
          };
    onNotice({ userId, tone: 'success', title: `${userId} · ${what} 완료`, detail, plain });
  });

  // 서버 ID 발급: 이 사용자의 Undo/Redo 기록과 추적 정보의 임시 ID를 치환
  const offIds = engine.onIdAssigned((userId, a) => {
    const map = new Map([
      [a.localElementId, a.elementId],
      [a.localBlockId, a.blockId],
    ]);
    updateReplica(userId, (r) => ({ ...r, undoStack: remapIds(r.undoStack, map), redoStack: remapIds(r.redoStack, map) }));
    for (const [opId, rec] of opEntries) if (rec.userId === userId) opEntries.set(opId, { ...rec, change: remapIds(rec.change, map) });
  });

  function recordUndo(userId: UserId, entry: UndoEntry): string {
    let entryId = entry.entryId;
    updateReplica(userId, (r) => {
      const undoStack = pushUndo(r.undoStack, entry);
      entryId = undoStack[undoStack.length - 1].entryId; // gesture 병합 시 기존 항목 ID
      return { ...r, undoStack, redoStack: [] };
    });
    return entryId;
  }

  function submitProperty(userId: UserId, op: PropertyUpdateOp, ref: Omit<EntryRef, 'userId'> | null, undo?: Parameters<SimulationEngine['submitOp']>[2]) {
    if (ref) opEntries.set(op.opId, { userId, ...ref });
    engine.submitOp(userId, op, undo);
  }

  function submitStructure(userId: UserId, op: StructureOp, ref: Omit<EntryRef, 'userId'> | null, undo?: Parameters<SimulationEngine['submitStructure']>[2]) {
    if (ref) opEntries.set(op.opId, { userId, ...ref });
    engine.submitStructure(userId, op, undo);
  }

  function dispatch(actor: UserId, intent: EditorIntent): IntentResult {
    const view = renderView(replicaOf(actor));
    const base = { actorUserId: actor };
    switch (intent.type) {
      case 'editProperty': {
        const block = view.blocks[intent.blockId];
        if (!block) return { ok: false, code: 'TARGET_NOT_FOUND', message: `${intent.blockId}을(를) 찾을 수 없습니다` };
        const before = readBlockProperty(block, intent.propertyPath) ?? null;
        if (jsonEqual(before, intent.value)) return { ok: false, code: 'NO_CHANGE', message: '변경 없음' };
        const op: PropertyUpdateOp = {
          ...base,
          opId: nextId('op-'),
          type: 'PROPERTY_UPDATE',
          target: { scope: 'block', blockId: block.blockId },
          propertyPath: intent.propertyPath,
          value: intent.value,
        };
        const change: PropertyChange = { kind: 'property', target: op.target, propertyPath: op.propertyPath, before, after: intent.value };
        const entryId = recordUndo(actor, { entryId: nextId('u-'), label: `${intent.propertyPath} 변경`, gestureId: intent.gestureId ?? null, changes: [change] });
        submitProperty(actor, op, { stack: 'undo', entryId, change });
        return { ok: true };
      }

      case 'editPlacement': {
        const el = view.elements[intent.elementId];
        if (!el) return { ok: false, code: 'TARGET_NOT_FOUND', message: `${intent.elementId}을(를) 찾을 수 없습니다` };
        const target = { scope: 'element' as const, templateId: intent.templateId, elementId: el.elementId };
        const items: { op: PropertyUpdateOp; change: PropertyChange }[] = [];
        for (const [path, raw] of Object.entries(intent.changes) as [PlacementPath, number][]) {
          const value = Math.round(raw);
          const before = readPlacement(el, path);
          if (before === value) continue;
          items.push({
            op: { ...base, opId: nextId('op-'), type: 'PROPERTY_UPDATE', target, propertyPath: path, value },
            change: { kind: 'property', target, propertyPath: path, before, after: value },
          });
        }
        if (items.length === 0) return { ok: false, code: 'NO_CHANGE', message: '변경 없음' };
        const entryId = recordUndo(actor, { entryId: nextId('u-'), label: '배치 변경', gestureId: intent.gestureId ?? null, changes: items.map((i) => i.change) });
        for (const i of items) submitProperty(actor, i.op, { stack: 'undo', entryId, change: i.change });
        return { ok: true };
      }

      case 'addElement': {
        const def = kindDef(intent.kind);
        const { width, height } = intent.size ?? def.defaultSize;
        const position = intent.position ?? nextFlowPosition(view, intent.templateId, width, height);
        const elementId = nextId('local-E');
        const op: ElementCreateOp = {
          ...base,
          opId: nextId('op-'),
          type: 'ELEMENT_CREATE',
          templateId: intent.templateId,
          elementId,
          blockId: nextId('local-B'),
          kind: intent.kind,
          content: intent.content ? structuredClone(intent.content) : def.defaultContent(),
          props: { position: clampPosition(position, width, height), size: { width, height } },
          renderZone: 'main',
        };
        const change: StructureChange = {
          kind: 'structure',
          forward: op,
          inverse: { ...base, opId: nextId('op-'), type: 'ELEMENT_DELETE', templateId: intent.templateId, elementId },
        };
        const entryId = recordUndo(actor, { entryId: nextId('u-'), label: `${def.label} ${intent.content ? '붙여넣기' : '추가'}`, gestureId: intent.gestureId ?? null, changes: [change] });
        submitStructure(actor, op, { stack: 'undo', entryId, change });
        return { ok: true, createdElementId: elementId };
      }

      case 'deleteElement': {
        const snapshot = restoreSnapshot(view, intent.templateId, intent.elementId, actor, nextId('op-'));
        if (!snapshot) return { ok: false, code: 'TARGET_NOT_FOUND', message: `${intent.elementId}을(를) 찾을 수 없습니다` };
        const op: StructureOp = { ...base, opId: nextId('op-'), type: 'ELEMENT_DELETE', templateId: intent.templateId, elementId: intent.elementId };
        const change: StructureChange = { kind: 'structure', forward: op, inverse: snapshot };
        const entryId = recordUndo(actor, { entryId: nextId('u-'), label: '요소 삭제', gestureId: null, changes: [change] });
        submitStructure(actor, op, { stack: 'undo', entryId, change });
        return { ok: true };
      }

      case 'reorderElement': {
        const list = elementsOf(view, intent.templateId);
        const from = list.findIndex((e) => e.elementId === intent.elementId);
        if (from < 0) return { ok: false, code: 'TARGET_NOT_FOUND', message: `${intent.elementId}을(를) 찾을 수 없습니다` };
        const toIndex = Math.max(0, Math.min(intent.toIndex, list.length - 1));
        if (toIndex === from) return { ok: false, code: 'NO_CHANGE', message: '순서 변경 없음' };
        const mk = (idx: number) =>
          ({ ...base, opId: nextId('op-'), type: 'ELEMENT_REORDER', templateId: intent.templateId, elementId: intent.elementId, toIndex: idx }) as const;
        const forward = mk(toIndex);
        const change: StructureChange = { kind: 'structure', forward, inverse: mk(from) };
        const entryId = recordUndo(actor, { entryId: nextId('u-'), label: '순서 변경', gestureId: null, changes: [change] });
        submitStructure(actor, forward, { stack: 'undo', entryId, change });
        return { ok: true };
      }

      case 'renameTemplate': {
        const template = view.templates[intent.templateId];
        if (!template) return { ok: false, code: 'TARGET_NOT_FOUND', message: `${intent.templateId}을(를) 찾을 수 없습니다` };
        const name = intent.name.trim();
        if (!name || name.length > 60) return { ok: false, code: 'INVALID_NAME', message: '템플릿 이름은 1~60자로 입력해 주세요' };
        if (name === template.name) return { ok: false, code: 'NO_CHANGE', message: '이름 변경 없음' };
        const mk = (next: string, prev: string) =>
          ({ ...base, opId: nextId('op-'), type: 'TEMPLATE_RENAME', templateId: intent.templateId, name: next, previousName: prev }) as const;
        const forward = mk(name, template.name);
        const change: StructureChange = { kind: 'structure', forward, inverse: mk(template.name, name) };
        const entryId = recordUndo(actor, { entryId: nextId('u-'), label: '템플릿 이름 변경', gestureId: null, changes: [change] });
        submitStructure(actor, forward, { stack: 'undo', entryId, change });
        return { ok: true };
      }

      case 'endEdit':
        engine.endEdit(actor);
        return { ok: true };

      case 'undo':
      case 'redo':
        return runHistory(actor, intent.type);

      case 'save':
        engine.requestSave(actor, intent.templateId);
        return { ok: true };

      case 'restoreVersion':
        engine.requestRestore(actor, intent.templateId, intent.versionId);
        return { ok: true };
    }
  }

  /** Undo/Redo = 새 편집 명령 (§8.4). 클라이언트 사전 검증 + 서버 검증(UNDO_CONFLICT) */
  function runHistory(actor: UserId, direction: 'undo' | 'redo'): IntentResult {
    const replica = replicaOf(actor);
    const stack = direction === 'undo' ? replica.undoStack : replica.redoStack;
    const entry = stack[stack.length - 1];
    if (!entry)
      return direction === 'undo'
        ? { ok: false, code: 'NOTHING_TO_UNDO', message: '되돌릴 작업이 없습니다' }
        : { ok: false, code: 'NOTHING_TO_REDO', message: '다시 실행할 작업이 없습니다' };
    const popped = stack.slice(0, -1);
    const view = renderView(replica);
    for (const change of entry.changes) {
      const check = checkChange(view, change, direction, actor);
      if (!check.ok) {
        updateReplica(actor, (r) => (direction === 'undo' ? { ...r, undoStack: popped } : { ...r, redoStack: popped }));
        return { ok: false, code: 'UNDO_CONFLICT', message: check.reason ?? '충돌' };
      }
    }

    const ordered = direction === 'undo' ? [...entry.changes].reverse() : entry.changes;
    const movedId = nextId('u-');
    const nextStack = direction === 'undo' ? 'redo' : 'undo';
    const submissions: (() => void)[] = [];
    const movedChanges: Change[] = [];
    let touchedProperty = false;
    for (const change of ordered) {
      if (change.kind === 'property') {
        touchedProperty = true;
        const value = direction === 'undo' ? change.before : change.after;
        const expectedCurrent = direction === 'undo' ? change.after : change.before;
        const op = {
          opId: nextId('op-'),
          actorUserId: actor,
          undoDirection: direction,
          type: 'PROPERTY_UPDATE',
          target: change.target,
          propertyPath: change.propertyPath,
          value,
        } as PropertyUpdateOp;
        movedChanges.push(change);
        submissions.push(() => submitProperty(actor, op, { stack: nextStack, entryId: movedId, change }, { direction, expectedCurrent }));
        continue;
      }
      const template = direction === 'undo' ? change.inverse : change.forward;
      const op = { ...template, opId: nextId('op-'), actorUserId: actor, undoDirection: direction } as StructureOp;
      let forward = change.forward;
      // 생성을 되돌린 뒤의 Redo는 재생성이 아니라 ELEMENT_RESTORE (같은 요소·블록 ID 유지, §8.5)
      if (direction === 'undo' && change.forward.type === 'ELEMENT_CREATE') {
        const snap = restoreSnapshot(view, change.forward.templateId, change.forward.elementId, actor, nextId('op-'));
        if (snap) forward = snap;
      }
      const moved: StructureChange = { kind: 'structure', forward, inverse: change.inverse };
      movedChanges.push(moved);
      const other = direction === 'undo' ? change.forward : change.inverse;
      const expectedIndex =
        op.type === 'ELEMENT_REORDER' && other.type === 'ELEMENT_REORDER' ? other.toIndex : undefined;
      submissions.push(() => submitStructure(actor, op, { stack: nextStack, entryId: movedId, change: moved }, { direction, expectedIndex }));
    }

    const moved: UndoEntry = { ...entry, entryId: movedId, changes: direction === 'undo' ? [...movedChanges].reverse() : movedChanges };
    updateReplica(actor, (r) =>
      direction === 'undo'
        ? { ...r, undoStack: popped, redoStack: [...r.redoStack, moved] }
        : { ...r, redoStack: popped, undoStack: [...r.undoStack, moved] },
    );
    for (const submit of submissions) submit();
    // 속성 Undo는 한 번의 명령으로 끝나므로 처리 요청 뒤 Lock을 해제한다 (§8.10.5)
    if (touchedProperty) engine.endEdit(actor);
    return { ok: true, message: `${direction === 'undo' ? '실행 취소' : '다시 실행'} 요청: ${entry.label}` };
  }

  function updateLocal(actor: UserId, patch: LocalStatePatch): void {
    engine.updateLocal(actor, patch);
  }

  return {
    mode: 'engine',
    dispatch,
    updateLocal,
    dispose: () => {
      offRejection();
      offIds();
      offVersion();
      offReset();
    },
  };
}

function sameChange(a: Change, b: Change): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'structure') return JSON.stringify(a.forward) === JSON.stringify((b as StructureChange).forward);
  const p = b as PropertyChange;
  if (a.propertyPath !== p.propertyPath || a.target.scope !== p.target.scope) return false;
  return a.target.scope === 'block'
    ? a.target.blockId === (p.target as { blockId: string }).blockId
    : a.target.elementId === (p.target as { elementId: string }).elementId;
}
