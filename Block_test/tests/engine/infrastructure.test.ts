import { describe, expect, it } from 'vitest';
import { VirtualClock } from '../../src/engine/clock';
import { MockDatabase } from '../../src/engine/db/mockDatabase';
import { IdGenerator, SEED_ID_COUNTERS } from '../../src/engine/ids';
import { MockWebSocket } from '../../src/engine/net/mockWebSocket';
import { MockRedis } from '../../src/engine/redis/mockRedis';
import { createSeedTables } from '../../src/engine/seed';
import { simTimestamp } from '../../src/engine/simTime';

describe('VirtualClock', () => {
  it('같은 시각의 작업은 예약 순서대로, 진행 중 새로 예약된 작업도 범위 안이면 실행한다', () => {
    const clock = new VirtualClock();
    const order: string[] = [];
    clock.schedule(10, 'b', () => order.push('b'));
    clock.schedule(5, 'a', () => {
      order.push(`a@${clock.now}`);
      clock.schedule(3, 'nested', () => order.push(`nested@${clock.now}`));
    });
    clock.schedule(10, 'c', () => order.push('c'));
    clock.advanceBy(10);
    expect(order).toEqual(['a@5', 'nested@8', 'b', 'c']);
    expect(clock.now).toBe(10);
  });

  it('단계 진행은 다음 작업 하나만 실행하고 그 시각으로 이동한다', () => {
    const clock = new VirtualClock();
    const ran: number[] = [];
    clock.schedule(1000, 'debounce', () => ran.push(clock.now));
    clock.schedule(1300, 'debounce2', () => ran.push(clock.now));
    expect(clock.step()?.label).toBe('debounce');
    expect(clock.now).toBe(1000);
    expect(ran).toEqual([1000]);
    expect(clock.pending()).toHaveLength(1);
  });

  it('취소된 작업은 실행되지 않는다', () => {
    const clock = new VirtualClock();
    let ran = false;
    const id = clock.schedule(100, 'x', () => (ran = true));
    expect(clock.cancel(id)).toBe(true);
    clock.runUntilIdle();
    expect(ran).toBe(false);
  });

  it('시뮬레이션 시각은 고정 기준 시각에서 계산한다 (§7.10)', () => {
    expect(simTimestamp(1030)).toBe('2026-01-01 14:00:01.030');
  });
});

