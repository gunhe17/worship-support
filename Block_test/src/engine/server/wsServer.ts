import type { EngineContext } from '../context';
import type { SimEvent } from '../logger';
import {
  streamKeyOf,
  type ChangeEnvelope,
  type PresenceFields,
  type PresenceInfo,
  type TargetKey,
  type UpMessage,
} from '../protocol';
import type { Json, UserId } from '../types';
import { Broadcaster } from './broadcaster';
import { EditService } from './editService';
import { StructureService } from './structureService';
import { VersionService } from './versionService';
import { blocksOfTemplate, readLiveBlock, readLiveTemplate, targetsOfTemplate } from './liveState';
import { presenceChannelOf, presenceKeyOf } from './presenceKeys';

/**
 * WS Server: 연결 세션, 템플릿 참여, Presence(Pub/Sub), 재연결 따라잡기.
 * 편집 명령(Lock, PROPERTY_UPDATE, 구조 변경)은 Phase 3에서 이 서버에 추가된다.
 */

/** SYNC 응답을 보내고 클라이언트 적용 보고를 기다리는 상태 */
interface PendingSync {
  requestId: string;
  targets: TargetKey[];
  syncWatermark: number;
  responseSequence: number;
}

interface Session {
  connectionId: string | null;
  pendingSync?: PendingSync;
  /** 현재 연결로 템플릿에 참여(HELLO 처리 완료)했는가 */
  joined: boolean;
  templateId: string | null;
}

const asJson = <T>(v: T) => v as unknown as Json;

export class WsServer {
  private sessions: Record<UserId, Session> = {};
  readonly broadcaster: Broadcaster;
  readonly edits: EditService;
  readonly structure: StructureService;
  readonly versions: VersionService;

  constructor(private ctx: EngineContext) {
    for (const u of ctx.users) this.sessions[u.userId] = { connectionId: null, joined: false, templateId: null };
    this.broadcaster = new Broadcaster(ctx, (userId) => this.isJoined(userId));
    this.edits = new EditService(ctx, this.broadcaster, (u) => this.isJoined(u), (u) => this.sessionTemplateOf(u));
    this.structure = new StructureService(ctx, this.broadcaster, this.edits, (u) => this.isJoined(u), (u) => this.sessionTemplateOf(u));
    this.versions = new VersionService(ctx, this.broadcaster, this.edits, (u) => this.isJoined(u), (u) => this.sessionTemplateOf(u));
    ctx.ws.onServerMessage((userId, connectionId, message) => this.handle(userId, connectionId, message));
    ctx.ws.onClose((userId, connectionId) => this.handleClose(userId, connectionId));
  }

  isJoined(userId: UserId): boolean {
    const s = this.sessions[userId];
    return !!s?.joined && s.connectionId === this.ctx.ws.connectionIdOf(userId) && this.ctx.ws.isConnected(userId);
  }

  sessionTemplateOf(userId: UserId): string | null {
    return this.sessions[userId]?.templateId ?? null;
  }

  /** 초기 상태: 이벤트 없이 접속·참여 상태를 만든다 (시드의 "T001 접속" 상태) */
  bootstrapJoin(userId: UserId, connectionId: string, templateId: string, presence: PresenceFields): void {
    this.sessions[userId] = { connectionId, joined: true, templateId };
    this.ctx.redis.hset(presenceKeyOf(templateId), userId, asJson(this.presenceInfo(userId, connectionId, presence)));
    this.subscribe(userId, connectionId, templateId);
  }

  private handle(userId: UserId, connectionId: string, message: UpMessage): void {
    if (this.edits.handle(userId, connectionId, message)) return;
    if (this.structure.handle(userId, message)) return;
    if (this.versions.handle(userId, message)) return;
    switch (message.type) {
      case 'HELLO':
      case 'VIEW_TEMPLATE': {
        const request = this.ctx.logger.log({
          name: message.type,
          category: 'connection',
          requestId: message.requestId,
          actorUserId: userId,
          from: userId,
          to: ['WS'],
          target: `template:${message.templateId}`,
          payload: asJson({
            templateId: message.templateId,
            lastReceivedRevision: message.lastReceivedRevision,
            lastProcessedSeq: message.lastProcessedSeq,
            connectionId,
            ...(message.type === 'HELLO' ? { recovery: message.recovery, unconfirmedRequestIds: message.unconfirmedRequestIds } : {}),
          }),
          resultDetail:
            message.type === 'VIEW_TEMPLATE'
              ? '템플릿 전환'
              : message.recovery.reason === 'reconnect'
                ? '재연결 · 마지막 수신 revision 전달'
                : `누락 복구 요청 (${message.recovery.reason === 'gap' ? 'revision 누락' : '순서 역전'} · ${message.recovery.target} rev ${message.recovery.receivedRevision} · seq ${message.recovery.receivedSeq})`,
        });
        const prevTemplate = this.sessions[userId].templateId;
        if (message.type === 'VIEW_TEMPLATE') this.leaveTemplate(userId);
        else if (prevTemplate && prevTemplate !== message.templateId) {
          // 연결이 끊긴 동안 템플릿을 바꾼 경우: 이전 템플릿의 disconnected 항목 정리
          this.ctx.redis.hdel(presenceKeyOf(prevTemplate), userId);
          this.ctx.redis.publish(presenceChannelOf(prevTemplate), asJson({ userId, info: null }));
        }
        this.joinTemplate(userId, connectionId, message, request);
        return;
      }
      case 'PRESENCE_UPDATE': {
        const session = this.sessions[userId];
        if (!this.isJoined(userId) || session.templateId !== message.templateId) return;
        const info = this.presenceInfo(userId, connectionId, message.presence);
        const key = presenceKeyOf(message.templateId);
        this.ctx.redis.hset(key, userId, asJson(info));
        const received = this.ctx.redis.publish(presenceChannelOf(message.templateId), asJson({ userId, info }));
        this.ctx.logger.log({
          name: 'PRESENCE_UPDATE',
          category: 'presence',
          requestId: message.requestId,
          actorUserId: userId,
          from: userId,
          to: ['WS', 'REDIS'],
          target: `template:${message.templateId}`,
          propertyPath: message.presence.selectedPropertyPath,
          payload: asJson(message.presence),
          resultDetail: `HSET + PUBLISH (구독 ${received})`,
        });
        return;
      }
    }
  }

