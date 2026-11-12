import type { UserId } from '../../engine/types';
import type { DocumentView } from './documentModel';
import type { LocalStatePatch } from './intents';
import { applyOp, type EditorOp } from './ops';
import type { UndoEntry } from './undo';

/**
 * Client Replica (DB_SCHEMA.md §8.1).
 * 사용자마다 독립적으로 보유한다. Live 데이터의 원본과 Lock은 공유 상태(서버/Redis)에 있다.
 */

export type ConnectionStatus = 'connected' | 'disconnected';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface LocalSelection {
  /** 인라인 텍스트 편집 중인 요소 */
  editingElementId: string | null;
}

export interface PendingOp {
  op: EditorOp;
  status: 'pending' | 'sent';
  requestedAt: number;
}

export interface ReplicaState {
  userId: UserId;
  viewingTemplateId: string;
  selectedElementId: string | null;
  selectedPropertyPath: string | null;
  cursorPosition: CursorPosition | null;
  localSelection: LocalSelection;
  connectionStatus: ConnectionStatus;
  /** 대상(block:B001, template:T001)별 수신 완료 revision */
  lastReceivedRevision: Record<string, number>;
  /** 서버가 승인하고 이 클라이언트가 수신한 데이터 */
  documentView: DocumentView;
  /** 서버 승인 전 로컬 작업 (순서 유지) */
  pendingOps: PendingOp[];
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
}

export function createReplica(
  userId: UserId,
  templateId: string,
  documentView: DocumentView,
): ReplicaState {
  const lastReceivedRevision: Record<string, number> = {};
  for (const b of Object.values(documentView.blocks)) lastReceivedRevision[`block:${b.blockId}`] = b.revision;
  for (const t of Object.values(documentView.templates))
    lastReceivedRevision[`template:${t.templateId}`] = t.revision;

  return {
    userId,
    viewingTemplateId: templateId,
    selectedElementId: null,
    selectedPropertyPath: null,
    cursorPosition: null,
    localSelection: { editingElementId: null },
    connectionStatus: 'connected',
    lastReceivedRevision,
    documentView: structuredClone(documentView),
    pendingOps: [],
    undoStack: [],
    redoStack: [],
  };
}

/**
 * 화면 = documentView에 pendingOps를 순서대로 적용한 결과 (§8.1).
 * 화면이 파생값이므로 한 작업이 거부되어도 나머지 작업은 다시 적용된다.
 */
export function renderView(replica: Pick<ReplicaState, 'documentView' | 'pendingOps'>): DocumentView {
  return replica.pendingOps.reduce((view, p) => applyOp(view, p.op), replica.documentView);
}

export function addPendingOp(replica: ReplicaState, op: EditorOp, now: number): ReplicaState {
  return { ...replica, pendingOps: [...replica.pendingOps, { op, status: 'pending', requestedAt: now }] };
}

/** 승인 또는 거부된 작업 하나만 pendingOps에서 제거한다. */
export function removePendingOp(replica: ReplicaState, opId: string): ReplicaState {
  return { ...replica, pendingOps: replica.pendingOps.filter((p) => p.op.opId !== opId) };
}

/** 로컬 UI 상태 변경 (선택, 포커스, 커서, 보는 템플릿). 네트워크 명령이 아니다. */
export function applyLocalPatch(r: ReplicaState, patch: LocalStatePatch): ReplicaState {
  return {
    ...r,
    ...('selectedElementId' in patch ? { selectedElementId: patch.selectedElementId ?? null } : {}),
    ...('selectedPropertyPath' in patch ? { selectedPropertyPath: patch.selectedPropertyPath ?? null } : {}),
    ...('cursorPosition' in patch ? { cursorPosition: patch.cursorPosition ?? null } : {}),
    ...(patch.viewingTemplateId ? { viewingTemplateId: patch.viewingTemplateId } : {}),
    localSelection: { ...r.localSelection, ...patch.localSelection },
  };
}

/** 수신한 문서에 없는 요소를 선택하고 있으면 선택 해제 */
export function pruneSelection(r: ReplicaState): ReplicaState {
  if (!r.selectedElementId || r.documentView.elements[r.selectedElementId]) return r;
  return {
    ...r,
    selectedElementId: null,
    selectedPropertyPath: null,
    localSelection: { ...r.localSelection, editingElementId: null },
  };
}

/** 서버 승인 데이터 수신: documentView 교체 + 수신 revision 갱신 */
export function receiveDocument(replica: ReplicaState, documentView: DocumentView): ReplicaState {
  const lastReceivedRevision = { ...replica.lastReceivedRevision };
  for (const b of Object.values(documentView.blocks)) lastReceivedRevision[`block:${b.blockId}`] = b.revision;
  for (const t of Object.values(documentView.templates))
    lastReceivedRevision[`template:${t.templateId}`] = t.revision;
  return { ...replica, documentView, lastReceivedRevision };
}
