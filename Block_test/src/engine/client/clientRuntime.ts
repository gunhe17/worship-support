import type { DocumentView } from '../../editor/model/documentModel';
import type { LocalStatePatch } from '../../editor/model/intents';
import type { PropertyUpdateOp } from '../../editor/model/ops';
import { addPendingOp, applyLocalPatch, createReplica, pruneSelection, removePendingOp, type ReplicaState } from '../../editor/model/replica';
import type { EngineContext } from '../context';
import { isProvisionalId, referencesProvisional, remapIds } from '../../editor/model/remap';
import { CLAIM_PATH, claimLockKey, isClaimKey, parseClaimKey } from '../../editor/model/lockKeys';
import type { AssignedIds, ChangeEnvelope, DownMessage, HelloReason, PresenceFields, PresenceInfo, StructureOp, UpdateRejectCode, VersionOutcome } from '../protocol';
import { lockKeyOf } from '../keys';
import type { Json, UserId } from '../types';
import { checkChange, receiveChange, type ChangeCheck } from './applyChange';

/**
 * 시뮬레이션 클라이언트 (사용자별 1개). Client Replica와 수신한 Presence를 보유한다 (DB_SCHEMA §8.1, §8.2).
 * - 모든 서버 데이터는 MockWebSocket 메시지가 도착(DELIVERED)했을 때만 반영된다.
 * - 선택·커서 변경은 Presence로 전송한다. 커서는 50ms throttle.
 * - 사용자 시점 전환(viewer)은 이 모듈과 무관하다. 네트워크 이벤트를 만들지 않는다.
 */

export type SyncState = 'synced' | 'catching-up' | 'offline';

export interface ClientState {
  userId: UserId;
  replica: ReplicaState;
  /** 같은 템플릿 접속자의 Presence (이 클라이언트가 수신한 사본, 자신 제외) */
  presence: Record<UserId, PresenceInfo>;
  sync: SyncState;
  /** 마지막으로 처리한 전역 순번 (§8.9.1) */
  lastProcessedSeq: number;
  /** 따라잡는 중 보류한 실시간 Delivery 수 (§8.9.4) */
  bufferedCount: number;
  /** 이 클라이언트가 요청 중이거나 보유한 Lock (서버 원본은 Redis lock:*) */
  locks: Record<string, ClientLock>;
  /** 승인 확인 대기 요청. 재연결 SYNC의 requestResults로 판정한다 */
  unconfirmed: UnconfirmedRequest[];
  /** 진행 중인 명시적 저장·복원 요청 */
  versionPending: { requestId: string; kind: 'save' | 'restore'; acked?: boolean } | null;
  /** 마지막 저장·복원 결과 (CONTENT_MISMATCH 경고 포함) */
  lastVersion: VersionOutcome | null;
}

export interface ClientLock {
  /** waiting: 요소 편집 권한을 다른 사용자가 가지고 있어 대기열에서 기다리는 중 (v1.2.8) */
  status: 'requesting' | 'held' | 'waiting';
  requestId: string;
  lockToken?: string;
  fencingToken?: number;
  expiresAt?: number;
}

export type RejectCode = UpdateRejectCode | 'DISCONNECTED' | 'PROPERTY_LOCK_DENIED';

export interface OpRejection {
  userId: UserId;
  op: PropertyUpdateOp | StructureOp;
  code: RejectCode;
  message: string;
  ownerUserId?: UserId;
  /** 거부 주체 (§8.10.3) */
  rejectedBy: 'server' | 'client';
  requestId: string | null;
}

interface Submission {
  op: PropertyUpdateOp;
  undo?: { direction: 'undo' | 'redo'; expectedCurrent: Json };
  /** PROPERTY_UPDATE 전송 시 발급한 requestId (서버 처리 결과와 대응) */
  requestId?: string;
}

/** 구조 변경 제출 (템플릿 단위 직렬, Lock 없음) */
interface StructSub {
  structure: true;
  op: StructureOp;
  undo?: { direction: 'undo' | 'redo'; expectedIndex?: number };
  requestId?: string;
}

/** 서버 ID 발급(ELEMENT_CREATE 승인)을 기다리는 작업 */
type WaitingSub = { structure: false; sub: Submission } | { structure: true; sub: StructSub };

/** 전송했으나 응답 전에 연결이 끊겨 승인 여부를 모르는 요청 (§8.10.6) */
export interface UnconfirmedRequest {
  requestId: string;
  opId: string;
  propertyPath: string;
  target: string;
}

/** 클라이언트가 만료 직전 Lock을 재요청하는 여유 시간 (시뮬레이션 ms) */
const LOCK_RENEW_MARGIN_MS = 200;

/** 클라이언트 → 서버 처리 보고 (시뮬레이션에서는 지연 없는 ACK로 취급) */
export interface ClientReports {
  deliveryApplied(deliveryId: string): void;
  syncApplied(userId: UserId, requestId: string): void;
  /** Optimistic 작업 거부 (UI 알림·Undo 스택 정리용) */
  opRejected(rejection: OpRejection): void;
  /** ELEMENT_CREATE 승인: 임시 ID → 서버 ID (Undo 스택 등 치환용) */
  idAssigned(userId: UserId, assigned: AssignedIds): void;
  /** 명시적 저장·복원 결과 */
  versionResult(userId: UserId, outcome: VersionOutcome, phase: 'final' | 'mismatch'): void;
}

interface BufferedChange {
  deliveryId: string;
  change: ChangeEnvelope;
}

export const CURSOR_THROTTLE_MS = 50;

const presenceFieldsOf = (r: ReplicaState): PresenceFields => ({
  selectedElementId: r.selectedElementId,
  selectedPropertyPath: r.selectedPropertyPath,
  cursor: r.cursorPosition,
});

const sameCursor = (a: ReplicaState['cursorPosition'], b: ReplicaState['cursorPosition']) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y);