  private joinTemplate(
    userId: UserId,
    connectionId: string,
    message: Extract<UpMessage, { type: 'HELLO' | 'VIEW_TEMPLATE' }>,
    request: SimEvent,
  ): void {
    const { redis, ws, logger } = this.ctx;
    const templateId = message.templateId;
    this.sessions[userId] = { connectionId, joined: true, templateId };

    const info = this.presenceInfo(userId, connectionId, message.presence);
    redis.hset(presenceKeyOf(templateId), userId, asJson(info));
    this.subscribe(userId, connectionId, templateId);
    redis.publish(presenceChannelOf(templateId), asJson({ userId, info }));

    // syncWatermark 확정 (§8.9.4): 이 순번까지는 SYNC, 이후 승인분은 실시간 Delivery
    // (세션 참여 표시 ~ SYNC 전송은 하나의 처리 단위라 그 사이에 다른 승인이 끼어들지 않는다)
    const syncWatermark = this.broadcaster.currentSeq();
    const targets = targetsOfTemplate(redis, templateId);
    // 처음 보는 템플릿(런타임에 추가된 FIXTURE 등)은 현재 Live 구성 스냅샷으로 최초 로드한다
    const snapshot = `template:${templateId}` in message.lastReceivedRevision ? undefined : this.snapshotOf(templateId);
    const received: Record<string, number> = { ...message.lastReceivedRevision };
    if (snapshot) {
      received[`template:${templateId}`] = snapshot.template.revision;
      for (const b of snapshot.blocks) received[`block:${b.blockId}`] = Math.max(received[`block:${b.blockId}`] ?? 0, b.revision);
    }
    const changes: ChangeEnvelope[] = [];
    for (const target of targets) {
      const after = received[target] ?? 0;
      for (const entry of redis.xrange(streamKeyOf(target))) {
        const env = entry.fields.change as unknown as ChangeEnvelope;
        if (env.streamSeq <= syncWatermark && env.revision > after) changes.push(env);
      }
    }
    changes.sort((a, b) => a.streamSeq - b.streamSeq);

    logger.log({
      name: 'STREAM_READ',
      category: 'redis',
      requestId: message.requestId,
      actorUserId: userId,
      from: 'WS',
      to: ['REDIS'],
      target: `template:${templateId}`,
      payload: asJson({
        keys: targets.map(streamKeyOf),
        after: Object.fromEntries(targets.map((t) => [t, message.lastReceivedRevision[t] ?? 0])),
        syncWatermark,
        entries: changes.length,
      }),
      resultDetail: `XRANGE ${targets.length}개 Stream · ${changes.length}건 · watermark ${syncWatermark}`,
    });

    const presence = Object.fromEntries(
      Object.entries(redis.hgetall(presenceKeyOf(templateId))).filter(([id]) => id !== userId),
    ) as unknown as Record<UserId, PresenceInfo>;

    // 승인 여부를 모르는 요청의 서버 처리 결과 (requestId 기준). revision 증가 여부로 추정하지 않는다.
    const requestResults =
      message.type === 'HELLO' ? Object.fromEntries(message.unconfirmedRequestIds.map((id) => [id, this.edits.resultOf(id)])) : {};

    const response = logger.log({
      name: 'SYNC',
      category: 'response',
      requestId: message.requestId,
      actorUserId: userId,
      from: 'WS',
      to: [userId],
      target: `template:${templateId}`,
      parentSequence: request.sequence,
      payload: asJson({
        templateId,
        syncWatermark,
        changes: changes.map((c) => ({ target: c.target, revision: c.revision, streamSeq: c.streamSeq, name: c.name })),
        presence: Object.keys(presence),
        requestResults,
      }),
      resultDetail: `따라잡기 ${changes.length}건 · watermark ${syncWatermark} · Presence ${Object.keys(presence).length}명`,
      durationMs: this.ctx.clock.now - request.timestamp,
    });

    this.sessions[userId].pendingSync = { requestId: message.requestId, targets, syncWatermark, responseSequence: response.sequence };
    ws.sendToClient(userId, { type: 'SYNC', requestId: message.requestId, templateId, syncWatermark, changes, presence, requestResults, ...(snapshot ? { snapshot } : {}) });
  }

