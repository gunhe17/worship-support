import type { VirtualClock } from './clock';
import type { Json, SimUser, UserId } from './types';

/**
 * EventLogger (DB_SCHEMA §8.7, SIMULATION_SCENARIOS §14).
 * 모든 네트워크·처리 이벤트를 전역 sequence 순서로 기록한다.
 * Presence(Pub/Sub)는 휘발성이므로 별도 링 버퍼에 기록하고, 시나리오 기대값 비교 대상(events)에서 제외한다.
 */

/** Timeline 레인: 클라이언트(userId) 또는 서버 구성 요소 */
export type ServerLane = 'WS' | 'REDIS' | 'WORKER' | 'PG';
export type Lane = UserId | ServerLane;
export const SERVER_LANES: readonly ServerLane[] = ['WS', 'REDIS', 'WORKER', 'PG'];

export type EventCategory =
  | 'request' // Client → WS
  | 'response' // WS → Client (요청자)
  | 'broadcast' // 부모 Broadcast (WS → 수신자들)
  | 'delivery' // 수신자별 Delivery
  | 'connection'
  | 'redis'
  | 'db'
  | 'worker'
  | 'presence'
  | 'system';

export type EventResult = 'OK' | 'DENIED' | 'FAILED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'PARTIAL' | 'INFO';

export interface SimEvent {
  /** 전역 순번. Presence 이벤트는 별도 순번(presenceSequence)을 쓴다 (§8.9.6) */
  sequence: number;
  name: string;
  category: EventCategory;
  requestId: string | null;
  actorUserId: UserId | null;
  actorName: string | null;
  /** 시뮬레이션 경과 ms */
  timestamp: number;
  from: Lane;
  to: Lane[];
  /** 'block:B001' · 'template:T001' · 'template:T001/element:E001' */
  target: string | null;
  propertyPath: string | null;
  payload: Json;
  result: EventResult;
  resultDetail: string | null;
  /** 요청 → 처리 완료까지 걸린 시간 (응답·Delivery 이벤트) */
  durationMs: number | null;
  /** 관련 이벤트 (Delivery → Broadcast, 응답 → 요청) */
  parentSequence: number | null;
  broadcastId: string | null;
  deliveryId: string | null;
  /** 시나리오 precondition 구간 표시 (Phase 3+) */
  section: 'PRECONDITION' | null;
}

export type EventInput = Partial<Omit<SimEvent, 'sequence' | 'timestamp' | 'actorName'>> &
  Pick<SimEvent, 'name' | 'category' | 'from'>;

const PRESENCE_LIMIT = 300;

export class EventLogger {
  private seq = 0;
  private presenceSeq = 0;
  private _events: SimEvent[] = [];
  private _presence: SimEvent[] = [];
  private section: SimEvent['section'] = null;
  version = 0;

  constructor(
    private clock: VirtualClock,
    private users: readonly SimUser[],
  ) {}

  get events(): readonly SimEvent[] {
    return this._events;
  }
  get presenceEvents(): readonly SimEvent[] {
    return this._presence;
  }

  setSection(section: SimEvent['section']): void {
    this.section = section;
  }

  log(input: EventInput): SimEvent {
    const actorUserId = input.actorUserId ?? null;
    const event: SimEvent = {
      requestId: null,
      to: [],
      target: null,
      propertyPath: null,
      payload: null,
      result: 'OK',
      resultDetail: null,
      durationMs: null,
      parentSequence: null,
      broadcastId: null,
      deliveryId: null,
      section: this.section,
      ...input,
      actorUserId,
      actorName: actorUserId ? (this.users.find((u) => u.userId === actorUserId)?.name ?? null) : null,
      sequence: input.category === 'presence' ? ++this.presenceSeq : ++this.seq,
      timestamp: this.clock.now,
    };
    if (event.category === 'presence') this._presence = [...this._presence.slice(-(PRESENCE_LIMIT - 1)), event];
    else this._events = [...this._events, event];
    this.version++;
    return event;
  }
}

/**
 * Timeline 필터 (MU-6): actorUserId가 일치하는 이벤트만. Presence는 명시적으로 포함할 때만.
 * Presence를 섞을 때는 timestamp 순, 같은 시각이면 네트워크·처리 이벤트 먼저 (§8.9.6).
 */
export function filterEvents(
  events: readonly SimEvent[],
  presence: readonly SimEvent[],
  opts: { actorUserId: UserId | 'all'; includePresence: boolean },
): SimEvent[] {
  const rank = (e: SimEvent) => (e.category === 'presence' ? 1 : 0);
  const merged = opts.includePresence
    ? [...events, ...presence].sort((a, b) => a.timestamp - b.timestamp || rank(a) - rank(b) || a.sequence - b.sequence)
    : [...events];
  return opts.actorUserId === 'all' ? merged : merged.filter((e) => e.actorUserId === opts.actorUserId);
}