/** 템플릿 최초 로드: 스냅샷으로 해당 템플릿 구성과 블록을 채운다 */
function applySnapshot(r: ReplicaState, snap: import('../protocol').TemplateSnapshot): ReplicaState {
  const tid = snap.template.templateId;
  const view = r.documentView;
  const elements = Object.fromEntries(Object.entries(view.elements).filter(([, e]) => e.templateId !== tid));
  for (const e of snap.elements)
    elements[e.elementId] = { elementId: e.elementId, templateId: tid, blockId: e.blockId, sequence: e.sequence, renderZone: e.renderZone, props: e.props, properties: e.properties };
  const blocks = { ...view.blocks };
  for (const b of snap.blocks) blocks[b.blockId] = { blockId: b.blockId, kind: b.kind, content: b.content, revision: b.revision, properties: b.properties };
  const lastReceivedRevision = { ...r.lastReceivedRevision, [`template:${tid}`]: snap.template.revision };
  for (const b of snap.blocks) lastReceivedRevision[`block:${b.blockId}`] = Math.max(lastReceivedRevision[`block:${b.blockId}`] ?? 0, b.revision);
  return {
    ...r,
    lastReceivedRevision,
    documentView: { ...view, templates: { ...view.templates, [tid]: { ...snap.template } }, elements, blocks },
  };
}

function opTargetOf(op: PropertyUpdateOp | StructureOp): string {
  if (op.type === 'TEMPLATE_RENAME') return `template:${op.templateId}`;
  if (op.type !== 'PROPERTY_UPDATE') return `template:${op.templateId}/element:${op.elementId}`;
  return op.target.scope === 'block' ? `block:${op.target.blockId}` : `template:${op.target.templateId}/element:${op.target.elementId}`;
}

function describeUnconfirmed(x: Submission | StructSub): UnconfirmedRequest {
  return {
    requestId: x.requestId!,
    opId: x.op.opId,
    propertyPath: x.op.type === 'PROPERTY_UPDATE' ? x.op.propertyPath : x.op.type,
    target: opTargetOf(x.op),
  };
}

export class ClientRuntime {
  private _clients: Record<UserId, ClientState> = {};
  private cursorSentAt = new Map<UserId, number>();
  private cursorTimer = new Map<UserId, number>();
  private buffers = new Map<UserId, BufferedChange[]>();
  private reports: ClientReports = { deliveryApplied: () => {}, syncApplied: () => {}, opRejected: () => {}, idAssigned: () => {}, versionResult: () => {} };
  /** 응답을 기다리는 구조 변경 (opId → 작업) */
  private structAwaiting = new Map<UserId, Map<string, StructSub>>();
  /** 사용자별 임시 ID → 서버 ID */
  private idMaps = new Map<UserId, Map<string, string>>();
  /** 서버 ID 발급을 기다리는 작업 (임시 ID를 참조) */
  private waiting = new Map<UserId, WaitingSub[]>();
  /** Lock 획득을 기다리는 작업 (lockKey별 순서 유지) */
  private outbox = new Map<UserId, Map<string, Submission[]>>();
  /** 전송 후 응답을 기다리는 작업 (opId → 작업) */
  private awaiting = new Map<UserId, Map<string, Submission>>();
  /** 획득 후 즉시 해제할 Lock (편집 종료 시 아직 요청 중이던 Lock) */
  private releaseAfterGrant = new Map<UserId, Set<string>>();
  /** 승인 확인 대기 요청 (requestId → 작업) */
  private unconfirmedSubs = new Map<UserId, Map<string, Submission | StructSub>>();
  version = 0;

  constructor(
    private ctx: EngineContext,
    initialView: DocumentView,
    initialTemplateId: string,
  ) {
    for (const u of ctx.users) {
      this._clients[u.userId] = {
        userId: u.userId,
        replica: createReplica(u.userId, initialTemplateId, initialView),
        presence: {},
        sync: 'offline',
        lastProcessedSeq: 0,
        bufferedCount: 0,
        locks: {},
        unconfirmed: [],
        versionPending: null,
        lastVersion: null,
      };
      ctx.ws.onClientMessage(u.userId, (m) => this.handle(u.userId, m));
    }
  }

  setReports(reports: ClientReports): void {
    this.reports = reports;
  }

  get clients(): Readonly<Record<UserId, ClientState>> {
    return this._clients;
  }

  private set(userId: UserId, next: ClientState): void {
    if (next === this._clients[userId]) return;
    this._clients = { ...this._clients, [userId]: next };
    this.version++;
  }

  update(userId: UserId, fn: (c: ClientState) => ClientState): void {
    this.set(userId, fn(this._clients[userId]));
  }

  /** 어댑터용: replica 클라이언트 상태 갱신 (pendingOps, undo 스택 등) */
  updateReplica(userId: UserId, fn: (r: ReplicaState) => ReplicaState): void {
    this.update(userId, (c) => {
      const replica = fn(c.replica);
      return replica === c.replica ? c : { ...c, replica };
    });
  }

  /** 초기 접속 상태 (이벤트 없음). 서버 bootstrapJoin과 짝을 이룬다. */
  bootstrapConnected(userId: UserId, presence: Record<UserId, PresenceInfo>): void {
    this.update(userId, (c) => ({
      ...c,
      sync: 'synced',
      presence: Object.fromEntries(Object.entries(presence).filter(([id]) => id !== userId)),
      replica: { ...c.replica, connectionStatus: 'connected' },
    }));
  }

  presenceFields(userId: UserId): PresenceFields {
    return presenceFieldsOf(this._clients[userId].replica);
  }

  /* ---------------- 연결 ---------------- */

  connect(userId: UserId): boolean {
    const { ws, logger } = this.ctx;
    if (ws.isConnected(userId)) return false;
    const connectionId = ws.open(userId);
    this.update(userId, (c) => ({ ...c, sync: 'catching-up', replica: { ...c.replica, connectionStatus: 'connected' } }));
    logger.log({
      name: 'WS_OPEN',
      category: 'connection',
      actorUserId: userId,
      from: userId,
      to: ['WS'],
      payload: { connectionId },
      resultDetail: `${connectionId} 연결 수립`,
    });
    this.sendHello(userId, { reason: 'reconnect' });
    return true;
  }

