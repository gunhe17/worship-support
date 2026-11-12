import { findPropertyDef } from '../../editor/model/elementRegistry';
import type { PropertyUpdateOp } from '../../editor/model/ops';
import { getAtPath, jsonEqual, setAtPath } from '../../editor/model/jsonPath';
import type { EngineContext } from '../context';
import { DbError } from '../db/mockDatabase';
import { debounceKeyOf, lockKeyOf, targetKeyOf } from '../keys';
import { CLAIM_PATH, claimLockKey, claimWaitKey, isClaimKey, parseClaimKey } from '../../editor/model/lockKeys';
import type { DownMessage, LockValue, PresenceInfo, RequestResult, TargetKey, UpdateRejectCode, UpMessage } from '../protocol';
import { presenceKeyOf } from './presenceKeys';
import { simTimestamp } from '../simTime';
import type { Json, JsonObject, Row, UserId } from '../types';
import type { Broadcaster } from './broadcaster';
import {
  blocksOfTemplate,
  contiguousPersisted,
  readLiveBlock,
  readLiveTemplate,
  writeLiveBlock,
  writeLiveTemplate,
  type LiveBlock,
  type LivePropertyMeta,
  type LiveTemplate,
} from './liveState';

/**
 * 속성 편집 처리 (DB_SCHEMA §7.3~§7.5, CLAUDE_PROMPT §9).
 * - Lock: 속성 단위, TTL 10초(시뮬레이션), PROPERTY_UPDATE마다 연장, 명시적 해제 또는 만료
 * - Fencing: fence:{lockKey} INCR, PROPERTY_UPDATE 시 검증, PostgreSQL 저장 시 last_fencing_token 기록
 * - PROPERTY_UPDATE: 인증 → 권한 → Lock → Fencing → Revision(속성 단위) → 승인 → Redis 기록 → 전파 → Debounce
 * - Debounce: 속성 단위 1000ms. flush는 해당 property_path 값만 PostgreSQL에 병합한다.
 * 저장 실패 재시도(1s/2s/4s, DEAD)는 Phase 6에서 추가된다. 현재는 FAILED 상태와 알림만 기록한다.
 */

export const LOCK_TTL_MS = 10_000;

/** 편집 권한 대기자 (v1.2.8 §7.5.1) */
interface ClaimWaiter {
  userId: UserId;
  connectionId: string;
  requestId: string;
}
export const DEBOUNCE_MS = 1_000;

export type Step = { name: string; ok: boolean; detail?: string };

export interface DebounceValue {
  target: TargetKey;
  elementId: string | null;
  propertyPath: string;
  /** 대기 중인 마지막 속성 revision */
  revision: number;
  /** 대기 중인 마지막 대상 revision */
  targetRevision: number;
  lastUpdatedAt: number;
  dueAt: number;
  status: 'WAITING' | 'FLUSHING' | 'FAILED' | 'DEAD';
  /** 최초 시도를 포함한 전체 시도 횟수 (§8.10.7) */
  attempt: number;
  /** 최초 시도를 제외한 재시도 횟수 */
  retryCount: number;
  nextRetryAt: number | null;
  lastError: string | null;
  /** 마지막 실패의 DbError 코드 (STALE_REVISION, FENCING_TOKEN_STALE, WRITE_FAILED ...) */
  lastErrorCode?: string | null;
  /** 마지막 실패가 재시도 가능한 오류였는가 */
  retryable?: boolean;
  fencingToken: number;
  actorUserId: UserId;
  requestId: string;
}

const asJson = <T>(v: T) => v as unknown as Json;

export { debounceKeyOf, lockKeyOf } from '../keys';
const targetOf = targetKeyOf;

const metaKey = (op: Pick<PropertyUpdateOp, 'target' | 'propertyPath'>) =>
  op.target.scope === 'block' ? op.propertyPath : `${op.target.elementId}:${op.propertyPath}`;

const emptyMeta = (): LivePropertyMeta => ({ revision: 0, lastActorUserId: null, updatedAt: 0, persistedRevision: 0, lastFencingToken: 0 });

export class EditService {
  private timers = new Map<string, number>();
  /** requestId → PROPERTY_UPDATE 처리 결과 (재연결 시 승인 여부 확인용, §8.10.6) */
  private results = new Map<string, RequestResult>();

  resultOf(requestId: string): RequestResult {
    return this.results.get(requestId) ?? { status: 'NOT_RECEIVED' };
  }

  recordResult(requestId: string, result: RequestResult): void {
    this.results.set(requestId, result);
  }

  /**
   * 요소 삭제 시 그 요소의 대기 중인 배치 속성 Debounce를 취소한다 (§7.6, 시나리오 H).
   * 취소된 revision은 대체 완료로 처리되도록 호출자가 live.unpersisted에서 제거한다.
   */
  cancelElementDebounce(templateId: string, elementId: string): string[] {
    const keys = this.ctx.redis.keys(`debounce:template:${templateId}:element:${elementId}:*`);
    for (const key of keys) {
      this.ctx.clock.cancel(this.timers.get(key));
      this.timers.delete(key);
    }
    if (keys.length) this.ctx.redis.del(...keys);
    return keys;
  }

  constructor(
    private ctx: EngineContext,
    private broadcaster: Broadcaster,
    private isJoined: (userId: UserId) => boolean,
    private sessionTemplateOf: (userId: UserId) => string | null,
  ) {
    ctx.redis.onExpire((key, value) => {
      if (!key.startsWith('lock:') || value.type !== 'string') return;
      const lock = value.value as unknown as LockValue;
      ctx.logger.log({
        name: 'LOCK_EXPIRED',
        category: 'redis',
        actorUserId: lock.userId,
        from: 'REDIS',
        to: ['WS'],
        target: key,
        payload: asJson({ lockKey: key, lockToken: lock.lockToken, fencingToken: lock.fencingToken }),
        result: 'INFO',
        resultDetail: `TTL ${LOCK_TTL_MS / 1000}s 만료 · Lock 해제`,
      });
      if (!isClaimKey(key)) this.handoffAfterPropertyLock(key);
    });
  }