describe('MockDatabase', () => {
  const make = () => {
    const clock = new VirtualClock();
    return new MockDatabase(clock, new IdGenerator(SEED_ID_COUNTERS), createSeedTables());
  };

  it('시드를 무결성 오류 없이 적재한다', () => {
    const db = make();
    expect(db.tables.block).toHaveLength(1);
    expect(db.integrityErrors()).toEqual([]);
  });

  it('UPDATE는 변경 전·후 행과 변경 컬럼을 기록하고, 변경되지 않은 테이블은 참조를 유지한다', () => {
    const db = make();
    const before = db.tables;
    const r = db.transaction({ label: 'debounce flush', requestId: 'REQ001', actorUserId: 'U001' }, (tx) =>
      tx.update('block_live_state', { block_id: 'B001' }, { revision: 1, persisted_revision: 1 }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({
      op: 'UPDATE',
      table: 'block_live_state',
      pk: { block_id: 'B001' },
      changedColumns: ['revision', 'persisted_revision'],
      requestId: 'REQ001',
      actorUserId: 'U001',
    });
    expect(r.changes[0].before?.revision).toBe(0);
    expect(r.changes[0].after?.revision).toBe(1);
    expect(db.tables.block).toBe(before.block);
    expect(db.tables.block_live_state).not.toBe(before.block_live_state);
  });

  it('INSERT는 복합 PK 중복을 거부하고 트랜잭션 전체를 롤백한다', () => {
    const db = make();
    const row = { block_id: 'B001', property_path: 'content', revision: 1, persisted_revision: 0, last_fencing_token: 1, updated_at: simTimestamp(0) };
    const r = db.transaction({ label: 'dup' }, (tx) => {
      tx.insert('block_property_state', row);
      tx.insert('block_property_state', row);
    });
    expect(r).toMatchObject({ ok: false });
    expect(db.tables.block_property_state).toHaveLength(0);
    expect(db.transactions.at(-1)).toMatchObject({ status: 'ROLLED_BACK', attemptedChanges: 1 });
    expect(db.changes).toHaveLength(0);
  });

  it('FK는 커밋 시점에 검사한다 (block ↔ block_version 순환 참조 허용, 잘못된 참조는 거부)', () => {
    const db = make();
    const t = simTimestamp(0);
    const ok = db.transaction({ label: 'new block + version' }, (tx) => {
      tx.insert('block', { id: 'B002', workspace_id: 'W001', kind: 'text', current_version_id: 'BV002', created_by: 'U001', created_at: t });
      tx.insert('block_version', { id: 'BV002', block_id: 'B002', version: 1, changed_by: 'U001', changed_at: t });
    });
    expect(ok.ok).toBe(true);
    const bad = db.transaction({ label: 'dangling' }, (tx) =>
      tx.insert('template_element', { id: 'E009', template_id: 'T001', block_id: 'B999', created_at: t, deleted_at: null }),
    );
    expect(bad).toMatchObject({ ok: false, error: expect.stringContaining('B999') });
    const del = db.transaction({ label: 'delete referenced' }, (tx) => tx.delete('block', { id: 'B001' }));
    expect(del.ok).toBe(false);
    expect(db.integrityErrors()).toEqual([]);
  });

  it('컬럼·NOT NULL·타입을 검사한다', () => {
    const db = make();
    expect(db.transaction({ label: 'x' }, (tx) => tx.update('block', { id: 'B001' }, { nope: 1 })).ok).toBe(false);
    expect(db.transaction({ label: 'x' }, (tx) => tx.update('block', { id: 'B001' }, { kind: null })).ok).toBe(false);
    expect(db.transaction({ label: 'x' }, (tx) => tx.update('block_live_state', { block_id: 'B001' }, { revision: 'a' })).ok).toBe(false);
  });

  it('실패 주입: 쓰기 트랜잭션만 n회 실패하고 롤백한다 (§7.9, 시나리오 L)', () => {
    const db = make();
    db.failNextWrites(2);
    const write = () => db.transaction({ label: 'flush' }, (tx) => tx.update('block_live_state', { block_id: 'B001' }, { revision: 1 }));
    expect(db.transaction({ label: 'read only' }, (tx) => tx.select('block')).ok).toBe(true);
    expect(write()).toMatchObject({ ok: false, error: 'connection reset (mock)' });
    expect(write()).toMatchObject({ ok: false });
    expect(db.tables.block_live_state[0].revision).toBe(0);
    expect(write().ok).toBe(true);
    expect(db.tables.block_live_state[0].revision).toBe(1);
    expect(db.transactions.map((t) => t.status)).toEqual(['COMMITTED', 'ROLLED_BACK', 'ROLLED_BACK', 'COMMITTED']);
  });
});

describe('MockRedis', () => {
  it('SET NX PX: Lock 획득 경쟁과 TTL 만료 (시뮬레이션 시간 기준)', () => {
    const clock = new VirtualClock();
    const redis = new MockRedis(clock);
    const expired: string[] = [];
    redis.onExpire((key) => expired.push(`${key}@${clock.now}`));
    expect(redis.set('lock:block:B001:content', { userId: 'U001' }, { nx: true, px: 10_000 })).toBe(true);
    expect(redis.set('lock:block:B001:content', { userId: 'U002' }, { nx: true, px: 10_000 })).toBe(false);
    clock.advanceBy(4000);
    expect(redis.pttl('lock:block:B001:content')).toBe(6000);
    // TTL 연장: 이전 만료 예약은 무시된다
    redis.pexpire('lock:block:B001:content', 10_000);
    clock.advanceBy(6000);
    expect(redis.exists('lock:block:B001:content')).toBe(true);
    clock.advanceBy(4000);
    expect(redis.exists('lock:block:B001:content')).toBe(false);
    expect(expired).toEqual(['lock:block:B001:content@14000']);
  });

  it('INCR fencing token은 단조 증가한다', () => {
    const redis = new MockRedis(new VirtualClock());
    expect([redis.incr('fence:k'), redis.incr('fence:k'), redis.incr('fence:k')]).toEqual([1, 2, 3]);
  });

  it('Stream: 같은 ms의 항목은 순번으로 구분하고 이후 항목만 읽을 수 있다', () => {
    const clock = new VirtualClock();
    const redis = new MockRedis(clock);
    const a = redis.xadd('stream:block:B001', { revision: 1 });
    const b = redis.xadd('stream:block:B001', { revision: 2 });
    clock.advanceBy(30);
    const c = redis.xadd('stream:block:B001', { revision: 3 });
    expect([a, b, c]).toEqual(['0-0', '0-1', '30-0']);
    expect(redis.xrange('stream:block:B001', a).map((e) => e.fields.revision)).toEqual([2, 3]);
  });

  it('Pub/Sub: 구독자에게 즉시 전달하고 메시지를 저장하지 않는다', () => {
    const redis = new MockRedis(new VirtualClock());
    const got: string[] = [];
    redis.subscribe('presence:template:T001', 'CONN001', (m) => got.push(`1:${JSON.stringify(m)}`));
    const off = redis.subscribe('presence:template:T001', 'CONN002', (m) => got.push(`2:${JSON.stringify(m)}`));
    expect(redis.publish('presence:template:T001', 'x')).toBe(2);
    off();
    expect(redis.publish('presence:template:T001', 'y')).toBe(1);
    expect(got).toEqual(['1:"x"', '2:"x"', '1:"y"']);
    expect(redis.keys('*')).toEqual([]);
    expect(redis.channels['presence:template:T001']).toEqual(['CONN001']);
  });

  it('Hash: 필드 단위로 갱신·삭제한다', () => {
    const redis = new MockRedis(new VirtualClock());
    redis.hset('presence:template:T001', 'U001', { status: 'connected' });
    redis.hset('presence:template:T001', 'U002', { status: 'connected' });
    redis.hdel('presence:template:T001', 'U001');
    expect(Object.keys(redis.hgetall('presence:template:T001'))).toEqual(['U002']);
  });
});

describe('MockWebSocket', () => {
  const setup = () => {
    const clock = new VirtualClock();
    const ws = new MockWebSocket<{ type: string; n: number }, { type: string; n: number }>(clock, new IdGenerator(), ['U001', 'U002']);
    return { clock, ws };
  };

  it('기본 지연 10ms, 같은 연결의 메시지는 FIFO로 도착한다', () => {
    const { clock, ws } = setup();
    const got: string[] = [];
    ws.onServerMessage((u, _c, m) => got.push(`${u}:${m.n}@${clock.now}`));
    ws.open('U001');
    ws.sendToServer('U001', { type: 'X', n: 1 });
    clock.advanceBy(3);
    ws.sendToServer('U001', { type: 'X', n: 2 });
    clock.advanceBy(20);
    expect(got).toEqual(['U001:1@10', 'U001:2@13']);
  });

  it('연결이 없으면 QUEUED, 전송 중 연결이 끊기면 FAILED', () => {
    const { clock, ws } = setup();
    const settled: string[] = [];
    expect(ws.sendToClient('U002', { type: 'X', n: 1 })).toEqual({ status: 'QUEUED' });
    ws.open('U002');
    ws.onClientMessage('U002', () => settled.push('handled'));
    expect(ws.sendToClient('U002', { type: 'X', n: 2 }, (s) => settled.push(s)).status).toBe('SENT');
    ws.close('U002');
    clock.advanceBy(10);
    expect(settled).toEqual(['FAILED']);
  });

  it('재연결은 새 connectionId를 발급하고, 이전 연결로 보낸 메시지는 새 연결에 도착하지 않는다', () => {
    const { clock, ws } = setup();
    const a = ws.open('U001');
    const settled: string[] = [];
    ws.sendToClient('U001', { type: 'X', n: 1 }, (s) => settled.push(s));
    ws.close('U001');
    const b = ws.open('U001');
    clock.advanceBy(10);
    expect(a).not.toBe(b);
    expect(settled).toEqual(['FAILED']);
  });
});