  /** HELLO: 재연결 또는 누락 감지 후 복구 요청 (같은 연결) */
  private sendHello(userId: UserId, recovery: HelloReason): void {
    const c = this._clients[userId];
    this.ctx.ws.sendToServer(userId, {
      type: 'HELLO',
      requestId: this.ctx.ids.next('REQ'),
      templateId: c.replica.viewingTemplateId,
      lastReceivedRevision: { ...c.replica.lastReceivedRevision },
      lastProcessedSeq: c.lastProcessedSeq,
      presence: presenceFieldsOf(c.replica),
      recovery,
      unconfirmedRequestIds: [...(this.unconfirmedSubs.get(userId)?.keys() ?? [])],
    });
  }

  disconnect(userId: UserId): boolean {
    if (!this.ctx.ws.isConnected(userId)) return false;
    this.ctx.clock.cancel(this.cursorTimer.get(userId));
    this.cursorTimer.delete(userId);
    this.ctx.ws.close(userId);
    this.buffers.delete(userId);
    // §8.10.6
    // - Lock 대기 작업(서버로 보내지 않음): DISCONNECTED로 즉시 거부
    // - 전송했으나 응답 전인 작업: 승인 여부 미확정 → 승인 확인 대기로 보존, 재연결 SYNC의 requestId 결과로 판정
    const queued: (Submission | StructSub)[] = [
      ...[...(this.outbox.get(userId)?.values() ?? [])].flat(),
      ...(this.waiting.get(userId) ?? []).map((w) => w.sub),
    ];
    const sent: (Submission | StructSub)[] = [...(this.awaiting.get(userId)?.values() ?? []), ...(this.structAwaiting.get(userId)?.values() ?? [])];
    this.outbox.delete(userId);
    this.awaiting.delete(userId);
    this.structAwaiting.delete(userId);
    this.waiting.delete(userId);
    this.releaseAfterGrant.delete(userId);
    const unconfirmed = this.unconfirmedSubs.get(userId) ?? new Map<string, Submission | StructSub>();
    for (const sub of sent) unconfirmed.set(sub.requestId!, sub);
    this.unconfirmedSubs.set(userId, unconfirmed);
    const sentIds = new Set(sent.map((x) => x.op.opId));
    this.update(userId, (c) => ({
      ...c,
      sync: 'offline',
      presence: {},
      bufferedCount: 0,
      locks: {},
      versionPending: null,
      lastVersion: c.versionPending
        ? {
            kind: c.versionPending.kind,
            requestId: c.versionPending.requestId,
            templateId: c.replica.viewingTemplateId,
            ok: false,
            code: 'DISCONNECTED' as VersionOutcome['code'],
            message: '응답 전에 연결이 끊겼습니다. 버전 이력에서 결과를 확인하세요',
            at: this.ctx.clock.now,
          }
        : c.lastVersion,
      unconfirmed: [...unconfirmed.values()].map(describeUnconfirmed),
      // 판정 전까지 pendingOps에서 제외한다 (화면은 승인 데이터 기준). Undo 항목은 판정까지 유지
      replica: { ...c.replica, connectionStatus: 'disconnected', pendingOps: c.replica.pendingOps.filter((p) => !sentIds.has(p.op.opId)) },
    }));
    for (const sub of queued) this.reject(userId, sub.op, 'DISCONNECTED', '전송 대기 중 연결이 끊겨 전송하지 않았습니다', { origin: 'client' });
    return true;
  }

  /* ---------------- 버전 (명시적 저장 · 복원) ---------------- */

  /** 명시적 저장 또는 복원 요청. Optimistic 반영 없이 서버 결과를 기다린다 */
  requestVersion(userId: UserId, kind: 'save' | 'restore', templateId: string, versionId?: string): void {
    const requestId = this.ctx.ids.next('REQ');
    if (!this.ctx.ws.isConnected(userId)) {
      const outcome: VersionOutcome = { kind, requestId, templateId, ok: false, code: 'DISCONNECTED' as VersionOutcome['code'], message: '연결이 끊겨 요청을 보낼 수 없습니다', at: this.ctx.clock.now };
      this.update(userId, (c) => ({ ...c, lastVersion: outcome }));
      this.reports.versionResult(userId, outcome, 'final');
      return;
    }
    this.update(userId, (c) => ({ ...c, versionPending: { requestId, kind } }));
    this.ctx.ws.sendToServer(
      userId,
      kind === 'save' ? { type: 'TEMPLATE_SAVE', requestId, templateId } : { type: 'TEMPLATE_RESTORE', requestId, templateId, versionId: versionId! },
    );
  }

  private finishVersion(userId: UserId, outcome: VersionOutcome): void {
    this.update(userId, (c) => ({ ...c, lastVersion: outcome, versionPending: null }));
    this.reports.versionResult(userId, outcome, 'final');
  }

  /** 복원 요청자가 STRUCTURE_UPDATED(REPLACE_TEMPLATE_STRUCTURE)를 적용하면 복원 결과가 확정된다 */
  private onChangeApplied(userId: UserId, env: ChangeEnvelope): void {
    const pending = this._clients[userId].versionPending;
    if (env.op.type !== 'REPLACE_TEMPLATE_STRUCTURE' || pending?.requestId !== env.requestId) return;
    const op = env.op;
    this.finishVersion(userId, {
      kind: 'restore',
      requestId: env.requestId,
      templateId: op.templateId,
      ok: true,
      templateVersionId: op.newTemplateVersionId,
      restoredFromVersionId: op.templateVersionId,
      preservedTemplateVersionId: op.preservedTemplateVersionId,
      preservedVersion: op.preservedVersion,
      version: undefined,
      mismatches: [],
      at: this.ctx.clock.now,
    });
  }

  /* ---------------- 구조 변경 (Optimistic + 직렬화) ---------------- */