  handle(userId: UserId, connectionId: string, message: UpMessage): boolean {
    switch (message.type) {
      case 'PROPERTY_LOCK_REQUEST':
        this.lockRequest(userId, connectionId, message);
        return true;
      case 'PROPERTY_LOCK_RELEASE':
        this.lockRelease(userId, message);
        return true;
      case 'PROPERTY_UPDATE':
        this.update(userId, message);
        return true;
      default:
        return false;
    }
  }

  private send(userId: UserId, message: DownMessage) {
    this.ctx.ws.sendToClient(userId, message);
  }

  /* ------------------------------------------------------------------ */
  /* Lock                                                                */
  /* ------------------------------------------------------------------ */

  private lockRequest(userId: UserId, connectionId: string, m: Extract<UpMessage, { type: 'PROPERTY_LOCK_REQUEST' }>): void {
    const { redis, ids, logger, clock } = this.ctx;
    const expectedKey = lockKeyOf({ target: m.target, propertyPath: m.propertyPath });
    const propertyPath = m.propertyPath;
    const request = logger.log({
      name: 'PROPERTY_LOCK_REQUEST',
      category: 'request',
      requestId: m.requestId,
      actorUserId: userId,
      from: userId,
      to: ['WS', 'REDIS'],
      target: m.lockKey,
      propertyPath,
      payload: asJson({ requestId: m.requestId, lockKey: m.lockKey, connectionId }),
    });
    const reply = (granted: boolean, extra: { lock?: LockValue; owner?: { userId: UserId; expiresAt: number }; detail: string }) => {
      logger.log({
        name: granted ? 'PROPERTY_LOCK_GRANTED' : 'PROPERTY_LOCK_DENIED',
        category: 'response',
        requestId: m.requestId,
        actorUserId: userId,
        from: 'WS',
        to: [userId],
        target: m.lockKey,
        propertyPath,
        parentSequence: request.sequence,
        payload: asJson(extra.lock ?? { owner: extra.owner }),
        result: granted ? 'OK' : 'DENIED',
        resultDetail: extra.detail,
        durationMs: 0,
      });
      this.send(userId, { type: 'LOCK_RESULT', requestId: m.requestId, lockKey: m.lockKey, granted, lock: extra.lock, owner: extra.owner });
    };

    if (m.lockKey !== expectedKey || !this.isJoined(userId) || !this.permitted(userId, m.target)) {
      reply(false, { detail: m.lockKey !== expectedKey ? 'Lock 키 불일치' : '권한 없음 (템플릿 미참여)' });
      return;
    }
    const claim = isClaimKey(m.lockKey);
    // 요소 편집 권한 (v1.2.8 §7.5.1): 다른 사용자가 그 요소(또는 그 블록을 쓰는 요소)의 권한을 가지고 있으면 속성 Lock을 주지 않는다
    if (!claim) {
      const holder = this.foreignClaim(userId, m.target);
      if (holder) {
        reply(false, {
          owner: { userId: holder.lock.userId, expiresAt: holder.lock.expiresAt },
          detail: `${holder.lock.userId}이(가) 요소 편집 권한 보유 (${holder.key})`,
        });
        return;
      }
    }
    const existing = redis.get(m.lockKey) as unknown as LockValue | null;
    if (existing && existing.userId !== userId) {
      // 편집 권한 요청이 거부되면 대기열에 넣는다. 앞사람이 나가면 순서대로 넘겨받는다
      const position = claim ? this.enqueueClaim(m.lockKey, { userId, connectionId, requestId: m.requestId }) : 0;
      reply(false, {
        owner: { userId: existing.userId, expiresAt: existing.expiresAt },
        detail: claim
          ? `${existing.userId}이(가) 편집 권한 보유 · 대기 ${position}번째`
          : `${existing.userId}이(가) 보유 중 · 만료 ${simTimestamp(existing.expiresAt).slice(11)}`,
      });
      return;
    }
    if (claim && existing) {
      reply(true, { lock: existing, detail: '이미 편집 권한 보유' });
      return;
    }
    if (claim) {
      // 권한이 비어 있어도 다른 사용자가 이 요소를 실제로 편집 중(속성 Lock 보유)이면 주지 않는다 → 서로 막히는 상태 방지
      const busy = this.foreignPropertyLock(userId, m.lockKey);
      if (busy) {
        const position = this.enqueueClaim(m.lockKey, { userId, connectionId, requestId: m.requestId });
        reply(false, {
          owner: { userId: busy.lock.userId, expiresAt: busy.lock.expiresAt },
          detail: `${busy.lock.userId}이(가) 편집 중 (${busy.key}) · 대기 ${position}번째`,
        });
        return;
      }
    }
    if (existing && existing.connectionId === connectionId) {
      const lock = { ...existing, expiresAt: clock.now + LOCK_TTL_MS };
      redis.set(m.lockKey, asJson(lock), { px: LOCK_TTL_MS });
      reply(true, { lock, detail: '이미 보유 · TTL 연장' });
      return;
    }
    if (claim) {
      // 편집 권한은 TTL 없이 선택하는 동안 유지한다 (나가거나 연결이 끊기면 해제)
      const lock = this.grantClaim(m.lockKey, userId, connectionId);
      this.dequeueClaim(m.lockKey, userId);
      reply(true, { lock, detail: `요소 편집 권한 · fencingToken ${lock.fencingToken} · 선택하는 동안 유지` });
      return;
    }
    const fencingToken = redis.incr(`fence:${m.lockKey}`);
    const lock: LockValue = { userId, connectionId, lockToken: ids.next('LT'), fencingToken, expiresAt: clock.now + LOCK_TTL_MS };
    redis.set(m.lockKey, asJson(lock), { px: LOCK_TTL_MS, nx: !existing });
    reply(true, { lock, detail: `fencingToken ${fencingToken} · TTL ${LOCK_TTL_MS / 1000}s` });
  }

