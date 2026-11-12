import type { SimulationEngine } from '../../engine/engine';
import type { UserId } from '../../engine/types';
import { elementsOf, type DocumentView } from '../model/documentModel';
import { kindDef, PAGE_SIZE, type PlacementPath } from '../model/elementRegistry';
import type { EditorIntent, EditorPort, IntentResult, LocalStatePatch } from '../model/intents';
import { jsonEqual } from '../model/jsonPath';
import { readBlockProperty, readPlacement, type EditorOp, type ElementRestoreOp } from '../model/ops';
import { addPendingOp, receiveDocument, removePendingOp, renderView, type ReplicaState } from '../model/replica';
import { checkChange, pushUndo, type Change, type StructureChange, type UndoEntry } from '../model/undo';
import type { Store } from '../store/createStore';
import type { EditorState } from '../store/editorState';
import { applyAuthoritative } from './localServer';

/**
 * Local Adapter (Phase 1~2).
 * EditorIntent → Op 변환, pendingOps 등록, 로컬 승인, 전체 replica 반영, Undo 기록까지
 * Engine Adapter와 같은 흐름을 동기적으로 수행한다.
 * - PostgreSQL, Redis는 변경하지 않는다. 공유 상태는 EditorState.live(로컬)만 사용한다.
 * - Client Replica는 엔진(ClientRuntime)이 소유하므로 engine.updateReplica로만 갱신한다.
 * - 선택·커서(로컬 UI 상태)는 engine.updateLocal → Presence(Pub/Sub)로 전파된다 (Phase 2).
 */