  /** 구조 변경 제출: pendingOps에 즉시 추가하고 STRUCTURE_COMMAND를 보낸다 (Lock 없음, structureRevision 검사) */
  submitStructure(userId: UserId, rawOp: StructureOp, undo?: StructSub['undo']): void {
    const op = remapIds(rawOp, this.idMapOf(userId));
    this.updateReplica(userId, (r) => addPendingOp(r, op, this.ctx.clock.now));
    if (!this.ctx.ws.isConnected(userId)) {
      this.reject(userId, op, 'DISCONNECTED', '연결이 끊긴 상태에서는 편집을 전송할 수 없습니다 (오프라인 편집 미지원)', { origin: 'client' });
      return;
    }
    const sub: StructSub = { structure: true, op, undo };
    // 생성 승인 전의 임시 요소를 대상으로 하는 작업은 서버 ID 발급을 기다린다
    if (op.type !== 'ELEMENT_CREATE' && referencesProvisional(op, this.idMapOf(userId))) {
      this.wait(userId, { structure: true, sub });
      return;
    }
    this.sendStructure(userId, sub);
  }

  private idMapOf(userId: UserId): Map<string, string> {
    const map = this.idMaps.get(userId) ?? new Map<string, string>();
    this.idMaps.set(userId, map);
    return map;
  }

  private wait(userId: UserId, item: WaitingSub): void {
    const list = this.waiting.get(userId) ?? [];
    list.push(item);
    this.waiting.set(userId, list);
  }

  /** baseStructureRevision = 수신한 구조 revision + 응답 대기 중인 같은 템플릿 구조 명령 수 */
  private sendStructure(userId: UserId, sub: StructSub): void {
    const awaiting = this.structAwaiting.get(userId) ?? new Map<string, StructSub>();
    this.structAwaiting.set(userId, awaiting);
    const templateId = sub.op.templateId;
    const inFlight = [...awaiting.values()].filter((s) => s.op.templateId === templateId).length;
    const base = this._clients[userId].replica.documentView.templates[templateId]?.structureRevision ?? 0;
    sub.requestId = this.ctx.ids.next('REQ');
    awaiting.set(sub.op.opId, sub);
    this.updateReplica(userId, (r) => ({
      ...r,
      pendingOps: r.pendingOps.map((p) => (p.op.opId === sub.op.opId ? { ...p, status: 'sent' } : p)),
    }));
    this.ctx.ws.sendToServer(userId, {
      type: 'STRUCTURE_COMMAND',
      requestId: sub.requestId,
      op: sub.op,
      baseStructureRevision: base + inFlight,
      ...(sub.undo ? { undo: sub.undo } : {}),
    });
  }

  /**
   * ELEMENT_CREATE 승인: 임시 ID를 서버 ID로 바꾼다.
   * pendingOps, 선택 상태를 치환하고, ID를 기다리던 작업을 전송한다.
   */
  private applyAssigned(userId: UserId, a: AssignedIds): void {
    const map = this.idMapOf(userId);
    map.set(a.localElementId, a.elementId);
    map.set(a.localBlockId, a.blockId);
    const selectedBefore = this._clients[userId].replica.selectedElementId;
    this.updateReplica(userId, (r) => ({
      ...r,
      pendingOps: r.pendingOps.map((p) => ({ ...p, op: remapIds(p.op, map) })),
      selectedElementId: r.selectedElementId && map.has(r.selectedElementId) ? map.get(r.selectedElementId)! : r.selectedElementId,
      localSelection: {
        ...r.localSelection,
        editingElementId:
          r.localSelection.editingElementId && map.has(r.localSelection.editingElementId)
            ? map.get(r.localSelection.editingElementId)!
            : r.localSelection.editingElementId,
      },
    }));
    this.reports.idAssigned(userId, a);
    if (selectedBefore === a.localElementId && this.ctx.ws.isConnected(userId)) {
      this.sendPresence(userId);
      this.claimSelection(userId);
    }

    const list = this.waiting.get(userId) ?? [];
    const ready = list.filter((w) => !referencesProvisional(remapIds(w.sub.op, map), map));
    this.waiting.set(userId, list.filter((w) => !ready.includes(w)));
    for (const w of ready) {
      const op = remapIds(w.sub.op, map);
      if (w.structure) this.sendStructure(userId, { ...w.sub, op: op as StructureOp });
      else this.dispatchProperty(userId, { ...w.sub, op: op as PropertyUpdateOp });
    }
  }

  /** ELEMENT_CREATE 거부: 그 임시 요소를 참조하던 대기 작업도 거부한다 */
  private rejectDependents(userId: UserId, op: StructureOp): void {
    if (op.type !== 'ELEMENT_CREATE') return;
    const list = this.waiting.get(userId) ?? [];
    const dependent = list.filter((w) => JSON.stringify(w.sub.op).includes(`"${op.elementId}"`) || JSON.stringify(w.sub.op).includes(`"${op.blockId}"`));
    this.waiting.set(userId, list.filter((w) => !dependent.includes(w)));
    for (const w of dependent) this.reject(userId, w.sub.op, 'TARGET_NOT_FOUND', '생성이 거부된 요소를 대상으로 한 작업입니다', { origin: 'client' });
  }

  /* ---------------- 속성 편집 (Optimistic + Lock) ---------------- */

  /**
   * 속성 변경 제출: pendingOps에 즉시 추가(화면 반영)하고,
   * Lock이 없으면 먼저 PROPERTY_LOCK_REQUEST, 보유 중이면 바로 PROPERTY_UPDATE를 보낸다.
   */
  submit(userId: UserId, rawOp: PropertyUpdateOp, undo?: Submission['undo']): void {
    const op = remapIds(rawOp, this.idMapOf(userId));
    this.updateReplica(userId, (r) => addPendingOp(r, op, this.ctx.clock.now));
    if (!this.ctx.ws.isConnected(userId)) {
      this.reject(userId, op, 'DISCONNECTED', '연결이 끊긴 상태에서는 편집을 전송할 수 없습니다 (오프라인 편집 미지원)', { origin: 'client' });
      return;
    }
    const sub: Submission = { op: remapIds(op, this.idMapOf(userId)), undo };
    if (referencesProvisional(sub.op, this.idMapOf(userId))) {
      this.wait(userId, { structure: false, sub });
      return;
    }
    this.dispatchProperty(userId, sub);
  }