  /* ---------------- 요소 편집 권한 (v1.2.8 §7.5.1) ---------------- */

  /** 이 대상(요소 배치 또는 블록 콘텐츠)에 대해 다른 사용자가 가진 요소 편집 권한 */
  private foreignClaim(userId: UserId, target: PropertyUpdateOp['target']): { key: string; lock: LockValue } | null {
    const { redis } = this.ctx;
    const keys =
      target.scope === 'element'
        ? [claimLockKey(target.templateId, target.elementId)]
        : redis
            .keys('live:template:*')
            .map((k) => readLiveTemplate(redis, k.slice('live:template:'.length)))
            .flatMap((t) => (t ? Object.entries(t.elements).filter(([, el]) => el.blockId === target.blockId).map(([eid]) => claimLockKey(t.templateId, eid)) : []));
    for (const key of keys) {
      const lock = redis.get(key) as unknown as LockValue | null;
      if (lock && lock.userId !== userId) return { key, lock };
    }
    return null;
  }

  /** 편집 권한 키의 요소(배치)와 그 블록(콘텐츠)에 대해 다른 사용자가 가진 속성 Lock */
  private foreignPropertyLock(userId: UserId, claimKey: string): { key: string; lock: LockValue } | null {
    const { redis } = this.ctx;
    const parsed = parseClaimKey(claimKey);
    if (!parsed) return null;
    const blockId = readLiveTemplate(redis, parsed.templateId)?.elements[parsed.elementId]?.blockId;
    const keys = [
      ...redis.keys(`lock:template:${parsed.templateId}:element:${parsed.elementId}:*`).filter((k) => k !== claimKey),
      ...(blockId ? redis.keys(`lock:block:${blockId}:*`) : []),
    ];
    for (const key of keys) {
      const lock = redis.get(key) as unknown as LockValue | null;
      if (lock && lock.userId !== userId) return { key, lock };
    }
    return null;
  }

  /** 속성 Lock이 풀리면, 그 Lock 때문에 기다리던 편집 권한을 넘길 수 있는지 확인한다 */
  private handoffAfterPropertyLock(propertyKey: string, parentSequence?: number): void {
    const { redis } = this.ctx;
    const claimKeys = new Set<string>();
    const el = /^lock:template:([^:]+):element:([^:]+):/.exec(propertyKey);
    if (el) claimKeys.add(claimLockKey(el[1], el[2]));
    const block = /^lock:block:([^:]+):/.exec(propertyKey);
    if (block)
      for (const k of redis.keys('live:template:*')) {
        const t = readLiveTemplate(redis, k.slice('live:template:'.length));
        for (const [eid, e] of Object.entries(t?.elements ?? {})) if (e.blockId === block[1]) claimKeys.add(claimLockKey(t!.templateId, eid));
      }
    for (const key of claimKeys) if (this.waiters(key).length) this.handoffClaim(key, parentSequence);
  }

  private grantClaim(key: string, userId: UserId, connectionId: string): LockValue {
    const { redis, ids } = this.ctx;
    const fencingToken = redis.incr(`fence:${key}`);
    // expiresAt 0 = 만료 없음 (선택하는 동안 유지)
    const lock: LockValue = { userId, connectionId, lockToken: ids.next('LT'), fencingToken, expiresAt: 0 };
    redis.set(key, asJson(lock));
    return lock;
  }

  private waiters(key: string): ClaimWaiter[] {
    return (this.ctx.redis.get(claimWaitKey(key)) as unknown as ClaimWaiter[] | null) ?? [];
  }

  private saveWaiters(key: string, list: ClaimWaiter[]): void {
    if (list.length) this.ctx.redis.set(claimWaitKey(key), asJson(list));
    else this.ctx.redis.del(claimWaitKey(key));
  }

  /** 대기열 끝에 넣는다 (이미 있으면 요청만 갱신). 반환: 대기 순번(1부터) */
  private enqueueClaim(key: string, w: ClaimWaiter): number {
    const list = this.waiters(key).filter((x) => x.userId !== w.userId);
    list.push(w);
    this.saveWaiters(key, list);
    return list.length;
  }

  private dequeueClaim(key: string, userId: UserId): void {
    const list = this.waiters(key);
    if (list.some((x) => x.userId === userId)) this.saveWaiters(key, list.filter((x) => x.userId !== userId));
  }

