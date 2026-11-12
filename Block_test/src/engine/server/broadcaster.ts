import type { EngineContext } from '../context';
import type { DeliveryStatus } from '../net/mockWebSocket';
import { streamKeyOf, type ChangeEnvelope, type TargetKey } from '../protocol';
import type { Json, UserId } from '../types';
import { templatesContainingBlock } from './liveState';
import { presenceKeyOf } from './presenceKeys';

/**
 * 승인된 변경의 Stream 기록과 1:N Broadcast Delivery (DB_SCHEMA §8.3, §8.9).
 * - 전역 순번은 Redis seq:stream INCR로 원자적으로 발급한다 (§8.9.1)
 * - 부모 Broadcast 1건 + 수신자별 Delivery N건
 * - 수신 대상: 대상 블록/템플릿을 보고 있는 클라이언트 중 actor 제외 (공유 블록은 모든 템플릿의 접속자)
 * - Delivery 상태는 수신자별로 독립적이다.
 *   SENT: 전송됨 · DELIVERED: 클라이언트가 적용함 · QUEUED: 연결 없음/참여 전 · FAILED: 전송 중 연결 끊김
 * - QUEUED/FAILED(및 누락 감지로 적용되지 않은 SENT)는 SYNC가 적용된 시점에만 DELIVERED(catch-up)가 된다 (§8.9.3)
 */

export const STREAM_SEQ_KEY = 'seq:stream';

export interface Delivery {
  deliveryId: string;
  broadcastId: string;
  recipientUserId: UserId;
  status: DeliveryStatus;
  sentAt: number | null;
  deliveredAt: number | null;
  target: TargetKey;
  revision: number;
  streamSeq: number;
  via: 'live' | 'catch-up' | null;
}

export interface Broadcast {
  broadcastId: string;
  requestId: string;
  actorUserId: UserId;
  name: ChangeEnvelope['name'] | NoticeName;
  /** change: Stream 기록 + 문서 변경 · notice: 저장 상태 알림 (Stream 미기록) */
  kind: 'change' | 'notice';
  target: TargetKey;
  revision: number;
  streamId: string | null;
  streamSeq: number;
  recipients: UserId[];
  deliveryIds: string[];
  status: 'PARTIAL' | 'COMPLETE';
  createdAt: number;
  eventSequence: number;
}

export type NoticeName = 'PROPERTY_PERSISTED' | 'PROPERTY_PERSIST_FAILED' | 'TEMPLATE_SAVED' | 'CONTENT_MISMATCH';

export interface PublishOptions {
  /** PROPERTY_PERSISTED처럼 요청자에게도 보내야 하는 경우 */
  includeActor?: boolean;
}

export class Broadcaster {
  private _broadcasts: Broadcast[] = [];
  private _deliveries: Record<string, Delivery> = {};
  private noticePaths = new Map<string, string>();
  version = 0;

  constructor(
    private ctx: EngineContext,
    /** 서버 세션이 해당 사용자의 현재 연결로 템플릿에 참여 중인지 */
    private isJoined: (userId: UserId) => boolean,
  ) {}

  get broadcasts(): readonly Broadcast[] {
    return this._broadcasts;
  }
  get deliveries(): Readonly<Record<string, Delivery>> {
    return this._deliveries;
  }

  /** 현재 전역 순번 (syncWatermark 확정용) */
  currentSeq(): number {
    const v = this.ctx.redis.get(STREAM_SEQ_KEY);
    return typeof v === 'number' ? v : 0;
  }

  /** 대상을 보고 있는 사용자 (presence:template:* 해시 기준, 연결 끊김 상태 포함) */
  audienceOf(target: TargetKey): UserId[] {
    const [kind, id] = target.split(':') as ['block' | 'template', string];
    const templates = kind === 'template' ? [id] : templatesContainingBlock(this.ctx.redis, id);
    const viewers = new Set<UserId>();
    for (const tid of templates) for (const userId of Object.keys(this.ctx.redis.hgetall(presenceKeyOf(tid)))) viewers.add(userId);
    return this.ctx.users.map((u) => u.userId).filter((u) => viewers.has(u));
  }