  private dispatchProperty(userId: UserId, sub: Submission): void {
    const op = sub.op;
    const key = lockKeyOf(op);
    const lock = this._clients[userId].locks[key];
    const valid = lock?.status === 'held' && (lock.expiresAt ?? 0) - this.ctx.clock.now > LOCK_RENEW_MARGIN_MS;
    if (valid) {
      this.sendUpdate(userId, key, sub);
      return;
    }
    this.queue(userId, key).push(sub);
    if (lock?.status !== 'requesting') this.requestLock(userId, key, op);
  }

  /** 편집 종료(포커스 해제, 드래그 종료): 보유 Lock을 명시적으로 해제한다 (§7.5) */
  endEdit(userId: UserId): void {
    const c = this._clients[userId];
    // 지금 선택한 요소의 편집 권한은 유지한다 (그 요소에서 나갈 때만 해제, v1.2.8)
    const keep = this.selectedClaimKey(userId);
    for (const [key, lock] of Object.entries(c.locks)) {
      if (key === keep) continue;
      if (lock.status === 'waiting') {
        // 대기 중이던 권한: 로컬 상태만 지운다 (서버는 넘길 때 Presence로 다시 확인한다)
        this.update(userId, (x) => {
          const locks = { ...x.locks };
          delete locks[key];
          return { ...x, locks };
        });
        this.ctx.ws.sendToServer(userId, { type: 'PROPERTY_LOCK_RELEASE', requestId: this.ctx.ids.next('REQ'), lockKey: key, lockToken: '' });
        continue;
      }
      if (lock.status === 'requesting') {
        const set = this.releaseAfterGrant.get(userId) ?? new Set<string>();
        set.add(key);
        this.releaseAfterGrant.set(userId, set);
        continue;
      }
      this.release(userId, key);
    }
  }

  private queue(userId: UserId, key: string): Submission[] {
    const byKey = this.outbox.get(userId) ?? new Map<string, Submission[]>();
    this.outbox.set(userId, byKey);
    const list = byKey.get(key) ?? [];
    byKey.set(key, list);
    return list;
  }

  /** 지금 선택한 요소의 편집 권한 키 (서버 ID가 있는 요소만) */
  private selectedClaimKey(userId: UserId): string | null {
    const r = this._clients[userId].replica;
    const id = r.selectedElementId;
    if (!id || isProvisionalId(id)) return null;
    // 선택은 항상 보고 있는 템플릿 안이다. 새 요소는 서버 ID를 받은 직후 documentView에 아직 없을 수 있으므로 문서를 보지 않는다
    return claimLockKey(r.viewingTemplateId, id);
  }

  /** 선택한 요소의 편집 권한을 요청한다. 다른 사용자가 가지고 있으면 서버 대기열에서 기다린다 */
  private claimSelection(userId: UserId): void {
    const key = this.selectedClaimKey(userId);
    if (!key || this._clients[userId].locks[key] || !this.ctx.ws.isConnected(userId)) return;
    const { templateId, elementId } = parseClaimKey(key)!;
    const requestId = this.ctx.ids.next('REQ');
    this.update(userId, (c) => ({ ...c, locks: { ...c.locks, [key]: { status: 'requesting', requestId } } }));
    this.ctx.ws.sendToServer(userId, { type: 'PROPERTY_LOCK_REQUEST', requestId, lockKey: key, target: { scope: 'element', templateId, elementId }, propertyPath: CLAIM_PATH });
  }

  private requestLock(userId: UserId, key: string, op: PropertyUpdateOp): void {
    const requestId = this.ctx.ids.next('REQ');
    this.update(userId, (c) => ({ ...c, locks: { ...c.locks, [key]: { status: 'requesting', requestId } } }));
    this.ctx.ws.sendToServer(userId, { type: 'PROPERTY_LOCK_REQUEST', requestId, lockKey: key, target: op.target, propertyPath: op.propertyPath });
  }

  private release(userId: UserId, key: string): void {
    const lock = this._clients[userId].locks[key];
    if (!lock?.lockToken) return;
    this.update(userId, (c) => {
      const locks = { ...c.locks };
      delete locks[key];
      return { ...c, locks };
    });
    this.ctx.ws.sendToServer(userId, { type: 'PROPERTY_LOCK_RELEASE', requestId: this.ctx.ids.next('REQ'), lockKey: key, lockToken: lock.lockToken });
  }

  /** baseRevision = 수신한 속성 revision + 응답 대기 중인 같은 속성 작업 수 */
  private sendUpdate(userId: UserId, key: string, sub: Submission): void {
    const c = this._clients[userId];
    const lock = c.locks[key];
    const awaiting = this.awaiting.get(userId) ?? new Map<string, Submission>();
    this.awaiting.set(userId, awaiting);
    const inFlight = [...awaiting.values()].filter((s) => lockKeyOf(s.op) === key).length;
    const view = c.replica.documentView;
    const meta =
      sub.op.target.scope === 'block'
        ? view.blocks[sub.op.target.blockId]?.properties[sub.op.propertyPath]
        : view.elements[sub.op.target.elementId]?.properties[sub.op.propertyPath];
    sub.requestId = this.ctx.ids.next('REQ');
    awaiting.set(sub.op.opId, sub);
    this.updateReplica(userId, (r) => ({
      ...r,
      pendingOps: r.pendingOps.map((p) => (p.op.opId === sub.op.opId ? { ...p, status: 'sent' } : p)),
    }));
    this.ctx.ws.sendToServer(userId, {
      type: 'PROPERTY_UPDATE',
      requestId: sub.requestId,
      op: sub.op,
      baseRevision: (meta?.revision ?? 0) + inFlight,
      lockToken: lock.lockToken!,
      fencingToken: lock.fencingToken!,
      ...(sub.undo ? { undo: sub.undo } : {}),
    });
  }