  /**
   * 편집 권한이 풀리면 대기열에서 아직 그 요소를 선택하고 있는(Presence) 사용자에게 순서대로 넘긴다.
   * 그 사이 다른 요소로 옮겼거나 연결이 끊긴 대기자는 건너뛴다.
   */
  handoffClaim(key: string, parentSequence?: number): void {
    const { redis, logger } = this.ctx;
    const parsed = parseClaimKey(key);
    if (!parsed || redis.get(key)) return;
    const live = readLiveTemplate(redis, parsed.templateId);
    if (!live?.elements[parsed.elementId]) return this.saveWaiters(key, []);
    const rest = [...this.waiters(key)];
    while (rest.length) {
      const w = rest.shift()!;
      const p = redis.hget(presenceKeyOf(parsed.templateId), w.userId) as unknown as PresenceInfo | null;
      const stillHere =
        !!p && p.status === 'connected' && p.connectionId === w.connectionId && p.selectedElementId === parsed.elementId && this.isJoined(w.userId) && this.ctx.ws.isConnected(w.userId);
      if (!stillHere) continue;
      if (this.foreignPropertyLock(w.userId, key)) {
        // 다른 사용자가 아직 이 요소를 편집 중이면 그 Lock이 풀릴 때 다시 시도한다 (순서 유지)
        rest.unshift(w);
        break;
      }
      const lock = this.grantClaim(key, w.userId, w.connectionId);
      logger.log({
        name: 'LOCK_HANDOFF',
        category: 'response',
        requestId: w.requestId,
        actorUserId: w.userId,
        from: 'WS',
        to: [w.userId],
        target: key,
        propertyPath: CLAIM_PATH,
        parentSequence,
        payload: asJson({ lockKey: key, lock, waiting: rest.map((x) => x.userId) }),
        result: 'OK',
        resultDetail: `대기 순서대로 편집 권한 넘김 → ${w.userId}`,
        durationMs: 0,
      });
      this.send(w.userId, { type: 'LOCK_RESULT', requestId: w.requestId, lockKey: key, granted: true, lock });
      break;
    }
    this.saveWaiters(key, rest);
  }

  /** 연결이 끊긴 사용자의 편집 권한을 해제하고 넘긴다 */
  releaseClaimsOf(userId: UserId): void {
    const { redis } = this.ctx;
    for (const key of redis.keys('lock:template:*:element:*:edit')) {
      const lock = redis.get(key) as unknown as LockValue | null;
      if (lock?.userId !== userId) continue;
      redis.del(key);
      const released = this.ctx.logger.log({
        name: 'PROPERTY_LOCK_RELEASED',
        category: 'redis',
        actorUserId: userId,
        from: 'WS',
        to: ['REDIS'],
        target: key,
        propertyPath: CLAIM_PATH,
        payload: asJson({ lockKey: key, reason: 'disconnected' }),
        result: 'OK',
        resultDetail: '연결 종료 · 요소 편집 권한 해제',
      });
      this.handoffClaim(key, released.sequence);
    }
  }

  private lockRelease(userId: UserId, m: Extract<UpMessage, { type: 'PROPERTY_LOCK_RELEASE' }>): void {
    const { redis, logger } = this.ctx;
    const existing = redis.get(m.lockKey) as unknown as LockValue | null;
    const owned = !!existing && existing.userId === userId && existing.lockToken === m.lockToken;
    if (owned) redis.del(m.lockKey);
    logger.log({
      name: 'PROPERTY_LOCK_RELEASE',
      category: 'request',
      requestId: m.requestId,
      actorUserId: userId,
      from: userId,
      to: ['WS', 'REDIS'],
      target: m.lockKey,
      payload: asJson({ lockKey: m.lockKey, lockToken: m.lockToken }),
      result: owned ? 'OK' : 'INFO',
      resultDetail: owned ? 'DEL · Lock 해제' : '보유 중인 Lock 없음 (이미 만료 또는 다른 토큰)',
    });
    if (isClaimKey(m.lockKey)) {
      // 나간 사용자는 대기열에서도 뺀다. 권한이 풀렸으면 기다리던 사용자에게 넘긴다
      this.dequeueClaim(m.lockKey, userId);
      if (owned) this.handoffClaim(m.lockKey);
    } else if (owned) this.handoffAfterPropertyLock(m.lockKey);
  }

  /** 사용자가 참여 중인 템플릿에 대상이 있는가 */
  private permitted(userId: UserId, target: PropertyUpdateOp['target']): boolean {
    const templateId = this.sessionTemplateOf(userId);
    if (!templateId) return false;
    if (target.scope === 'block') return blocksOfTemplate(this.ctx.redis, templateId).includes(target.blockId);
    return target.templateId === templateId;
  }

  /* ------------------------------------------------------------------ */
  /* PROPERTY_UPDATE                                                     */
  /* ------------------------------------------------------------------ */