  /** INCR seq:stream + XADD + Broadcast + 수신자별 Delivery */
  publishChange(input: Omit<ChangeEnvelope, 'streamSeq'>, opts: PublishOptions = {}): { broadcast: Broadcast; envelope: ChangeEnvelope } {
    const { clock, ids, redis, ws, logger } = this.ctx;
    const envelope: ChangeEnvelope = { ...input, streamSeq: redis.incr(STREAM_SEQ_KEY) };
    const streamKey = streamKeyOf(envelope.target);
    const propertyPath = envelope.op.type === 'PROPERTY_UPDATE' ? envelope.op.propertyPath : null;
    const common = {
      requestId: envelope.requestId,
      actorUserId: envelope.actorUserId,
      target: envelope.target,
      propertyPath,
    };

    const streamId = redis.xadd(streamKey, {
      name: envelope.name,
      requestId: envelope.requestId,
      actorUserId: envelope.actorUserId,
      revision: envelope.revision,
      streamSeq: envelope.streamSeq,
      change: envelope as unknown as Json,
    });
    logger.log({
      ...common,
      name: 'STREAM_XADD',
      category: 'redis',
      from: 'WS',
      to: ['REDIS'],
      payload: { key: streamKey, streamId, streamSeq: envelope.streamSeq, name: envelope.name, revision: envelope.revision },
      resultDetail: `${streamKey} ${streamId} · seq ${envelope.streamSeq}`,
    });

    const recipients = this.audienceOf(envelope.target).filter((u) => opts.includeActor || u !== envelope.actorUserId);
    const broadcastId = ids.next('BC');
    const deliveryIds = recipients.map(() => ids.next('DL'));
    const event = logger.log({
      ...common,
      name: envelope.name,
      category: 'broadcast',
      from: 'WS',
      to: recipients,
      broadcastId,
      payload: { broadcastId, revision: envelope.revision, streamSeq: envelope.streamSeq, recipients, op: envelope.op as unknown as Json },
      result: recipients.length === 0 ? 'OK' : 'PARTIAL',
      resultDetail: `Broadcast 1건 · Delivery ${recipients.length}건`,
    });

    this._broadcasts = [
      ...this._broadcasts,
      {
        broadcastId,
        requestId: envelope.requestId,
        actorUserId: envelope.actorUserId,
        name: envelope.name,
        kind: 'change',
        target: envelope.target,
        revision: envelope.revision,
        streamId,
        streamSeq: envelope.streamSeq,
        recipients,
        deliveryIds,
        status: recipients.length === 0 ? 'COMPLETE' : 'PARTIAL',
        createdAt: clock.now,
        eventSequence: event.sequence,
      },
    ];
    this.version++;

    recipients.forEach((recipientUserId, i) => {
      const deliveryId = deliveryIds[i];
      const sent = this.isJoined(recipientUserId)
        ? ws.sendToClient(recipientUserId, { type: 'CHANGE', broadcastId, deliveryId, change: envelope }, (status) => {
            // 도착 시 적용 여부는 클라이언트가 markApplied로 알린다. 여기서는 유실만 처리한다.
            if (status === 'FAILED') this.settle(deliveryId, 'FAILED', null, `${recipientUserId} 전송 중 연결 끊김`, event.sequence);
          })
        : ({ status: 'QUEUED' } as const);

      this._deliveries = {
        ...this._deliveries,
        [deliveryId]: {
          deliveryId,
          broadcastId,
          recipientUserId,
          status: sent.status,
          sentAt: sent.status === 'SENT' ? clock.now : null,
          deliveredAt: null,
          target: envelope.target,
          revision: envelope.revision,
          streamSeq: envelope.streamSeq,
          via: null,
        },
      };
      this.version++;
      if (sent.status === 'QUEUED') this.logDelivery(deliveryId, 'QUEUED', `${recipientUserId} 연결 없음 · 재연결 SYNC로 따라잡기`, event.sequence);
    });
    this.refreshBroadcast(broadcastId);
    return { broadcast: this._broadcasts.find((b) => b.broadcastId === broadcastId)!, envelope };
  }

  /**
   * 저장 상태 알림 (PROPERTY_PERSISTED 등): Broadcast + Delivery로 기록하되 Stream·전역 순번은 사용하지 않는다.
   * 연결이 없는 수신자는 QUEUED이며, 재연결 SYNC(저장 상태 스냅샷 포함)가 적용될 때 DELIVERED(catch-up)가 된다.
   */
  notify(input: {
    name: NoticeName;
    requestId: string;
    actorUserId: UserId;
    target: TargetKey;
    propertyPath: string;
    revision: number;
    payload: Json;
    includeActor?: boolean;
  }): Broadcast {
    const { clock, ids, ws, logger } = this.ctx;
    const recipients = this.audienceOf(input.target).filter((u) => input.includeActor !== false || u !== input.actorUserId);
    const broadcastId = ids.next('BC');
    const deliveryIds = recipients.map(() => ids.next('DL'));
    const seqMark = this.currentSeq();
    this.noticePaths.set(broadcastId, input.propertyPath);
    const event = logger.log({
      requestId: input.requestId,
      actorUserId: input.actorUserId,
      target: input.target,
      propertyPath: input.propertyPath,
      name: input.name,
      category: 'broadcast',
      from: 'WS',
      to: recipients,
      broadcastId,
      payload: { broadcastId, recipients, ...(input.payload as Record<string, Json>) },
      result: recipients.length === 0 ? 'OK' : 'PARTIAL',
      resultDetail: `알림 Broadcast 1건 · Delivery ${recipients.length}건 (Stream 미기록)`,
    });
    this._broadcasts = [
      ...this._broadcasts,
      {
        broadcastId,
        requestId: input.requestId,
        actorUserId: input.actorUserId,
        name: input.name,
        kind: 'notice',
        target: input.target,
        revision: input.revision,
        streamId: null,
        streamSeq: seqMark,
        recipients,
        deliveryIds,
        status: recipients.length === 0 ? 'COMPLETE' : 'PARTIAL',
        createdAt: clock.now,
        eventSequence: event.sequence,
      },
    ];
    this.version++;
    recipients.forEach((recipientUserId, i) => {
      const deliveryId = deliveryIds[i];
      const sent = this.isJoined(recipientUserId)
        ? ws.sendToClient(
            recipientUserId,
            { type: 'NOTICE', broadcastId, deliveryId, name: input.name, target: input.target, propertyPath: input.propertyPath, payload: input.payload },
            (status) => {
              if (status === 'FAILED') this.settle(deliveryId, 'FAILED', null, `${recipientUserId} 전송 중 연결 끊김`, event.sequence);
            },
          )
        : ({ status: 'QUEUED' } as const);
      this._deliveries = {
        ...this._deliveries,
        [deliveryId]: {
          deliveryId,
          broadcastId,
          recipientUserId,
          status: sent.status,
          sentAt: sent.status === 'SENT' ? clock.now : null,
          deliveredAt: null,
          target: input.target,
          revision: input.revision,
          streamSeq: seqMark,
          via: null,
        },
      };
      this.version++;
      if (sent.status === 'QUEUED') this.logDelivery(deliveryId, 'QUEUED', `${recipientUserId} 연결 없음 · 재연결 SYNC로 저장 상태 수신`, event.sequence);
    });
    this.refreshBroadcast(broadcastId);
    return this._broadcasts.find((b) => b.broadcastId === broadcastId)!;
  }