  /**
   * 작업 거부: 해당 작업만 pendingOps에서 제거한다.
   * origin=client: 클라이언트가 판단한 거부 → PROPERTY_UPDATE_REJECTED(rejectedBy=client)를 클라이언트 레인에 기록 (네트워크 전송 없음)
   * origin=server: 서버가 이미 PROPERTY_UPDATE_REJECTED를 기록했으므로 다시 기록하지 않는다
   */
  private reject(
    userId: UserId,
    op: PropertyUpdateOp | StructureOp,
    code: RejectCode,
    message: string,
    opts: { origin: 'client' | 'server'; ownerUserId?: UserId; requestId?: string | null },
  ): void {
    this.updateReplica(userId, (r) => removePendingOp(r, op.opId));
    const requestId = opts.requestId ?? null;
    if (opts.origin === 'client') {
      this.ctx.logger.log({
        name: op.type === 'PROPERTY_UPDATE' ? 'PROPERTY_UPDATE_REJECTED' : 'STRUCTURE_UPDATE_REJECTED',
        category: 'request',
        requestId,
        actorUserId: userId,
        from: userId,
        to: [],
        target: opTargetOf(op),
        propertyPath: op.type === 'PROPERTY_UPDATE' ? op.propertyPath : null,
        payload: { opId: op.opId, code, message, rejectedBy: 'client', ...(opts.ownerUserId ? { ownerUserId: opts.ownerUserId } : {}) },
        result: 'DENIED',
        resultDetail: `${code} · 클라이언트 거부 (네트워크 전송 없음)`,
      });
    }
    this.reports.opRejected({ userId, op, code, message, ownerUserId: opts.ownerUserId, rejectedBy: opts.origin, requestId });
  }

  /* ---------------- 로컬 상태 → Presence ---------------- */

  updateLocal(userId: UserId, patch: LocalStatePatch): void {
    const prev = this._clients[userId].replica;
    const next = applyLocalPatch(prev, patch);
    this.updateReplica(userId, () => next);
    if (!this.ctx.ws.isConnected(userId)) return;

    // Lock 해제 시점 (§8.10.5, v1.2.5): 편집 중인 사용자가 그 요소에서 나갈 때
    // (다른 요소 선택, 빈 곳 클릭·선택 해제, 템플릿 전환). 입력 포커스 해제나 시점 전환은 해제 사유가 아니다.
    if (prev.selectedElementId !== null && next.selectedElementId !== prev.selectedElementId) this.endEdit(userId);

    if (next.viewingTemplateId !== prev.viewingTemplateId) {
      this.update(userId, (c) => ({ ...c, sync: 'catching-up', presence: {} }));
      this.ctx.ws.sendToServer(userId, {
        type: 'VIEW_TEMPLATE',
        requestId: this.ctx.ids.next('REQ'),
        templateId: next.viewingTemplateId,
        lastReceivedRevision: { ...next.lastReceivedRevision },
        lastProcessedSeq: this._clients[userId].lastProcessedSeq,
        presence: presenceFieldsOf(next),
      });
      return;
    }
    if (next.selectedElementId !== prev.selectedElementId || next.selectedPropertyPath !== prev.selectedPropertyPath) {
      this.sendPresence(userId);
      // 요소 편집 권한 (v1.2.8 §7.5.1): 선택하면 바로 요청한다. Presence를 먼저 보내 서버가 대기 순서를 판단할 수 있게 한다
      if (next.selectedElementId !== prev.selectedElementId) this.claimSelection(userId);
      return;
    }
    if (!sameCursor(next.cursorPosition, prev.cursorPosition)) this.sendCursorThrottled(userId);
  }

  private sendPresence(userId: UserId): void {
    this.ctx.clock.cancel(this.cursorTimer.get(userId));
    this.cursorTimer.delete(userId);
    const r = this._clients[userId].replica;
    if (r.cursorPosition) this.cursorSentAt.set(userId, this.ctx.clock.now);
    this.ctx.ws.sendToServer(userId, {
      type: 'PRESENCE_UPDATE',
      requestId: this.ctx.ids.next('PRS', 4),
      templateId: r.viewingTemplateId,
      presence: presenceFieldsOf(r),
    });
  }

  /** 커서 이동 50ms throttle: 즉시 1회 전송 후, 구간 안의 마지막 값을 구간 끝에 전송 */
  private sendCursorThrottled(userId: UserId): void {
    if (this.cursorTimer.has(userId)) return;
    const last = this.cursorSentAt.get(userId);
    const now = this.ctx.clock.now;
    if (last === undefined || now - last >= CURSOR_THROTTLE_MS) {
      this.sendPresence(userId);
      return;
    }
    const id = this.ctx.clock.schedule(last + CURSOR_THROTTLE_MS - now, `presence throttle ${userId}`, () => {
      this.cursorTimer.delete(userId);
      if (this.ctx.ws.isConnected(userId)) this.sendPresence(userId);
    });
    this.cursorTimer.set(userId, id);
  }

  /* ---------------- 수신 ---------------- */

