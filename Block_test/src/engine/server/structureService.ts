import type { ElementCreateOp } from '../../editor/model/ops';
import type { EngineContext } from '../context';
import type { Transaction } from '../db/mockDatabase';
import type { AssignedIds, StructureOp, UpdateRejectCode, UpMessage } from '../protocol';
import { simTimestamp } from '../simTime';
import type { Json, Placement, UserId } from '../types';
import { claimLockKey, claimWaitKey } from '../../editor/model/lockKeys';
import type { Broadcaster } from './broadcaster';
import type { EditService } from './editService';
import {
  contiguousPersisted,
  readLiveBlock,
  readLiveTemplate,
  writeLiveBlock,
  writeLiveTemplate,
  type LiveElement,
  type LiveTemplate,
} from './liveState';

/**
 * 구조 변경 처리 (DB_SCHEMA §7.4, §7.6, §8.5, 시나리오 G·H).
 * - 템플릿 단위 직렬 처리: 도착 순서대로 처리하고 structureRevision(baseStructureRevision)만 검사한다.
 * - Debounce 없이 즉시 하나의 PostgreSQL 트랜잭션으로 저장한다. 실패하면 거부하고 Redis도 변경하지 않는다.
 * - 신규 블록: current_version_id = NULL, block_version/콘텐츠 행 없음, block_live_state(base NULL) INSERT
 * - 삭제: live 행 DELETE + deleted_at 설정, 대기 중 Debounce 취소(대체 완료), 요소 Lock 해제, 블록은 유지
 * - 복원(ELEMENT_RESTORE): deleted_at = NULL + live 행 재 INSERT, 블록은 변경하지 않음
 * - 이름 변경(TEMPLATE_RENAME, v1.2.7 §8.8.1): template.name UPDATE, 요소 구성은 그대로
 */

/** 템플릿 이름 길이 제한 (앞뒤 공백 제외) */
export const TEMPLATE_NAME_MAX = 60;

const asJson = <T>(v: T) => v as unknown as Json;
const WORKSPACE_ID = 'W001';

type Step = { name: string; ok: boolean; detail?: string };
type Rejection = { code: UpdateRejectCode; detail: string };

/** 템플릿 live 요소를 sequence 순으로 */
function ordered(live: LiveTemplate): [string, LiveElement][] {
  return Object.entries(live.elements).sort(([a, x], [b, y]) => x.sequence - y.sequence || a.localeCompare(b));
}

function renumber(list: [string, LiveElement][]): Record<string, LiveElement> {
  return Object.fromEntries(list.map(([id, el], i) => [id, { ...el, sequence: i + 1 }]));
}

export class StructureService {
  constructor(
    private ctx: EngineContext,
    private broadcaster: Broadcaster,
    private edits: EditService,
    private isJoined: (userId: UserId) => boolean,
    private sessionTemplateOf: (userId: UserId) => string | null,
  ) {}

  handle(userId: UserId, message: UpMessage): boolean {
    if (message.type !== 'STRUCTURE_COMMAND') return false;
    this.command(userId, message);
    return true;
  }