  /** 클라이언트가 실시간 Delivery를 적용함 (중복 수신 포함, 멱등) */
  markApplied(deliveryId: string): void {
    const d = this._deliveries[deliveryId];
    if (!d || d.status === 'DELIVERED') return;
    const b = this._broadcasts.find((x) => x.broadcastId === d.broadcastId)!;
    this.settle(deliveryId, 'DELIVERED', 'live', `${d.recipientUserId} 수신·적용`, b.eventSequence);
  }

  /**
   * SYNC 적용 완료: streamSeq ≤ syncWatermark 이고 아직 DELIVERED가 아닌 해당 사용자의 Delivery를 DELIVERED(catch-up)로.
   * 대상(targets)은 SYNC가 다룬 템플릿과 그 블록이다.
   */
  markCaughtUp(userId: UserId, targets: TargetKey[], syncWatermark: number, parentSequence: number): void {
    for (const d of Object.values(this._deliveries)) {
      if (d.recipientUserId !== userId || d.status === 'DELIVERED') continue;
      if (!targets.includes(d.target) || d.streamSeq > syncWatermark) continue;
      this.settle(d.deliveryId, 'DELIVERED', 'catch-up', `${userId} SYNC로 수신 (watermark ${syncWatermark})`, parentSequence);
    }
  }

  private settle(deliveryId: string, status: DeliveryStatus, via: Delivery['via'], detail: string, parentSequence: number): void {
    const cur = this._deliveries[deliveryId];
    if (cur.status === status) return;
    const now = this.ctx.clock.now;
    this._deliveries = {
      ...this._deliveries,
      [deliveryId]: { ...cur, status, via, deliveredAt: status === 'DELIVERED' ? now : null },
    };
    this.version++;
    this.logDelivery(deliveryId, status, detail, parentSequence);
    this.refreshBroadcast(cur.broadcastId);
  }

  private logDelivery(deliveryId: string, result: DeliveryStatus, detail: string, parentSequence: number): void {
    const d = this._deliveries[deliveryId];
    const b = this._broadcasts.find((x) => x.broadcastId === d.broadcastId)!;
    const op = (b.kind === 'change'
      ? (this.ctx.redis.xrange(streamKeyOf(d.target)).find((e) => e.fields.streamSeq === d.streamSeq)?.fields.change ?? null)
      : null) as { op?: { propertyPath?: string } } | null;
    const noticePath = b.kind === 'notice' ? (this.noticePaths.get(b.broadcastId) ?? null) : null;
    this.ctx.logger.log({
      requestId: b.requestId,
      actorUserId: b.actorUserId,
      target: d.target,
      propertyPath: op?.op?.propertyPath ?? noticePath,
      name: 'DELIVERY',
      category: 'delivery',
      from: 'WS',
      to: [d.recipientUserId],
      broadcastId: d.broadcastId,
      deliveryId,
      parentSequence,
      payload: { deliveryId, broadcastId: d.broadcastId, recipientUserId: d.recipientUserId, revision: d.revision, streamSeq: d.streamSeq, via: d.via },
      result,
      resultDetail: detail,
      durationMs: result === 'QUEUED' ? null : this.ctx.clock.now - b.createdAt,
    });
  }

  private refreshBroadcast(broadcastId: string): void {
    const index = this._broadcasts.findIndex((b) => b.broadcastId === broadcastId);
    const b = this._broadcasts[index];
    const complete = b.deliveryIds.every((id) => this._deliveries[id]?.status === 'DELIVERED');
    const status = complete ? 'COMPLETE' : 'PARTIAL';
    if (status === b.status) return;
    const next = [...this._broadcasts];
    next[index] = { ...b, status };
    this._broadcasts = next;
    this.version++;
  }
}