  private handle(userId: UserId, message: DownMessage): void {
    const selectedBefore = this._clients[userId].replica.selectedElementId;
    switch (message.type) {
      case 'SYNC': {
        // §8.9.4: changes 적용(중복 무시) → lastProcessedSeq = watermark → 보류분 적용 → 동기화 표시
        const changes = [...message.changes].sort((a, b) => a.streamSeq - b.streamSeq);
        this.update(userId, (c) => {
          let replica = message.snapshot ? applySnapshot(c.replica, message.snapshot) : c.replica;
          for (const change of changes) replica = receiveChange(replica, change);
          return {
            ...c,
            sync: 'synced',
            lastProcessedSeq: Math.max(c.lastProcessedSeq, message.syncWatermark),
            presence: Object.fromEntries(Object.entries(message.presence).filter(([id]) => id !== userId)),
            replica: pruneSelection(replica),
          };
        });
        this.reports.syncApplied(userId, message.requestId);
        this.resolveUnconfirmed(userId, message.requestResults);
        const buffered = (this.buffers.get(userId) ?? []).sort((a, b) => a.change.streamSeq - b.change.streamSeq);
        this.buffers.delete(userId);
        this.update(userId, (c) => ({ ...c, bufferedCount: 0 }));
        for (const b of buffered) {
          if (this._clients[userId].sync !== 'synced') {
            // 보류분 처리 중 다시 누락을 감지해 복구 중이면 나머지는 다시 보류
            this.buffer(userId, b);
            continue;
          }
          // watermark 이하는 SYNC에 이미 포함되어 중복으로 처리된다
          this.receiveLive(userId, b);
        }
        this.afterReceive(userId, selectedBefore);
        this.claimSelection(userId);
        return;
      }
      case 'CHANGE': {
        const item = { deliveryId: message.deliveryId, change: message.change };
        if (this._clients[userId].sync === 'catching-up') this.buffer(userId, item);
        else this.receiveLive(userId, item);
        this.afterReceive(userId, selectedBefore);
        return;
      }
      case 'LOCK_RESULT': {
        const key = message.lockKey;
        if (isClaimKey(key)) {
          const mine = this._clients[userId].locks[key];
          const stillSelected = this.selectedClaimKey(userId) === key;
          if (message.granted && message.lock) {
            const lock = message.lock;
            // 넘겨받은 사이 다른 요소로 옮겼으면 바로 돌려준다
            if (!stillSelected) {
              this.releaseAfterGrant.get(userId)?.delete(key);
              this.ctx.ws.sendToServer(userId, { type: 'PROPERTY_LOCK_RELEASE', requestId: this.ctx.ids.next('REQ'), lockKey: key, lockToken: lock.lockToken });
              if (mine) this.update(userId, (c) => {
                const locks = { ...c.locks };
                delete locks[key];
                return { ...c, locks };
              });
              return;
            }
            this.update(userId, (c) => ({
              ...c,
              locks: { ...c.locks, [key]: { status: 'held', requestId: message.requestId, lockToken: lock.lockToken, fencingToken: lock.fencingToken, expiresAt: lock.expiresAt } },
            }));
            return;
          }
          // 거부: 다른 사용자가 편집 중 → 대기
          if (stillSelected) this.update(userId, (c) => ({ ...c, locks: { ...c.locks, [key]: { status: 'waiting', requestId: message.requestId } } }));
          return;
        }
        const queued = this.outbox.get(userId)?.get(key) ?? [];
        this.outbox.get(userId)?.delete(key);
        if (!message.granted || !message.lock) {
          this.update(userId, (c) => {
            const locks = { ...c.locks };
            delete locks[key];
            return { ...c, locks };
          });
          const owner = message.owner?.userId;
          for (const sub of queued)
            this.reject(
              userId,
              sub.op,
              'PROPERTY_LOCK_DENIED',
              owner ? `${owner}이(가) ${sub.op.propertyPath} Lock을 보유 중입니다` : 'Lock을 획득하지 못했습니다',
              { origin: 'client', ownerUserId: owner, requestId: message.requestId },
            );
          return;
        }
        const lock = message.lock;
        this.update(userId, (c) => ({
          ...c,
          locks: {
            ...c.locks,
            [key]: { status: 'held', requestId: message.requestId, lockToken: lock.lockToken, fencingToken: lock.fencingToken, expiresAt: lock.expiresAt },
          },
        }));
        for (const sub of queued) this.sendUpdate(userId, key, sub);
        if (this.releaseAfterGrant.get(userId)?.delete(key)) this.release(userId, key);
        return;
      }
      case 'VERSION_ACK': {
        // 요청 승인: 저장 완료가 아니다. NO_CHANGES면 여기서 결과가 확정된다
        const pending = this._clients[userId].versionPending;
        if (pending?.requestId !== message.requestId) return;
        if (message.noChanges)
          this.finishVersion(userId, { kind: message.kind, requestId: message.requestId, templateId: message.templateId, ok: true, code: 'NO_CHANGES', message: message.message, at: this.ctx.clock.now });
        else this.update(userId, (c) => ({ ...c, versionPending: { ...pending, acked: true } }));
        return;
      }
      case 'VERSION_REJECTED': {
        if (this._clients[userId].versionPending?.requestId !== message.requestId) return;
        this.finishVersion(userId, {
          kind: message.kind,
          requestId: message.requestId,
          templateId: message.templateId,
          ok: false,
          code: message.code,
          message: message.message,
          at: this.ctx.clock.now,
        });
        return;
      }
      case 'STRUCTURE_RESULT': {
        const sub = this.structAwaiting.get(userId)?.get(message.opId);
        if (!sub) return;
        this.structAwaiting.get(userId)!.delete(message.opId);
        if (!message.ok) {
          this.reject(userId, sub.op, message.code ?? 'STRUCTURE_CONFLICT', message.message ?? '서버가 거부했습니다', { origin: 'server', requestId: message.requestId });
          this.rejectDependents(userId, sub.op);
          return;
        }
        // 승인: 임시 pendingOp 제거 → 임시 ID 치환 → 승인된 변경 반영
        this.updateReplica(userId, (r) => removePendingOp(r, message.opId));
        if (message.assigned) this.applyAssigned(userId, message.assigned);
        if (message.change) {
          if (this._clients[userId].sync === 'catching-up') this.buffer(userId, { deliveryId: '', change: message.change });
          else this.receiveLive(userId, { deliveryId: '', change: message.change });
        }
        this.afterReceive(userId, selectedBefore);
        return;
      }
      case 'UPDATE_RESULT': {
        const sub = this.awaiting.get(userId)?.get(message.opId);
        if (!sub) return;
        this.awaiting.get(userId)!.delete(message.opId);
        const key = lockKeyOf(sub.op);
        if (!message.ok) {
          if (message.code === 'LOCK_NOT_HELD' || message.code === 'FENCING_TOKEN_STALE')
            this.update(userId, (c) => {
              const locks = { ...c.locks };
              delete locks[key];
              return { ...c, locks };
            });
          this.reject(userId, sub.op, message.code ?? 'REVISION_CONFLICT', message.message ?? '서버가 거부했습니다', {
            origin: 'server',
            requestId: message.requestId,
          });
          return;
        }
        // 승인: pendingOp 제거 후 승인된 변경을 documentView에 반영 (§8.1). 검증 규칙은 실시간 Delivery와 같다.
        this.updateReplica(userId, (r) => removePendingOp(r, message.opId));
        if (message.lockExpiresAt)
          this.update(userId, (c) =>
            c.locks[key] ? { ...c, locks: { ...c.locks, [key]: { ...c.locks[key], expiresAt: message.lockExpiresAt } } } : c,
          );
        if (message.change) {
          if (this._clients[userId].sync === 'catching-up') this.buffer(userId, { deliveryId: '', change: message.change });
          else this.receiveLive(userId, { deliveryId: '', change: message.change });
        }
        this.afterReceive(userId, selectedBefore);
        return;
      }
      case 'NOTICE': {
        // 알림은 documentView·revision·순번을 바꾸지 않는다 (§8.10.4, §8.11)
        this.reports.deliveryApplied(message.deliveryId);
        const payload = message.payload as { requestId?: string } & Record<string, unknown>;
        // 복원 요청 중에 오는 저장 알림(복원 전 자동 저장)은 복원 완료가 아니다
        const pendingVersion = this._clients[userId].versionPending;
        if (message.name === 'TEMPLATE_SAVED' && pendingVersion?.kind === 'save' && pendingVersion.requestId === payload.requestId) {
          const n = payload as unknown as { requestId: string; templateId: string; templateVersionId: string; version: number; createdBlockVersions: { blockId: string; blockVersionId: string }[]; reusedBlockVersions: { blockId: string; blockVersionId: string }[]; flushedKeys: string[] };
          this.finishVersion(userId, { kind: 'save', requestId: n.requestId, templateId: n.templateId, ok: true, templateVersionId: n.templateVersionId, version: n.version, createdBlockVersions: n.createdBlockVersions, reusedBlockVersions: n.reusedBlockVersions, flushedKeys: n.flushedKeys, at: this.ctx.clock.now });
        }
        if (message.name === 'CONTENT_MISMATCH' && this._clients[userId].lastVersion?.requestId === payload.requestId) {
          const mismatches = (payload as unknown as { mismatches: VersionOutcome['mismatches'] }).mismatches;
          const outcome = { ...this._clients[userId].lastVersion!, mismatches };
          this.update(userId, (c) => ({ ...c, lastVersion: outcome }));
          this.reports.versionResult(userId, outcome, 'mismatch');
        }
        return;
      }
      case 'PRESENCE': {
        if (message.userId === userId) return;
        this.update(userId, (c) => {
          if (c.replica.viewingTemplateId !== message.templateId) return c;
          const presence = { ...c.presence };
          if (message.info) presence[message.userId] = message.info;
          else delete presence[message.userId];
          return { ...c, presence };
        });
        return;
      }
    }
  }