  private command(userId: UserId, m: Extract<UpMessage, { type: 'STRUCTURE_COMMAND' }>): void {
    const { redis, logger, ids, db, clock } = this.ctx;
    const op = m.op;
    const templateId = op.templateId;
    const target = `template:${templateId}` as const;
    const live = readLiveTemplate(redis, templateId);
    const steps: Step[] = [];
    const undoConflict = (detail: string): Rejection =>
      m.undo ? { code: 'UNDO_CONFLICT', detail } : { code: 'TARGET_NOT_FOUND', detail };

    const rejection = ((): Rejection | null => {
      if (!this.isJoined(userId)) return { code: 'NOT_JOINED', detail: '서버 세션 미참여' };
      steps.push({ name: '사용자 인증', ok: true });
      if (!live || this.sessionTemplateOf(userId) !== templateId) return { code: 'FORBIDDEN', detail: '보고 있는 템플릿이 아님' };
      steps.push({ name: '권한 확인', ok: true });
      if (m.baseStructureRevision !== live.structureRevision)
        return { code: 'STRUCTURE_CONFLICT', detail: `baseStructureRevision ${m.baseStructureRevision} ≠ 구조 revision ${live.structureRevision}` };
      steps.push({ name: '구조 revision 확인', ok: true, detail: String(live.structureRevision) });
      const exists = op.type !== 'TEMPLATE_RENAME' && !!live.elements[op.elementId];
      switch (op.type) {
        case 'ELEMENT_CREATE':
          break;
        case 'TEMPLATE_RENAME': {
          const name = op.name.trim();
          if (!name || name.length > TEMPLATE_NAME_MAX) return { code: 'INVALID_NAME', detail: `이름은 1~${TEMPLATE_NAME_MAX}자여야 합니다 (현재 ${name.length}자)` };
          // 되돌리기(Undo)는 현재 이름이 기록과 같을 때만
          const current = db.get('template', { id: templateId })?.name as string | undefined;
          if (m.undo && current !== op.previousName) return { code: 'UNDO_CONFLICT', detail: `현재 이름 "${current}" ≠ 기록 "${op.previousName}"` };
          steps.push({ name: '이름 확인', ok: true, detail: name });
          break;
        }
        case 'ELEMENT_DELETE': {
          if (!exists) return undoConflict('요소가 이미 삭제되었습니다');
          // 다른 사용자가 편집 중(Lock 보유)인 요소는 삭제할 수 없다 (§8.10.5, v1.2.5)
          const blockId = live.elements[op.elementId].blockId;
          const held = [...redis.keys(`lock:template:${templateId}:element:${op.elementId}:*`), ...redis.keys(`lock:block:${blockId}:*`)]
            .map((key) => ({ key, owner: (redis.get(key) as { userId?: UserId } | null)?.userId }))
            .find((l) => l.owner && l.owner !== userId);
          if (held) return { code: 'ELEMENT_LOCKED', detail: `${held.owner}이(가) 편집 중입니다 (${held.key})` };
          steps.push({ name: '편집 Lock 확인', ok: true });
          break;
        }
        case 'ELEMENT_RESTORE': {
          if (exists) return undoConflict('요소가 삭제되지 않았습니다');
          const row = db.get('template_element', { id: op.elementId });
          if (!row || row.template_id !== templateId) return { code: 'TARGET_NOT_FOUND', detail: '복원할 template_element 없음' };
          if (!readLiveBlock(redis, op.blockId)) return { code: 'TARGET_NOT_FOUND', detail: '블록 없음' };
          break;
        }
        case 'ELEMENT_REORDER': {
          if (!exists) return undoConflict('요소가 존재하지 않습니다');
          // 다른 사용자가 편집 중(요소 편집 권한)이면 순서도 바꾸지 않는다 (v1.2.8)
          const claimOwner = (redis.get(claimLockKey(templateId, op.elementId)) as { userId?: UserId } | null)?.userId;
          if (claimOwner && claimOwner !== userId) return { code: 'ELEMENT_LOCKED', detail: `${claimOwner}이(가) 편집 중입니다` };
          if (m.undo?.expectedIndex !== undefined) {
            const index = ordered(live).findIndex(([id]) => id === op.elementId);
            if (index !== m.undo.expectedIndex) return { code: 'UNDO_CONFLICT', detail: `현재 순서 ${index} ≠ 기대 ${m.undo.expectedIndex}` };
          }
          break;
        }
      }
      steps.push({ name: '대상 확인', ok: true });
      return null;
    })();

    const request = logger.log({
      name: op.type,
      category: 'request',
      requestId: m.requestId,
      actorUserId: userId,
      from: userId,
      to: ['WS'],
      target: op.type === 'TEMPLATE_RENAME' ? target : `${target}/element:${op.elementId}`,
      payload: asJson({ requestId: m.requestId, op, baseStructureRevision: m.baseStructureRevision, ...(m.undo ? { undo: m.undo } : {}), steps }),
      result: rejection ? 'DENIED' : 'OK',
      resultDetail: rejection ? `${rejection.code} · ${rejection.detail}` : '템플릿 단위 직렬 처리 · 즉시 저장',
    });

    const reject = (r: Rejection) => {
      this.edits.recordResult(m.requestId, { status: 'REJECTED', opId: op.opId, code: r.code, message: r.detail });
      logger.log({
        name: 'STRUCTURE_UPDATE_REJECTED',
        category: 'response',
        requestId: m.requestId,
        actorUserId: userId,
        from: 'WS',
        to: [userId],
        target,
        parentSequence: request.sequence,
        payload: asJson({ opId: op.opId, code: r.code, message: r.detail, rejectedBy: 'server' }),
        result: 'DENIED',
        resultDetail: r.code,
        durationMs: 0,
      });
      this.ctx.ws.sendToClient(userId, { type: 'STRUCTURE_RESULT', requestId: m.requestId, opId: op.opId, ok: false, code: r.code, message: r.detail });
    };
    if (rejection) return reject(rejection);

    // 서버 ID 발급 (ELEMENT_CREATE): 클라이언트 임시 ID → B00n, E00n
    let serverOp: StructureOp = op;
    let assigned: AssignedIds | undefined;
    if (op.type === 'ELEMENT_CREATE') {
      assigned = { localElementId: op.elementId, localBlockId: op.blockId, elementId: ids.next('E'), blockId: ids.next('B') };
      serverOp = { ...op, elementId: assigned.elementId, blockId: assigned.blockId } satisfies ElementCreateOp;
    }
    if (op.type === 'TEMPLATE_RENAME') serverOp = { ...op, name: op.name.trim() };

    // 새 live 템플릿 계산
    const revision = live!.revision + 1;
    const structureRevision = live!.structureRevision + 1;
    let list = ordered(live!);
    let unpersisted = live!.unpersisted;
    const tombstones = { ...(live!.tombstones ?? {}) };
    let cancelled: string[] = [];
    let releasedLocks: string[] = [];
    switch (serverOp.type) {
      case 'ELEMENT_CREATE':
        list = [...list, [serverOp.elementId, { blockId: serverOp.blockId, sequence: 0, renderZone: serverOp.renderZone, props: serverOp.props, properties: {} }]];
        break;
      case 'ELEMENT_DELETE': {
        const eid = serverOp.elementId;
        tombstones[eid] = live!.elements[eid].properties;
        list = list.filter(([id]) => id !== eid);
        // 대기 중 배치 Debounce 취소 → 그 revision은 대체 완료 (§7.6)
        unpersisted = unpersisted.filter((u) => !u.key.startsWith(`${eid}:`));
        break;
      }
      case 'ELEMENT_RESTORE': {
        const restored: LiveElement = {
          blockId: serverOp.blockId,
          sequence: 0,
          renderZone: serverOp.renderZone,
          props: serverOp.props,
          properties: tombstones[serverOp.elementId] ?? {},
        };
        delete tombstones[serverOp.elementId];
        const index = Math.max(0, Math.min(serverOp.index, list.length));
        list = [...list.slice(0, index), [serverOp.elementId, restored], ...list.slice(index)];
        break;
      }
      case 'TEMPLATE_RENAME':
        break;
      case 'ELEMENT_REORDER': {
        const from = list.findIndex(([id]) => id === serverOp.elementId);
        const [moved] = list.splice(from, 1);
        list.splice(Math.max(0, Math.min(serverOp.toIndex, list.length)), 0, moved);
        break;
      }
    }
    const elements = renumber(list);
    const nextLive: LiveTemplate = { ...live!, revision, structureRevision, elements, unpersisted, tombstones, lastActorUserId: userId };
    const persistedRevision = contiguousPersisted(nextLive);
    const now = simTimestamp(clock.now);

    // 즉시 트랜잭션 (Debounce 없음)
    const tx = db.transaction({ label: `${serverOp.type} ${templateId}`, kind: 'structure', requestId: m.requestId, actorUserId: userId }, (t) => {
      if (serverOp.type === 'ELEMENT_CREATE') {
        t.insert('block', { id: serverOp.blockId, workspace_id: WORKSPACE_ID, kind: serverOp.kind, current_version_id: null, created_by: userId, created_at: now });
        t.insert('block_live_state', {
          block_id: serverOp.blockId,
          base_block_version_id: null,
          content: asJson(serverOp.content),
          revision: 0,
          persisted_revision: 0,
          updated_by: userId,
          updated_at: now,
          persisted_at: now,
        });
        t.insert('template_element', { id: serverOp.elementId, template_id: templateId, block_id: serverOp.blockId, created_at: now, deleted_at: null });
      }
      if (serverOp.type === 'ELEMENT_DELETE') {
        t.delete('template_live_element', { template_id: templateId, template_element_id: serverOp.elementId });
        t.update('template_element', { id: serverOp.elementId }, { deleted_at: now });
      }
      if (serverOp.type === 'ELEMENT_RESTORE') t.update('template_element', { id: serverOp.elementId }, { deleted_at: null });
      if (serverOp.type === 'TEMPLATE_RENAME') t.update('template', { id: templateId }, { name: serverOp.name });
      syncLiveElements(t, templateId, elements, now, serverOp.type === 'ELEMENT_CREATE' || serverOp.type === 'ELEMENT_RESTORE' ? serverOp.elementId : null);
      t.update('template_live_state', { template_id: templateId }, {
        revision,
        persisted_revision: persistedRevision,
        updated_by: userId,
        updated_at: now,
        persisted_at: now,
      });
    });

    logger.log({
      name: 'STRUCTURE_SAVE',
      category: 'db',
      requestId: m.requestId,
      actorUserId: userId,
      from: 'WS',
      to: ['PG'],
      target,
      parentSequence: request.sequence,
      payload: asJson({
        txId: tx.txId,
        revision,
        persistedRevision,
        changes: tx.ok ? tx.changes.map((c) => `${c.op} ${c.table}`) : [],
        ...(tx.ok ? {} : { error: tx.error }),
      }),
      result: tx.ok ? 'OK' : 'FAILED',
      resultDetail: tx.ok ? `${tx.txId} COMMIT · 즉시 저장 (Debounce 없음)` : `${tx.txId} ROLLBACK · ${tx.error}`,
    });
    if (!tx.ok) return reject({ code: 'DB_WRITE_FAILED', detail: tx.error });

    // Redis Live 반영
    if (serverOp.type === 'ELEMENT_DELETE') {
      cancelled = this.edits.cancelElementDebounce(templateId, serverOp.elementId);
      releasedLocks = redis.keys(`lock:template:${templateId}:element:${serverOp.elementId}:*`);
      if (releasedLocks.length) redis.del(...releasedLocks);
      redis.del(claimWaitKey(claimLockKey(templateId, serverOp.elementId)));
    }
    if (serverOp.type === 'ELEMENT_CREATE')
      writeLiveBlock(redis, {
        blockId: serverOp.blockId,
        kind: serverOp.kind,
        content: serverOp.content,
        revision: 0,
        properties: {},
        unpersisted: [],
        lastActorUserId: null,
      });
    writeLiveTemplate(redis, nextLive);

    const { envelope } = this.broadcaster.publishChange({
      name: 'STRUCTURE_UPDATED',
      requestId: m.requestId,
      actorUserId: userId,
      target,
      revision,
      structureRevision,
      op: serverOp,
    });
    this.edits.recordResult(m.requestId, { status: 'APPROVED', opId: op.opId, streamSeq: envelope.streamSeq, target, revision, assigned });

    logger.log({
      name: 'STRUCTURE_UPDATE_ACK',
      category: 'response',
      requestId: m.requestId,
      actorUserId: userId,
      from: 'WS',
      to: [userId],
      target,
      parentSequence: request.sequence,
      payload: asJson({ opId: op.opId, revision, structureRevision, streamSeq: envelope.streamSeq, assigned: assigned ?? null, cancelledDebounce: cancelled, releasedLocks }),
      resultDetail: `revision ${revision} · 구조 revision ${structureRevision}${assigned ? ` · ${assigned.localElementId} → ${assigned.elementId}` : ''}`,
      durationMs: 0,
    });
    this.ctx.ws.sendToClient(userId, { type: 'STRUCTURE_RESULT', requestId: m.requestId, opId: op.opId, ok: true, change: envelope, assigned });
  }
}

/** template_live_element 행을 live 구성과 맞춘다 (신규/복원 행 INSERT, sequence가 바뀐 행 UPDATE) */
function syncLiveElements(t: Transaction, templateId: string, elements: Record<string, LiveElement>, now: string, insertedId: string | null): void {
  for (const [eid, el] of Object.entries(elements)) {
    const pk = { template_id: templateId, template_element_id: eid };
    if (eid === insertedId) {
      t.insert('template_live_element', {
        ...pk,
        block_id: el.blockId,
        sequence: el.sequence,
        render_zone: el.renderZone,
        props: asJson(el.props as Placement),
        updated_at: now,
      });
      continue;
    }
    const row = t.get('template_live_element', pk);
    if (row && row.sequence !== el.sequence) t.update('template_live_element', pk, { sequence: el.sequence, updated_at: now });
  }
}