  private update(userId: UserId, m: Extract<UpMessage, { type: 'PROPERTY_UPDATE' }>): void {
    const { redis, logger, clock } = this.ctx;
    const op = m.op;
    const target = targetOf(op);
    const lockKey = lockKeyOf(op);
    const steps: Step[] = [];
    const fail = (code: UpdateRejectCode, name: string, detail: string) => {
      steps.push({ name, ok: false, detail });
      return { code, detail };
    };

    const liveBlock = op.target.scope === 'block' ? readLiveBlock(redis, op.target.blockId) : null;
    const liveTemplate = op.target.scope === 'element' ? readLiveTemplate(redis, op.target.templateId) : null;
    const liveElement = op.target.scope === 'element' ? liveTemplate?.elements[op.target.elementId] : null;
    const meta: LivePropertyMeta =
      (op.target.scope === 'block' ? liveBlock?.properties[op.propertyPath] : liveElement?.properties[op.propertyPath]) ?? emptyMeta();
    const lock = redis.get(lockKey) as unknown as LockValue | null;
    const jsonPath = liveBlock ? (findPropertyDef(liveBlock.kind, op.propertyPath)?.jsonPath ?? op.propertyPath) : op.propertyPath;
    const currentValue = liveBlock ? getAtPath(liveBlock.content, jsonPath) : liveElement ? getAtPath(liveElement.props as unknown as Json, op.propertyPath) : undefined;

    const rejection = (() => {
      if (!this.isJoined(userId)) return fail('NOT_JOINED', '사용자 인증', '서버 세션 미참여');
      steps.push({ name: '사용자 인증', ok: true });
      if ((op.target.scope === 'block' && !liveBlock) || (op.target.scope === 'element' && !liveElement))
        return fail('TARGET_NOT_FOUND', '권한 확인', '대상 없음');
      if (!this.permitted(userId, op.target)) return fail('FORBIDDEN', '권한 확인', '보고 있는 템플릿에 없는 대상');
      steps.push({ name: '권한 확인', ok: true });
      if (!lock || lock.userId !== userId || lock.lockToken !== m.lockToken)
        return fail('LOCK_NOT_HELD', 'Lock 확인', lock ? `${lock.userId} 보유 중` : 'Lock 없음 (만료 또는 미획득)');
      steps.push({ name: 'Lock 확인', ok: true, detail: lockKey });
      if (m.fencingToken !== lock.fencingToken)
        return fail('FENCING_TOKEN_STALE', 'Fencing Token 확인', `요청 ${m.fencingToken} ≠ 현재 ${lock.fencingToken}`);
      steps.push({ name: 'Fencing Token 확인', ok: true, detail: String(m.fencingToken) });
      if (m.baseRevision !== meta.revision)
        return fail('REVISION_CONFLICT', 'Revision 확인', `baseRevision ${m.baseRevision} ≠ 속성 revision ${meta.revision}`);
      steps.push({ name: 'Revision 확인', ok: true, detail: `속성 revision ${meta.revision}` });
      if (m.undo) {
        if (!jsonEqual(currentValue, m.undo.expectedCurrent) || (meta.lastActorUserId !== null && meta.lastActorUserId !== userId))
          return fail(
            'UNDO_CONFLICT',
            'Undo 충돌 확인',
            meta.lastActorUserId !== userId ? `이후 ${meta.lastActorUserId}의 변경이 승인됨` : '현재 값이 Undo 기준 값과 다름',
          );
        steps.push({ name: 'Undo 충돌 확인', ok: true });
      }
      return null;
    })();

    const basePayload = {
      requestId: m.requestId,
      ...(op.target.scope === 'block' ? { blockId: op.target.blockId } : { templateId: op.target.templateId, elementId: op.target.elementId }),
      propertyPath: op.propertyPath,
      baseRevision: m.baseRevision,
      value: op.value,
      fencingToken: m.fencingToken,
      ...(m.undo ? { undo: m.undo } : {}),
    };
    if (!rejection) steps.push({ name: '변경 승인', ok: true }, { name: 'Redis 이벤트 기록', ok: true }, { name: '실시간 전파', ok: true }, { name: 'Debounce 예약', ok: true });

    const request = logger.log({
      name: 'PROPERTY_UPDATE',
      category: 'request',
      requestId: m.requestId,
      actorUserId: userId,
      from: userId,
      to: ['WS'],
      target,
      propertyPath: op.propertyPath,
      payload: asJson({ ...basePayload, steps }),
      result: rejection ? 'DENIED' : 'OK',
      resultDetail: rejection ? `${rejection.code} · ${rejection.detail}` : steps.map((s) => s.name).join(' → '),
    });

    if (rejection) {
      logger.log({
        name: 'PROPERTY_UPDATE_REJECTED',
        category: 'response',
        requestId: m.requestId,
        actorUserId: userId,
        from: 'WS',
        to: [userId],
        target,
        propertyPath: op.propertyPath,
        parentSequence: request.sequence,
        payload: asJson({ opId: op.opId, code: rejection.code, message: rejection.detail, rejectedBy: 'server' }),
        result: 'DENIED',
        resultDetail: rejection.code,
        durationMs: 0,
      });
      this.results.set(m.requestId, { status: 'REJECTED', opId: op.opId, code: rejection.code, message: rejection.detail });
      this.send(userId, { type: 'UPDATE_RESULT', requestId: m.requestId, opId: op.opId, ok: false, code: rejection.code, message: rejection.detail });
      return;
    }

    // 승인: Redis live 갱신 (대상 revision +1, 속성 revision +1)
    const nextMeta: LivePropertyMeta = { ...meta, revision: meta.revision + 1, lastActorUserId: userId, updatedAt: clock.now };
    let revision: number;
    if (liveBlock) {
      revision = liveBlock.revision + 1;
      writeLiveBlock(redis, {
        ...liveBlock,
        content: setAtPath(liveBlock.content, jsonPath, op.value),
        revision,
        properties: { ...liveBlock.properties, [op.propertyPath]: nextMeta },
        unpersisted: [...liveBlock.unpersisted, { revision, key: metaKey(op) }],
        lastActorUserId: userId,
      });
    } else {
      const t = liveTemplate!;
      const el = liveElement!;
      const elementId = (op.target as { elementId: string }).elementId;
      revision = t.revision + 1;
      writeLiveTemplate(redis, {
        ...t,
        revision,
        elements: {
          ...t.elements,
          [elementId]: {
            ...el,
            props: setAtPath(el.props as unknown as JsonObject, op.propertyPath, op.value) as unknown as typeof el.props,
            properties: { ...el.properties, [op.propertyPath]: nextMeta },
          },
        },
        unpersisted: [...t.unpersisted, { revision, key: metaKey(op) }],
        lastActorUserId: userId,
      });
    }
    // Lock TTL 연장 (§7.5)
    const extended: LockValue = { ...lock!, expiresAt: clock.now + LOCK_TTL_MS };
    redis.set(lockKey, asJson(extended), { px: LOCK_TTL_MS });

    const { envelope } = this.broadcaster.publishChange({
      name: 'PROPERTY_UPDATED',
      requestId: m.requestId,
      actorUserId: userId,
      target,
      revision,
      propertyRevision: nextMeta.revision,
      op,
    });

    this.results.set(m.requestId, { status: 'APPROVED', opId: op.opId, streamSeq: envelope.streamSeq, target, revision });
    logger.log({
      name: 'PROPERTY_UPDATE_ACK',
      category: 'response',
      requestId: m.requestId,
      actorUserId: userId,
      from: 'WS',
      to: [userId],
      target,
      propertyPath: op.propertyPath,
      parentSequence: request.sequence,
      payload: asJson({ opId: op.opId, revision, propertyRevision: nextMeta.revision, streamSeq: envelope.streamSeq, lockExpiresAt: extended.expiresAt }),
      resultDetail: `revision ${revision} · 속성 revision ${nextMeta.revision}`,
      durationMs: 0,
    });
    this.send(userId, { type: 'UPDATE_RESULT', requestId: m.requestId, opId: op.opId, ok: true, change: envelope, lockExpiresAt: extended.expiresAt });

    this.scheduleDebounce(op, {
      revision: nextMeta.revision,
      targetRevision: revision,
      fencingToken: m.fencingToken,
      actorUserId: userId,
      requestId: m.requestId,
    });
  }