  /**
   * 승인 확인 대기 요청 판정 (§8.10.6). requestId 기준 서버 처리 결과만 사용한다.
   * revision 증가 여부로 추정하지 않는다 (다른 사용자의 변경과 혼동 방지).
   * - APPROVED: 승인으로 복구. 변경은 SYNC changes로 이미 반영되었다. 재전송하지 않는다.
   * - REJECTED: 서버가 처리 시 거부 (서버가 이미 기록) → 같은 사유로 거부
   * - NOT_RECEIVED: 서버에 도달하지 못함 → DISCONNECTED
   */
  private resolveUnconfirmed(userId: UserId, results: Record<string, import('../protocol').RequestResult>): void {
    const pending = this.unconfirmedSubs.get(userId);
    if (!pending || pending.size === 0) return;
    for (const [requestId, sub] of [...pending.entries()]) {
      const result = results[requestId];
      if (!result) continue; // 이 SYNC가 조회하지 않은 요청 (VIEW_TEMPLATE 등)
      pending.delete(requestId);
      if (result.status === 'APPROVED' && result.assigned) this.applyAssigned(userId, result.assigned);
      if (result.status === 'REJECTED') {
        this.reject(userId, sub.op, result.code, `${result.message} (재연결 후 확인)`, { origin: 'server', requestId });
        if ('structure' in sub) this.rejectDependents(userId, sub.op);
      }
      else if (result.status === 'NOT_RECEIVED') {
        this.reject(userId, sub.op, 'DISCONNECTED', '서버에 도달하기 전에 연결이 끊겼습니다 (재연결 후 확인)', { origin: 'client', requestId });
        if ('structure' in sub) this.rejectDependents(userId, sub.op);
      }
    }
    this.update(userId, (c) => ({ ...c, unconfirmed: c.unconfirmed.filter((u) => pending.has(u.requestId)) }));
  }

  private buffer(userId: UserId, item: BufferedChange): void {
    const list = this.buffers.get(userId) ?? [];
    list.push(item);
    this.buffers.set(userId, list);
    this.update(userId, (c) => ({ ...c, bufferedCount: list.length }));
  }

  /** 실시간 Delivery 1건 검증 후 적용 (§8.9.1) */
  private receiveLive(userId: UserId, item: BufferedChange): ChangeCheck {
    const c = this._clients[userId];
    const check = checkChange(c.replica, c.lastProcessedSeq, item.change);
    if (check === 'apply') {
      this.update(userId, (cur) => ({
        ...cur,
        lastProcessedSeq: Math.max(cur.lastProcessedSeq, item.change.streamSeq),
        replica: pruneSelection(receiveChange(cur.replica, item.change)),
      }));
      this.onChangeApplied(userId, item.change);
      if (item.deliveryId) this.reports.deliveryApplied(item.deliveryId);
    } else if (check === 'duplicate') {
      // 이미 가진 revision: 적용하지 않고 수신 사실만 보고 (상태는 되돌리지 않음)
      if (item.deliveryId) this.reports.deliveryApplied(item.deliveryId);
    } else {
      // 누락·순서 역전: 적용하지 않고 같은 연결에서 HELLO로 복구 (Delivery는 SYNC 적용 시 DELIVERED)
      this.update(userId, (cur) => ({ ...cur, sync: 'catching-up' }));
      this.sendHello(userId, {
        reason: check,
        deliveryId: item.deliveryId,
        target: item.change.target,
        receivedRevision: item.change.revision,
        receivedSeq: item.change.streamSeq,
      });
    }
    return check;
  }

  /** 수신한 변경으로 선택 요소가 사라졌으면 Presence에도 반영 */
  private afterReceive(userId: UserId, selectedBefore: string | null): void {
    const r = this._clients[userId].replica;
    if (selectedBefore !== null && r.selectedElementId === null && this.ctx.ws.isConnected(userId)) this.sendPresence(userId);
  }
}
