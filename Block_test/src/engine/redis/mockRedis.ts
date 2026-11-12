import type { VirtualClock } from '../clock';
import type { Json } from '../types';

/**
 * MockRedis (DB_SCHEMA §4, §7.5, §8.2).
 * 지원 자료형: string(JSON 값), hash, stream. 그리고 Pub/Sub 채널.
 * - TTL은 VirtualClock 기준이다. 만료 시각에 키를 지우고 만료 리스너를 호출한다 (Lock 만료).
 * - 데이터는 copy-on-write로 갱신해 스냅샷 참조를 안정적으로 유지한다.
 * - Pub/Sub 메시지는 저장하지 않는다 (휘발성). Stream은 저장한다.
 */

export interface StreamEntry {
  id: string;
  fields: Record<string, Json>;
}

export type RedisValue =
  | { type: 'string'; value: Json; expiresAt: number | null }
  | { type: 'hash'; fields: Record<string, Json>; expiresAt: number | null }
  | { type: 'stream'; entries: StreamEntry[]; expiresAt: null };

export interface RedisCommandLog {
  seq: number;
  at: number;
  command: string;
  key: string;
  detail: string;
  result: string;
}

export type PubSubListener = (message: Json, channel: string) => void;

const COMMAND_LOG_LIMIT = 200;

/** glob 패턴 (*, ?) → RegExp */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

const short = (v: unknown) => {
  const s = JSON.stringify(v);
  return s && s.length > 80 ? `${s.slice(0, 77)}...` : (s ?? '');
};

export class MockRedis {
  private _data: Record<string, RedisValue> = {};
  private _log: RedisCommandLog[] = [];
  private logSeq = 0;
  private streamSeq = new Map<string, { ms: number; n: number }>();
  private subscribers = new Map<string, Map<string, PubSubListener>>();
  private expireListeners = new Set<(key: string, value: RedisValue) => void>();
  private _channels: Record<string, string[]> = {};
  version = 0;

  constructor(private clock: VirtualClock) {}

  /* ---------------- 스냅샷 ---------------- */

  get data(): Readonly<Record<string, RedisValue>> {
    return this._data;
  }
  get commandLog(): readonly RedisCommandLog[] {
    return this._log;
  }
  /** 채널 → 구독자 ID 목록 */
  get channels(): Readonly<Record<string, string[]>> {
    return this._channels;
  }

  /* ---------------- 내부 ---------------- */

  private write(key: string, value: RedisValue | undefined): void {
    const next = { ...this._data };
    if (value === undefined) delete next[key];
    else next[key] = value;
    this._data = next;
    this.version++;
  }

  private record(command: string, key: string, detail: unknown, result: unknown): void {
    const entry: RedisCommandLog = {
      seq: ++this.logSeq,
      at: this.clock.now,
      command,
      key,
      detail: typeof detail === 'string' ? detail : short(detail),
      result: typeof result === 'string' ? result : short(result),
    };
    this._log = [...this._log.slice(-(COMMAND_LOG_LIMIT - 1)), entry];
    this.version++;
  }

  /** 만료된 키는 읽기 시점에도 제거한다 (lazy expire) */
  private read(key: string): RedisValue | undefined {
    const v = this._data[key];
    if (v && v.expiresAt !== null && v.expiresAt <= this.clock.now) {
      this.expireNow(key, v);
      return undefined;
    }
    return v;
  }

  private expireNow(key: string, value: RedisValue): void {
    if (this._data[key] !== value) return;
    this.write(key, undefined);
    this.record('EXPIRED', key, '', 'deleted');
    this.expireListeners.forEach((l) => l(key, value));
  }

  private scheduleExpiry(key: string): void {
    const v = this._data[key];
    if (!v || v.expiresAt === null) return;
    this.clock.schedule(v.expiresAt - this.clock.now, `redis TTL ${key}`, () => {
      const cur = this._data[key];
      // 다시 설정되었거나 TTL이 연장된 키는 그 시점의 예약이 처리한다
      if (cur === v) this.expireNow(key, cur);
    });
  }

  onExpire(listener: (key: string, value: RedisValue) => void): () => void {
    this.expireListeners.add(listener);
    return () => this.expireListeners.delete(listener);
  }

  /* ---------------- string ---------------- */

  get(key: string): Json | null {
    const v = this.read(key);
    if (!v) return null;
    if (v.type !== 'string') throw new Error(`WRONGTYPE ${key}`);
    return v.value;
  }

  /** SET key value [PX ms] [NX] → 설정 여부 */
  set(key: string, value: Json, opts: { px?: number; nx?: boolean; keepTtl?: boolean } = {}): boolean {
    const existing = this.read(key);
    if (opts.nx && existing) {
      this.record('SET', key, `${short(value)} NX${opts.px ? ` PX ${opts.px}` : ''}`, 'nil');
      return false;
    }
    const expiresAt =
      opts.px !== undefined ? this.clock.now + opts.px : opts.keepTtl && existing ? existing.expiresAt : null;
    this.write(key, { type: 'string', value: structuredClone(value), expiresAt });
    this.record('SET', key, `${short(value)}${opts.nx ? ' NX' : ''}${opts.px !== undefined ? ` PX ${opts.px}` : ''}`, 'OK');
    this.scheduleExpiry(key);
    return true;
  }