export function createLocalAdapter(store: Store<EditorState>, engine: SimulationEngine): EditorPort {
  const replicaOf = (userId: UserId) => engine.store.getState().clients[userId].replica;
  // 접두사별 독립 순번 (local-E1, local-B1, op-1 ...)
  const counters = new Map<string, number>();
  const nextId = (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}${n}`;
  };

  /** 서버 승인 + 모든 접속 replica에 즉시 전달 (Phase 1은 지연 없음) */
  function commit(actor: UserId, ops: EditorOp[]): void {
    let live = store.getState().live;
    const now = engine.store.getState().now;
    for (const op of ops) {
      updateReplica(actor, (r) => addPendingOp(r, op, now));
      live = applyAuthoritative(live, op, actor);
      updateReplica(actor, (r) => removePendingOp(r, op.opId));
    }
    store.setState((s) => ({ ...s, live }));
    for (const u of engine.users) {
      if (replicaOf(u.userId).connectionStatus !== 'connected') continue;
      updateReplica(u.userId, (r) => receiveDocument(r, live));
      // 삭제된 요소를 선택하고 있던 사용자는 선택 해제 (Presence에도 반영)
      const r = replicaOf(u.userId);
      if (r.selectedElementId && !r.documentView.elements[r.selectedElementId])
        engine.updateLocal(u.userId, { selectedElementId: null, selectedPropertyPath: null, localSelection: { editingElementId: null } });
    }
  }

  function updateReplica(actor: UserId, fn: (r: ReplicaState) => ReplicaState) {
    engine.updateReplica(actor, fn);
  }

  function recordUndo(actor: UserId, entry: UndoEntry) {
    updateReplica(actor, (r) => ({ ...r, undoStack: pushUndo(r.undoStack, entry), redoStack: [] }));
  }

  const viewOf = (actor: UserId): DocumentView => renderView(replicaOf(actor));

  function dispatch(actor: UserId, intent: EditorIntent): IntentResult {
    const view = viewOf(actor);
    const base = { actorUserId: actor };

    switch (intent.type) {
      case 'editProperty': {
        const block = view.blocks[intent.blockId];
        if (!block) return notFound(intent.blockId);
        const before = readBlockProperty(block, intent.propertyPath) ?? null;
        if (jsonEqual(before, intent.value)) return { ok: false, code: 'NO_CHANGE', message: '변경 없음' };
        commit(actor, [
          {
            ...base,
            opId: nextId('op-'),
            type: 'PROPERTY_UPDATE',
            target: { scope: 'block', blockId: block.blockId },
            propertyPath: intent.propertyPath,
            value: intent.value,
          },
        ]);
        recordUndo(actor, {
          entryId: nextId('u-'),
          label: `${intent.propertyPath} 변경`,
          gestureId: intent.gestureId ?? null,
          changes: [
            { kind: 'property', target: { scope: 'block', blockId: block.blockId }, propertyPath: intent.propertyPath, before, after: intent.value },
          ],
        });
        return { ok: true };
      }

      case 'editPlacement': {
        const el = view.elements[intent.elementId];
        if (!el) return notFound(intent.elementId);
        const target = { scope: 'element' as const, templateId: intent.templateId, elementId: el.elementId };
        const ops: EditorOp[] = [];
        const changes: Change[] = [];
        for (const [path, raw] of Object.entries(intent.changes) as [PlacementPath, number][]) {
          const value = Math.round(raw);
          const before = readPlacement(el, path);
          if (before === value) continue;
          ops.push({ ...base, opId: nextId('op-'), type: 'PROPERTY_UPDATE', target, propertyPath: path, value });
          changes.push({ kind: 'property', target, propertyPath: path, before, after: value });
        }
        if (ops.length === 0) return { ok: false, code: 'NO_CHANGE', message: '변경 없음' };
        commit(actor, ops);
        recordUndo(actor, { entryId: nextId('u-'), label: '배치 변경', gestureId: intent.gestureId ?? null, changes });
        return { ok: true };
      }

      case 'addElement': {
        const def = kindDef(intent.kind);
        const { width, height } = intent.size ?? def.defaultSize;
        const position = intent.position ?? nextFlowPosition(view, intent.templateId, width, height);
        const elementId = nextId('local-E');
        const op: EditorOp = {
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
        commit(actor, [op]);
        recordUndo(actor, {
          entryId: nextId('u-'),
          label: `${def.label} ${intent.content ? '붙여넣기' : '추가'}`,
          gestureId: intent.gestureId ?? null,
          changes: [
            {
              kind: 'structure',
              forward: op,
              inverse: { ...base, opId: nextId('op-'), type: 'ELEMENT_DELETE', templateId: intent.templateId, elementId },
            },
          ],
        });
        return { ok: true, createdElementId: elementId };
      }

      case 'deleteElement': {
        const snapshot = restoreSnapshot(view, intent.templateId, intent.elementId, actor, nextId('op-'));
        if (!snapshot) return notFound(intent.elementId);
        const op: EditorOp = { ...base, opId: nextId('op-'), type: 'ELEMENT_DELETE', templateId: intent.templateId, elementId: intent.elementId };
        commit(actor, [op]);
        recordUndo(actor, {
          entryId: nextId('u-'),
          label: '요소 삭제',
          gestureId: null,
          changes: [{ kind: 'structure', forward: op, inverse: snapshot }],
        });
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
        commit(actor, [forward]);
        recordUndo(actor, { entryId: nextId('u-'), label: '템플릿 이름 변경', gestureId: null, changes: [change] });
        return { ok: true };
      }

      case 'reorderElement': {
        const ordered = elementsOf(view, intent.templateId);
        const from = ordered.findIndex((e) => e.elementId === intent.elementId);
        if (from < 0) return notFound(intent.elementId);
        const toIndex = Math.max(0, Math.min(intent.toIndex, ordered.length - 1));
        if (toIndex === from) return { ok: false, code: 'NO_CHANGE', message: '순서 변경 없음' };
        const mk = (idx: number): EditorOp => ({
          ...base,
          opId: nextId('op-'),
          type: 'ELEMENT_REORDER',
          templateId: intent.templateId,
          elementId: intent.elementId,
          toIndex: idx,
        });
        const forward = mk(toIndex) as StructureChange['forward'];
        commit(actor, [forward]);
        recordUndo(actor, {
          entryId: nextId('u-'),
          label: '순서 변경',
          gestureId: null,
          changes: [{ kind: 'structure', forward, inverse: mk(from) as StructureChange['inverse'] }],
        });
        return { ok: true };
      }

      case 'undo':
      case 'redo':
        return runHistory(actor, intent.type);

      case 'endEdit':
        return { ok: true };

      case 'save':
      case 'restoreVersion':
        return {
          ok: false,
          code: 'ENGINE_NOT_CONNECTED',
          message: '명시적 저장(버전 생성)은 Phase 5에서 Simulation Engine과 연결됩니다.',
        };
    }
  }

  /** Undo/Redo: 새 편집 명령으로 실행하고, 충돌하면 UNDO_CONFLICT (§8.4) */
  function runHistory(actor: UserId, direction: 'undo' | 'redo'): IntentResult {
    const replica = replicaOf(actor);
    const stack = direction === 'undo' ? replica.undoStack : replica.redoStack;
    const entry = stack[stack.length - 1];
    if (!entry)
      return direction === 'undo'
        ? { ok: false, code: 'NOTHING_TO_UNDO', message: '되돌릴 작업이 없습니다' }
        : { ok: false, code: 'NOTHING_TO_REDO', message: '다시 실행할 작업이 없습니다' };

    const shared = store.getState().live;
    const popped = stack.slice(0, -1);
    for (const change of entry.changes) {
      const check = checkChange(shared, change, direction, actor);
      if (!check.ok) {
        updateReplica(actor, (r) => (direction === 'undo' ? { ...r, undoStack: popped } : { ...r, redoStack: popped }));
        return { ok: false, code: 'UNDO_CONFLICT', message: check.reason ?? '충돌' };
      }
    }

    const ordered = direction === 'undo' ? [...entry.changes].reverse() : entry.changes;
    const ops: EditorOp[] = [];
    const nextChanges: Change[] = [];
    for (const change of ordered) {
      if (change.kind === 'property') {
        const value = direction === 'undo' ? change.before : change.after;
        ops.push(
          change.target.scope === 'block'
            ? { actorUserId: actor, opId: nextId('op-'), undoDirection: direction, type: 'PROPERTY_UPDATE', target: change.target, propertyPath: change.propertyPath, value }
            : { actorUserId: actor, opId: nextId('op-'), undoDirection: direction, type: 'PROPERTY_UPDATE', target: change.target, propertyPath: change.propertyPath as PlacementPath, value: value as number },
        );
        nextChanges.push(change);
        continue;
      }
      const template = direction === 'undo' ? change.inverse : change.forward;
      const op = { ...template, opId: nextId('op-'), actorUserId: actor, undoDirection: direction } as StructureChange['forward'];
      let forward = change.forward;
      // 생성을 되돌린 뒤 Redo는 재생성이 아니라 ELEMENT_RESTORE (블록/요소 ID 유지)
      if (direction === 'undo' && change.forward.type === 'ELEMENT_CREATE') {
        const snap = restoreSnapshot(shared, change.forward.templateId, change.forward.elementId, actor, nextId('op-'));
        if (snap) forward = snap;
      }
      ops.push(op);
      nextChanges.push({ kind: 'structure', forward, inverse: change.inverse });
    }

    commit(actor, ops);
    const moved: UndoEntry = { ...entry, entryId: nextId('u-'), changes: direction === 'undo' ? [...nextChanges].reverse() : nextChanges };
    updateReplica(actor, (r) =>
      direction === 'undo'
        ? { ...r, undoStack: popped, redoStack: [...r.redoStack, moved] }
        : { ...r, redoStack: popped, undoStack: [...r.undoStack, moved] },
    );
    return { ok: true, message: `${direction === 'undo' ? '실행 취소' : '다시 실행'}: ${entry.label}` };
  }

  /** 로컬 UI 상태: replica 갱신 + Presence 전파는 엔진 클라이언트가 처리한다 */
  function updateLocal(actor: UserId, patch: LocalStatePatch): void {
    engine.updateLocal(actor, patch);
  }

  return { mode: 'local', dispatch, updateLocal };
}

/* ------------------------------------------------------------------ */

function notFound(id: string): IntentResult {
  return { ok: false, code: 'TARGET_NOT_FOUND', message: `${id}을(를) 찾을 수 없습니다` };
}

/**
 * 위치 지정 없이 추가할 때의 기본 배치.
 * 페이지 여백 안에서 기존 요소와 겹치지 않는 첫 빈 자리(위→아래, 왼쪽 열→오른쪽 열)를 찾는다.
 * 빈 자리가 없으면 페이지 중앙 부근에 계단식으로 배치한다.
 */
export function nextFlowPosition(view: DocumentView, templateId: string, width: number, height: number) {
  const els = elementsOf(view, templateId);
  const margin = 64;
  const gap = 20;
  const rects = els.map((e) => ({ x: e.props.position.x, y: e.props.position.y, w: e.props.size.width, h: e.props.size.height }));
  const free = (x: number, y: number) =>
    rects.every((r) => x + width + gap <= r.x || r.x + r.w + gap <= x || y + height + gap <= r.y || r.y + r.h + gap <= y);
  const columns = [100, PAGE_SIZE.width - margin - width, Math.round((PAGE_SIZE.width - width) / 2)].filter(
    (x, i, arr) => x >= margin - 40 && x + width <= PAGE_SIZE.width - margin + 40 && arr.indexOf(x) === i,
  );
  for (let y = 100; y + height <= PAGE_SIZE.height - margin; y += 8) {
    for (const x of columns) if (free(x, y)) return { x, y };
  }
  const n = els.length % 8;
  return { x: (PAGE_SIZE.width - width) / 2 + n * 16, y: (PAGE_SIZE.height - height) / 2 + n * 16 };
}

export function clampPosition(p: { x: number; y: number }, w: number, h: number) {
  return {
    x: Math.round(Math.max(0, Math.min(PAGE_SIZE.width - w, p.x))),
    y: Math.round(Math.max(0, Math.min(PAGE_SIZE.height - h, p.y))),
  };
}

/** 삭제 직전 배치 스냅샷 → ELEMENT_RESTORE 명령 (§8.5) */
export function restoreSnapshot(
  view: DocumentView,
  templateId: string,
  elementId: string,
  actor: UserId,
  opId: string,
): ElementRestoreOp | null {
  const ordered = elementsOf(view, templateId);
  const index = ordered.findIndex((e) => e.elementId === elementId);
  if (index < 0) return null;
  const el = ordered[index];
  return {
    opId,
    actorUserId: actor,
    type: 'ELEMENT_RESTORE',
    templateId,
    elementId,
    blockId: el.blockId,
    index,
    renderZone: el.renderZone,
    props: structuredClone(el.props),
  };
}