  /* ------------------------------------------------------------------ */
  /* Debounce                                                            */
  /* ------------------------------------------------------------------ */

  private scheduleDebounce(
    op: PropertyUpdateOp,
    info: Pick<DebounceValue, 'revision' | 'targetRevision' | 'fencingToken' | 'actorUserId' | 'requestId'>,
  ): void {
    const { redis, clock, logger } = this.ctx;
    const key = debounceKeyOf(op);
    const prev = redis.get(key) as unknown as DebounceValue | null;
    const value: DebounceValue = {
      target: targetOf(op),
      elementId: op.target.scope === 'element' ? op.target.elementId : null,
      propertyPath: op.propertyPath,
      ...info,
      lastUpdatedAt: clock.now,
      dueAt: clock.now + DEBOUNCE_MS,
      status: 'WAITING',
      // 재시도 대기 중 새 입력: 일반 Debounce로 재예약하고 attempt 초기화 (§7.9)
      attempt: 0,
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
    };
    redis.set(key, asJson(value));
    clock.cancel(this.timers.get(key));
    this.timers.set(key, clock.schedule(DEBOUNCE_MS, `debounce flush ${key}`, () => this.flush(key)));
    logger.log({
      name: 'DEBOUNCE_SCHEDULED',
      category: 'worker',
      requestId: info.requestId,
      actorUserId: info.actorUserId,
      from: 'WS',
      to: ['REDIS', 'WORKER'],
      target: value.target,
      propertyPath: op.propertyPath,
      payload: asJson({ key, revision: value.revision, targetRevision: value.targetRevision, dueAt: value.dueAt, previousDueAt: prev?.dueAt ?? null }),
      resultDetail: prev ? `예약 갱신 ${simTimestamp(prev.dueAt).slice(11)} → ${simTimestamp(value.dueAt).slice(11)}` : `저장 예약 ${simTimestamp(value.dueAt).slice(11)}`,
    });
  }

  /** 대기 중인 Debounce 키 (선택적으로 대상 필터) */
  pendingKeys(filter?: (d: DebounceValue) => boolean): string[] {
    return this.ctx.redis.keys('debounce:*').filter((k) => {
      const d = this.ctx.redis.get(k) as unknown as DebounceValue | null;
      return !!d && (!filter || filter(d));
    });
  }

  /**
   * flush 계획: 해당 property_path 값만 PostgreSQL Live 행에 병합한다 (§7.3).
   * overlay는 같은 트랜잭션에서 여러 키를 flush할 때 앞선 계획이 만든 Live 상태를 이어받기 위한 것이다.
   */
  planFlush(key: string, overlay: Map<string, LiveBlock | LiveTemplate>): FlushPlan | null {
    const { redis, clock } = this.ctx;
    const d = redis.get(key) as unknown as DebounceValue | null;
    if (!d) return null;
    const now = clock.now;
    const [kind, id] = d.target.split(':') as ['block' | 'template', string];
    if (kind === 'block') {
      const live = (overlay.get(d.target) as LiveBlock | undefined) ?? readLiveBlock(redis, id)!;
      const unpersisted = live.unpersisted.filter((u) => u.key !== d.propertyPath);
      const persistedRevision = contiguousPersisted({ revision: live.revision, unpersisted });
      const propertyRevision = live.properties[d.propertyPath]?.revision ?? 0;
      const jsonPath = findPropertyDef(live.kind, d.propertyPath)?.jsonPath ?? d.propertyPath;
      const next: LiveBlock = {
        ...live,
        unpersisted,
        properties: {
          ...live.properties,
          [d.propertyPath]: { ...live.properties[d.propertyPath], persistedRevision: propertyRevision, lastFencingToken: d.fencingToken },
        },
      };
      overlay.set(d.target, next);
      return {
        key,
        d,
        persistedRevision,
        targetRevision: live.revision,
        propertyRevision,
        apply: (tx) => {
          const row = tx.get('block_live_state', { block_id: id })!;
          // 최신 revision 보호: PostgreSQL이 이미 더 최신 revision이면 오래된 값으로 덮어쓰지 않는다
          if ((row.revision as number) > live.revision) throw new DbError('STALE_REVISION', `stale revision: PostgreSQL ${String(row.revision)} > Live ${live.revision}`);
          tx.update('block_live_state', { block_id: id }, {
            content: setAtPath(row.content as JsonObject, jsonPath, getAtPath(live.content, jsonPath) ?? null),
            revision: live.revision,
            persisted_revision: persistedRevision,
            updated_by: live.properties[d.propertyPath]?.lastActorUserId ?? d.actorUserId,
            updated_at: simTimestamp(d.lastUpdatedAt),
            persisted_at: simTimestamp(now),
          });
          for (const [path, meta] of Object.entries(live.properties)) {
            const own = path === d.propertyPath;
            upsertPropertyState(tx, 'block_property_state', { block_id: id, property_path: path }, meta, own ? d.fencingToken : null, own);
          }
        },
        commitLive: () => writeLiveBlock(redis, overlay.get(d.target) as LiveBlock),
      };
    }
    const live = (overlay.get(d.target) as LiveTemplate | undefined) ?? readLiveTemplate(redis, id)!;
    const elementId = d.elementId!;
    const unpersisted = live.unpersisted.filter((u) => u.key !== `${elementId}:${d.propertyPath}`);
    const persistedRevision = contiguousPersisted({ revision: live.revision, unpersisted });
    const el = live.elements[elementId];
    const propertyRevision = el?.properties[d.propertyPath]?.revision ?? 0;
    const next: LiveTemplate = el
      ? {
          ...live,
          unpersisted,
          elements: {
            ...live.elements,
            [elementId]: {
              ...el,
              properties: {
                ...el.properties,
                [d.propertyPath]: { ...el.properties[d.propertyPath], persistedRevision: propertyRevision, lastFencingToken: d.fencingToken },
              },
            },
          },
        }
      : live;
    overlay.set(d.target, next);
    return {
      key,
      d,
      persistedRevision,
      targetRevision: live.revision,
      propertyRevision,
      apply: (tx) => {
        if (el) {
          const row = tx.get('template_live_element', { template_id: id, template_element_id: elementId })!;
          tx.update('template_live_element', { template_id: id, template_element_id: elementId }, {
            props: setAtPath(row.props as JsonObject, d.propertyPath, getAtPath(el.props as unknown as Json, d.propertyPath) ?? null),
            updated_at: simTimestamp(d.lastUpdatedAt),
          });
          for (const [path, meta] of Object.entries(el.properties)) {
            const own = path === d.propertyPath;
            upsertPropertyState(
              tx,
              'template_element_property_state',
              { template_id: id, template_element_id: elementId, property_path: path },
              meta,
              own ? d.fencingToken : null,
              own,
            );
          }
        }
        const tls = tx.get('template_live_state', { template_id: id });
        if (tls && (tls.revision as number) > live.revision) throw new DbError('STALE_REVISION', `stale revision: PostgreSQL ${String(tls.revision)} > Live ${live.revision}`);
        tx.update('template_live_state', { template_id: id }, {
          revision: live.revision,
          persisted_revision: persistedRevision,
          updated_by: live.lastActorUserId,
          updated_at: simTimestamp(d.lastUpdatedAt),
          persisted_at: simTimestamp(now),
        });
      },
      commitLive: () => writeLiveTemplate(redis, overlay.get(d.target) as LiveTemplate),
    };
  }