  del(...keys: string[]): number {
    let n = 0;
    for (const key of keys) {
      if (this.read(key)) {
        this.write(key, undefined);
        n++;
      }
    }
    this.record('DEL', keys.join(' '), '', n);
    return n;
  }

  exists(key: string): boolean {
    return this.read(key) !== undefined;
  }

  incr(key: string): number {
    const cur = this.read(key);
    const n = (cur && cur.type === 'string' && typeof cur.value === 'number' ? cur.value : 0) + 1;
    this.write(key, { type: 'string', value: n, expiresAt: cur?.expiresAt ?? null });
    this.record('INCR', key, '', n);
    return n;
  }

  pexpire(key: string, ms: number): boolean {
    const cur = this.read(key);
    if (!cur || cur.type === 'stream') return false;
    this.write(key, { ...cur, expiresAt: this.clock.now + ms });
    this.record('PEXPIRE', key, ms, 1);
    this.scheduleExpiry(key);
    return true;
  }

  /** 남은 TTL(ms). 키 없음 -2, TTL 없음 -1 */
  pttl(key: string): number {
    const cur = this.read(key);
    if (!cur) return -2;
    if (cur.expiresAt === null) return -1;
    return cur.expiresAt - this.clock.now;
  }

  keys(pattern = '*'): string[] {
    const re = globToRegExp(pattern);
    return Object.keys(this._data)
      .filter((k) => re.test(k) && this.read(k))
      .sort();
  }

  /* ---------------- hash ---------------- */

  hset(key: string, field: string, value: Json): void {
    const cur = this.read(key);
    if (cur && cur.type !== 'hash') throw new Error(`WRONGTYPE ${key}`);
    const fields = { ...(cur?.fields ?? {}), [field]: structuredClone(value) };
    this.write(key, { type: 'hash', fields, expiresAt: cur?.expiresAt ?? null });
    this.record('HSET', key, `${field} ${short(value)}`, 1);
  }

  hget(key: string, field: string): Json | null {
    const cur = this.read(key);
    if (!cur) return null;
    if (cur.type !== 'hash') throw new Error(`WRONGTYPE ${key}`);
    return cur.fields[field] ?? null;
  }

  hdel(key: string, field: string): number {
    const cur = this.read(key);
    if (!cur || cur.type !== 'hash' || !(field in cur.fields)) return 0;
    const fields = { ...cur.fields };
    delete fields[field];
    this.write(key, Object.keys(fields).length ? { ...cur, fields } : undefined);
    this.record('HDEL', key, field, 1);
    return 1;
  }

  hgetall(key: string): Record<string, Json> {
    const cur = this.read(key);
    if (!cur) return {};
    if (cur.type !== 'hash') throw new Error(`WRONGTYPE ${key}`);
    return cur.fields;
  }

  /* ---------------- stream ---------------- */

  /** XADD key * fields → "{ms}-{n}" */
  xadd(key: string, fields: Record<string, Json>): string {
    const cur = this.read(key);
    if (cur && cur.type !== 'stream') throw new Error(`WRONGTYPE ${key}`);
    const now = this.clock.now;
    const last = this.streamSeq.get(key);
    const n = last && last.ms === now ? last.n + 1 : 0;
    this.streamSeq.set(key, { ms: now, n });
    const id = `${now}-${n}`;
    const entries = [...(cur?.entries ?? []), { id, fields: structuredClone(fields) }];
    this.write(key, { type: 'stream', entries, expiresAt: null });
    this.record('XADD', key, fields, id);
    return id;
  }

  /** XRANGE key (afterId + → afterId 이후 항목 */
  xrange(key: string, afterId?: string): StreamEntry[] {
    const cur = this.read(key);
    if (!cur) return [];
    if (cur.type !== 'stream') throw new Error(`WRONGTYPE ${key}`);
    if (!afterId) return cur.entries;
    const [ms, n] = afterId.split('-').map(Number);
    return cur.entries.filter((e) => {
      const [ems, en] = e.id.split('-').map(Number);
      return ems > ms || (ems === ms && en > n);
    });
  }

  /* ---------------- Pub/Sub ---------------- */

  subscribe(channel: string, subscriberId: string, listener: PubSubListener): () => void {
    const subs = this.subscribers.get(channel) ?? new Map<string, PubSubListener>();
    subs.set(subscriberId, listener);
    this.subscribers.set(channel, subs);
    this.syncChannels();
    this.record('SUBSCRIBE', channel, subscriberId, subs.size);
    return () => this.unsubscribe(channel, subscriberId);
  }

  unsubscribe(channel: string, subscriberId: string): void {
    const subs = this.subscribers.get(channel);
    if (!subs?.delete(subscriberId)) return;
    if (subs.size === 0) this.subscribers.delete(channel);
    this.syncChannels();
    this.record('UNSUBSCRIBE', channel, subscriberId, subs.size);
  }

  /** PUBLISH → 수신 구독자 수. 메시지는 저장하지 않는다. */
  publish(channel: string, message: Json): number {
    const subs = [...(this.subscribers.get(channel)?.entries() ?? [])];
    this.record('PUBLISH', channel, message, subs.length);
    for (const [, listener] of subs) listener(message, channel);
    return subs.length;
  }

  private syncChannels(): void {
    this._channels = Object.fromEntries(
      [...this.subscribers.entries()].map(([ch, subs]) => [ch, [...subs.keys()].sort()]),
    );
    this.version++;
  }
}
