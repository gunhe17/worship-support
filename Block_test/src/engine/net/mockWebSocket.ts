import type { VirtualClock } from '../clock';
import type { IdGenerator } from '../ids';
import type { UserId } from '../types';

/**
 * MockWebSocket (CLAUDE_PROMPT §6): 사용자별 연결과 메시지 전달을 VirtualClock 지연으로 시뮬레이션한다.
 * - 기본 지연 10ms (DB_SCHEMA §7.10). 같은 연결의 메시지는 보낸 순서대로 도착한다 (FIFO).
 * - 메시지는 보낸 시점의 connectionId에 묶인다. 도착 시점에 연결이 끊겼거나 새 연결이면 유실(FAILED)된다.
 * - 연결이 끊긴 사용자에게 보내는 메시지는 전송하지 않고 QUEUED를 반환한다. (재연결 시 Stream으로 따라잡기)
 */

export type TransportStatus = 'connected' | 'disconnected';

export interface ConnectionInfo {
  userId: UserId;
  connectionId: string | null;
  status: TransportStatus;
  since: number;
}

export interface InflightMessage {
  messageId: string;
  direction: 'up' | 'down';
  userId: UserId;
  connectionId: string;
  type: string;
  sentAt: number;
  dueAt: number;
}

export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'QUEUED' | 'FAILED';

interface Handlers<Up, Down> {
  server?: (userId: UserId, connectionId: string, message: Up) => void;
  close?: (userId: UserId, connectionId: string) => void;
  client: Map<UserId, (message: Down) => void>;
}

export class MockWebSocket<Up extends { type: string }, Down extends { type: string }> {
  private _connections: Record<UserId, ConnectionInfo> = {};
  private _inflight: InflightMessage[] = [];
  private handlers: Handlers<Up, Down> = { client: new Map() };
  latencyMs: number;
  version = 0;
  /** 유실 주입: 사용자별로 다음 도착 메시지 중 지정한 type n건을 버린다 (테스트·오류 주입용) */
  private drops = new Map<UserId, { type: string; remaining: number }>();

  constructor(
    private clock: VirtualClock,
    private ids: IdGenerator,
    users: readonly UserId[],
    latencyMs = 10,
  ) {
    this.latencyMs = latencyMs;
    for (const userId of users) this._connections[userId] = { userId, connectionId: null, status: 'disconnected', since: 0 };
  }

  get connections(): Readonly<Record<UserId, ConnectionInfo>> {
    return this._connections;
  }
  get inflight(): readonly InflightMessage[] {
    return this._inflight;
  }

  onServerMessage(handler: (userId: UserId, connectionId: string, message: Up) => void): void {
    this.handlers.server = handler;
  }
  onClose(handler: (userId: UserId, connectionId: string) => void): void {
    this.handlers.close = handler;
  }
  onClientMessage(userId: UserId, handler: (message: Down) => void): void {
    this.handlers.client.set(userId, handler);
  }

  /** 연결은 유지된 채 다음 n건의 Server → Client 메시지(type)가 유실되도록 한다 */
  dropNextToClient(userId: UserId, type: string, count = 1): void {
    this.drops.set(userId, { type, remaining: count });
  }

  isConnected(userId: UserId): boolean {
    return this._connections[userId]?.status === 'connected';
  }

  connectionIdOf(userId: UserId): string | null {
    return this._connections[userId]?.connectionId ?? null;
  }

  /** 전송 계층 연결 수립 (새 connectionId 발급) */
  open(userId: UserId): string {
    const connectionId = this.ids.next('CONN');
    this.setConnection(userId, { userId, connectionId, status: 'connected', since: this.clock.now });
    return connectionId;
  }

  /** 연결 끊김. 서버 close 핸들러를 즉시 호출하고, 이 연결의 전송 중 메시지는 도착 시 유실된다. */
  close(userId: UserId): void {
    const cur = this._connections[userId];
    if (!cur || cur.status === 'disconnected' || !cur.connectionId) return;
    this.setConnection(userId, { ...cur, status: 'disconnected', since: this.clock.now });
    this.handlers.close?.(userId, cur.connectionId);
  }

  /** Client → Server */
  sendToServer(userId: UserId, message: Up): { ok: true; messageId: string; dueAt: number } | { ok: false; reason: 'DISCONNECTED' } {
    const conn = this._connections[userId];
    if (!conn || conn.status !== 'connected' || !conn.connectionId) return { ok: false, reason: 'DISCONNECTED' };
    const connectionId = conn.connectionId;
    const { messageId, dueAt } = this.enqueue('up', userId, connectionId, message.type, () => {
      if (this._connections[userId]?.connectionId !== connectionId || !this.isConnected(userId)) return;
      this.handlers.server?.(userId, connectionId, message);
    });
    return { ok: true, messageId, dueAt };
  }

  /**
   * Server → Client.
   * 연결되어 있으면 SENT를 반환하고 도착 시 onSettled(DELIVERED | FAILED)를 호출한다.
   * 연결이 없으면 전송하지 않고 QUEUED를 반환한다.
   */
  sendToClient(
    userId: UserId,
    message: Down,
    onSettled?: (status: 'DELIVERED' | 'FAILED', at: number) => void,
  ): { status: 'SENT'; dueAt: number } | { status: 'QUEUED' } {
    const conn = this._connections[userId];
    if (!conn || conn.status !== 'connected' || !conn.connectionId) return { status: 'QUEUED' };
    const connectionId = conn.connectionId;
    const { dueAt } = this.enqueue('down', userId, connectionId, message.type, () => {
      const drop = this.drops.get(userId);
      const dropped = !!drop && drop.type === message.type && drop.remaining > 0;
      if (dropped) {
        drop.remaining--;
        if (drop.remaining === 0) this.drops.delete(userId);
      }
      const alive = !dropped && this._connections[userId]?.connectionId === connectionId && this.isConnected(userId);
      if (alive) this.handlers.client.get(userId)?.(message);
      onSettled?.(alive ? 'DELIVERED' : 'FAILED', this.clock.now);
    });
    return { status: 'SENT', dueAt };
  }

  private enqueue(direction: 'up' | 'down', userId: UserId, connectionId: string, type: string, deliver: () => void) {
    const messageId = this.ids.next('MSG', 4);
    const dueAt = this.clock.now + this.latencyMs;
    this._inflight = [...this._inflight, { messageId, direction, userId, connectionId, type, sentAt: this.clock.now, dueAt }];
    this.version++;
    this.clock.schedule(this.latencyMs, `ws ${direction === 'up' ? `${userId}→WS` : `WS→${userId}`} ${type}`, () => {
      this._inflight = this._inflight.filter((m) => m.messageId !== messageId);
      this.version++;
      deliver();
    });
    return { messageId, dueAt };
  }

  private setConnection(userId: UserId, info: ConnectionInfo): void {
    this._connections = { ...this._connections, [userId]: info };
    this.version++;
  }
}