  /** 커밋 후 처리: Debounce 키 삭제, 예약 취소, PROPERTY_PERSISTED 알림 */
  completeFlush(plan: FlushPlan): void {
    this.ctx.clock.cancel(this.timers.get(plan.key));
    this.timers.delete(plan.key);
    this.ctx.redis.del(plan.key);
    this.broadcaster.notify({
      name: 'PROPERTY_PERSISTED',
      requestId: plan.d.requestId,
      actorUserId: plan.d.actorUserId,
      target: plan.d.target,
      propertyPath: plan.d.propertyPath,
      revision: plan.targetRevision,
      payload: asJson({
        propertyPath: plan.d.propertyPath,
        elementId: plan.d.elementId,
        propertyRevision: plan.propertyRevision,
        revision: plan.targetRevision,
        persistedRevision: plan.persistedRevision,
      }),
      includeActor: true,
    });
  }

  /**
   * 단독 flush 트랜잭션 (§7.9, §8.10.7).
   * - trigger = debounce: Debounce 만료 (최초 시도)
   * - trigger = retry: 실패 후 자동 재시도 (1s · 2s · 4s, 최대 3회). expectedAttempt가 현재 값과 같을 때만 실행
   * - trigger = manual: DEAD 상태의 수동 재시도 (1회 시도, 실패하면 다시 DEAD)
   * 매 시도마다 최신 Redis Live 값과 revision으로 계획을 다시 만든다 (planFlush). 오래된 값을 쓰지 않는다.
   * 최초 1회 + 재시도 3회가 모두 실패하면 DEAD(attempt = 4, retryCount = 3)가 되고 자동 재시도를 멈춘다.
   */
  flush(key: string, trigger: FlushTrigger = 'debounce', expectedAttempt?: number): void {
    const { redis, db, clock, logger } = this.ctx;
    this.timers.delete(key);
    const current = redis.get(key) as unknown as DebounceValue | null;
    if (!current) return;
    // 재시도 예약이 새 입력으로 대체되었거나(attempt 0으로 초기화) 이미 처리되었으면 실행하지 않는다
    if (trigger === 'retry' && (current.status !== 'FAILED' || current.attempt !== expectedAttempt)) return;
    if (trigger === 'manual' && current.status !== 'DEAD') return;
    const overlay = new Map<string, LiveBlock | LiveTemplate>();
    const plan = this.planFlush(key, overlay);
    if (!plan) return;
    const d = plan.d;
    const attempt = d.attempt + 1;
    const retryCount = attempt - 1;
    redis.set(key, asJson({ ...d, status: 'FLUSHING' }));
    const now = clock.now;
    const result = db.transaction(
      { label: `debounce flush ${key}${trigger === 'debounce' ? '' : ` (${trigger} ${retryCount})`}`, kind: 'debounce', requestId: d.requestId, actorUserId: d.actorUserId },
      (tx) => plan.apply(tx),
    );

    // 실패 분류 (§8.12.2): revision 보호·fencing token 불일치는 재시도해도 해결되지 않으므로 즉시 DEAD.
    // 그 밖의 일시적 DB 오류(연결 끊김 등)는 1s · 2s · 4s 재시도 정책을 따른다.
    const errorCode = result.ok ? null : result.errorCode;
    const retryable = !result.ok && !NON_RETRYABLE_CODES.has(errorCode ?? '');
    const nextStatus: DebounceValue['status'] = result.ok
      ? 'WAITING'
      : retryable && trigger !== 'manual' && attempt < MAX_FLUSH_ATTEMPTS
        ? 'FAILED'
        : 'DEAD';
    const nextRetryAt = !result.ok && nextStatus === 'FAILED' ? now + RETRY_DELAYS_MS[attempt - 1] : null;
    const finalStatus = result.ok ? 'PERSISTED' : nextStatus;
    const [kind, id] = d.target.split(':') as ['block' | 'template', string];
    const attemptInfo = {
      key,
      requestId: d.requestId,
      ...(kind === 'block' ? { blockId: id } : { templateId: id, elementId: d.elementId }),
      propertyPath: d.propertyPath,
      revision: plan.targetRevision,
      propertyRevision: plan.propertyRevision,
      debounceRevision: d.revision,
      trigger,
      attempt,
      retryCount,
      attemptedAt: now,
      nextRetryAt,
      status: finalStatus,
      ...(result.ok ? {} : { error: result.error, errorCode, retryable, injected: db.transactions.at(-1)?.injected ?? false }),
    };

    logger.log({
      name: 'DEBOUNCE_SAVE',
      category: 'db',
      requestId: d.requestId,
      actorUserId: d.actorUserId,
      from: 'WORKER',
      to: ['PG'],
      target: d.target,
      propertyPath: d.propertyPath,
      payload: asJson({
        ...attemptInfo,
        txId: result.txId,
        persistedRevision: plan.persistedRevision,
        changes: result.ok ? result.changes.map((c) => `${c.op} ${c.table}`) : [],
      }),
      result: result.ok ? 'OK' : 'FAILED',
      resultDetail: result.ok
        ? `${result.txId} COMMIT · attempt ${attempt} · revision ${plan.targetRevision} / persisted ${plan.persistedRevision}`
        : `${result.txId} ROLLBACK · attempt ${attempt} (retry ${retryCount}) · ${result.error} · ${
            nextStatus === 'DEAD'
              ? retryable
                ? 'DEAD · 자동 재시도 중단'
                : `DEAD · 재시도 불가 오류(${errorCode}) · 즉시 중단`
              : `다음 재시도 ${simTimestamp(nextRetryAt!).slice(11)}`
          }`,
      durationMs: now - d.lastUpdatedAt,
    });

    if (result.ok) {
      plan.commitLive();
      this.completeFlush(plan);
      return;
    }
    // 실패: 롤백, Redis Live 유지 (§7.9)
    redis.set(key, asJson({ ...d, status: nextStatus, attempt, retryCount, nextRetryAt, lastError: result.error, lastErrorCode: errorCode, retryable }));
    if (nextStatus === 'FAILED')
      this.timers.set(
        key,
        clock.schedule(nextRetryAt! - now, `debounce retry ${retryCount + 1} ${key}`, () => this.flush(key, 'retry', attempt)),
      );
    this.broadcaster.notify({
      name: 'PROPERTY_PERSIST_FAILED',
      requestId: d.requestId,
      actorUserId: d.actorUserId,
      target: d.target,
      propertyPath: d.propertyPath,
      revision: plan.targetRevision,
      payload: asJson(attemptInfo),
      includeActor: true,
    });
  }