  /** 클라이언트가 SYNC를 적용 완료: 이 시점에만 미전달 Delivery를 DELIVERED(catch-up)로 (§8.9.3) */
  syncApplied(userId: UserId, requestId: string): void {
    const pending = this.sessions[userId]?.pendingSync;
    if (!pending || pending.requestId !== requestId) return;
    this.sessions[userId].pendingSync = undefined;
    this.broadcaster.markCaughtUp(userId, pending.targets, pending.syncWatermark, pending.responseSequence);
  }

  deliveryApplied(deliveryId: string): void {
    this.broadcaster.markApplied(deliveryId);
  }

  private snapshotOf(templateId: string): import('../protocol').TemplateSnapshot {
    const redis = this.ctx.redis;
    const live = readLiveTemplate(redis, templateId)!;
    const meta = (props: Record<string, { revision: number; lastActorUserId: UserId | null }>) =>
      Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { revision: v.revision, lastActorUserId: v.lastActorUserId }]));
    return {
      template: {
        templateId,
        name: (this.ctx.db.get('template', { id: templateId })?.name as string) ?? templateId,
        revision: live.revision,
        structureRevision: live.structureRevision,
      },
      elements: Object.entries(live.elements).map(([elementId, el]) => ({
        elementId,
        blockId: el.blockId,
        sequence: el.sequence,
        renderZone: el.renderZone,
        props: structuredClone(el.props),
        properties: meta(el.properties),
      })),
      blocks: blocksOfTemplate(redis, templateId).map((blockId) => {
        const b = readLiveBlock(redis, blockId)!;
        return { blockId, kind: b.kind, content: structuredClone(b.content), revision: b.revision, properties: meta(b.properties) };
      }),
    };
  }

  private leaveTemplate(userId: UserId): void {
    const session = this.sessions[userId];
    const templateId = session.templateId;
    if (!templateId || !session.connectionId) return;
    this.ctx.redis.unsubscribe(presenceChannelOf(templateId), session.connectionId);
    this.ctx.redis.hdel(presenceKeyOf(templateId), userId);
    this.ctx.redis.publish(presenceChannelOf(templateId), asJson({ userId, info: null }));
    this.sessions[userId] = { ...session, joined: false, templateId: null };
  }

  /** 연결 끊김: Presence 상태를 disconnected로 바꾸고 다른 접속자에게 알린다. 해시 항목은 남겨 Delivery 대상(QUEUED)으로 유지 */
  private handleClose(userId: UserId, connectionId: string): void {
    const session = this.sessions[userId];
    if (session.connectionId !== connectionId) return;
    const templateId = session.templateId;
    this.sessions[userId] = { ...session, joined: false };
    if (templateId) {
      const key = presenceKeyOf(templateId);
      const prev = this.ctx.redis.hget(key, userId) as unknown as PresenceInfo | null;
      const info: PresenceInfo = {
        userId,
        connectionId: null,
        status: 'disconnected',
        selectedElementId: prev?.selectedElementId ?? null,
        selectedPropertyPath: null,
        cursor: null,
        updatedAt: this.ctx.clock.now,
      };
      this.ctx.redis.unsubscribe(presenceChannelOf(templateId), connectionId);
      this.ctx.redis.hset(key, userId, asJson(info));
      this.ctx.redis.publish(presenceChannelOf(templateId), asJson({ userId, info }));
    }
    // 요소 편집 권한은 TTL이 없으므로 연결이 끊기면 서버가 해제하고 기다리던 사용자에게 넘긴다 (v1.2.8)
    this.edits.releaseClaimsOf(userId);
    this.ctx.logger.log({
      name: 'CLIENT_DISCONNECTED',
      category: 'connection',
      actorUserId: userId,
      from: userId,
      to: ['WS'],
      target: templateId ? `template:${templateId}` : null,
      payload: asJson({ connectionId }),
      result: 'INFO',
      resultDetail: '연결 종료 · Presence status=disconnected',
    });
  }

  private subscribe(userId: UserId, connectionId: string, templateId: string): void {
    this.ctx.redis.subscribe(presenceChannelOf(templateId), connectionId, (message) => {
      const m = message as unknown as { userId: UserId; info: PresenceInfo | null };
      if (m.userId === userId) return;
      this.ctx.ws.sendToClient(userId, { type: 'PRESENCE', templateId, userId: m.userId, info: m.info });
    });
  }

  private presenceInfo(userId: UserId, connectionId: string, fields: PresenceFields): PresenceInfo {
    return { userId, connectionId, status: 'connected', ...fields, updatedAt: this.ctx.clock.now };
  }
}