  /** DEAD 상태의 수동 재시도 (Simulation Console). DEAD가 아니면 false */
  manualRetry(key: string): boolean {
    const d = this.ctx.redis.get(key) as unknown as DebounceValue | null;
    if (!d || d.status !== 'DEAD') return false;
    this.flush(key, 'manual');
    return true;
  }
}

export type FlushTrigger = 'debounce' | 'retry' | 'manual';
/** 재시도해도 해결되지 않는 실패: 즉시 DEAD (§8.12.2) */
export const NON_RETRYABLE_CODES: ReadonlySet<string> = new Set(['STALE_REVISION', 'FENCING_TOKEN_STALE']);
/** 최초 시도 1회 + 재시도 최대 3회 (§8.10.7) */
export const MAX_FLUSH_ATTEMPTS = 4;
/** 재시도 간격: 직전 실패 시각부터 1s, 2s, 4s */
export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;

export interface FlushPlan {
  key: string;
  d: DebounceValue;
  persistedRevision: number;
  targetRevision: number;
  propertyRevision: number;
  apply(tx: import('../db/mockDatabase').Transaction): void;
  /** 커밋 성공 후 Redis Live의 저장 상태 갱신 (overlay 최종값) */
  commitLive(): void;
}

/**
 * property_state 행 갱신. revision은 Live 기준 현재 값,
 * persisted_revision/last_fencing_token은 이번에 저장한 속성만 갱신한다.
 */
function upsertPropertyState(
  tx: import('../db/mockDatabase').Transaction,
  table: 'block_property_state' | 'template_element_property_state',
  pk: Row,
  meta: LivePropertyMeta,
  fencingToken: number | null,
  own: boolean,
): void {
  const existing = tx.get(table, pk);
  const persisted = own ? meta.revision : ((existing?.persisted_revision as number | undefined) ?? meta.persistedRevision);
  const token = own ? fencingToken! : ((existing?.last_fencing_token as number | undefined) ?? meta.lastFencingToken);
  if (existing && (existing.revision as number) > meta.revision)
    throw new DbError('STALE_REVISION', `stale property revision: ${String(existing.revision)} > ${meta.revision}`);
  if (own && existing && (existing.last_fencing_token as number) > fencingToken!)
    throw new DbError('FENCING_TOKEN_STALE', `stale fencing token ${fencingToken} < ${String(existing.last_fencing_token)}`);
  const values = { revision: meta.revision, persisted_revision: persisted, last_fencing_token: token, updated_at: simTimestamp(meta.updatedAt) };
  if (existing) tx.update(table, pk, values);
  else tx.insert(table, { ...pk, ...values });
}
