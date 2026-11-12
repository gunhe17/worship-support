import { beforeEach, describe, expect, it } from 'vitest';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import type { ChangeEnvelope } from '../../src/engine/protocol';
import { STREAM_SEQ_KEY } from '../../src/engine/server/broadcaster';
import { approveContent, approveMove } from './helpers';

/** DB_SCHEMA §8.9.7 검증 조건 SY-1 ~ SY-9 */

let engine: SimulationEngine;
const world = () => engine.store.getState();
const client = (id: string) => world().clients[id];
const replica = (id: string) => client(id).replica;
const body = (id: string) => replica(id).documentView.blocks.B001.content.body;
const deliveriesOf = (userId: string) =>
  Object.values(world().deliveries)
    .filter((d) => d.recipientUserId === userId)
    .sort((a, b) => a.streamSeq - b.streamSeq);
const eventsNamed = (name: string) => world().events.filter((e) => e.name === name);
const streamEntries = () =>
  engine.internals.redis
    .keys('stream:*')
    .flatMap((k) => engine.internals.redis.xrange(k).map((e) => e.fields.change as unknown as ChangeEnvelope));

beforeEach(() => {
  engine = createSimulationEngine();
});

describe('SY-1 여러 Stream의 전역 순번 정합성', () => {
  it('block·template Stream 항목의 streamSeq는 중복 없이 단조 증가하고 seq:stream과 일치한다', () => {
    approveContent(engine, 'U001', 'a');
    approveMove(engine, 'U002', 'T001', 'E001', 200);
    approveContent(engine, 'U003', 'b');
    approveMove(engine, 'U001', 'T001', 'E001', 300);
    engine.runUntilIdle();
    const seqs = streamEntries().map((e) => e.streamSeq).sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4]);
    expect(engine.internals.redis.get(STREAM_SEQ_KEY)).toBe(4);
    // 각 Stream 안에서도 기록 순서 = 순번 순서
    for (const key of engine.internals.redis.keys('stream:*')) {
      const s = engine.internals.redis.xrange(key).map((e) => e.fields.streamSeq as number);
      expect(s).toEqual([...s].sort((a, b) => a - b));
    }
    // 소비자는 자신에게 온 항목만 받으므로 lastProcessedSeq는 받은 최대 순번
    expect(client('U002').lastProcessedSeq).toBe(4);
  });
});

describe('SY-2 중복 Stream 이벤트의 중복 처리 방지', () => {
  it('같은 Delivery 메시지를 두 번 받아도 한 번만 적용되고 상태가 되돌아가지 않는다', () => {
    approveContent(engine, 'U001', 'once');
    engine.runUntilIdle();
    const d = deliveriesOf('U002')[0];
    const env = streamEntries()[0];
    const before = replica('U002');
    engine.internals.ws.sendToClient('U002', { type: 'CHANGE', broadcastId: d.broadcastId, deliveryId: d.deliveryId, change: env });
    engine.runUntilIdle();
    expect(replica('U002').documentView).toBe(before.documentView);
    expect(replica('U002').lastReceivedRevision['block:B001']).toBe(1);
    expect(client('U002').lastProcessedSeq).toBe(1);
    expect(eventsNamed('HELLO')).toHaveLength(0);
  });

  it('실시간 수신 후 SYNC로 같은 항목을 다시 읽어도 중복 적용하지 않는다', () => {
    approveContent(engine, 'U001', 'A');
    approveContent(engine, 'U001', 'B');
    engine.runUntilIdle();
    const before = replica('U002');
    // 블록의 마지막 수신 revision을 0으로 보내 Stream을 다시 읽게 한다 (템플릿은 알고 있으므로 스냅샷 없음)
    engine.internals.ws.sendToServer('U002', {
      type: 'HELLO',
      requestId: 'REQ-TEST',
      templateId: 'T001',
      lastReceivedRevision: { 'template:T001': 0, 'block:B001': 0 },
      lastProcessedSeq: 0,
      presence: { selectedElementId: null, selectedPropertyPath: null, cursor: null },
      recovery: { reason: 'reconnect' },
      unconfirmedRequestIds: [],
    });
    engine.runUntilIdle();
    const sync = eventsNamed('SYNC').at(-1)!;
    expect((sync.payload as { changes: unknown[] }).changes).toHaveLength(2);
    expect(replica('U002').documentView).toBe(before.documentView);
    expect(replica('U002').lastReceivedRevision['block:B001']).toBe(2);
    expect(client('U002').lastProcessedSeq).toBe(2);
    expect(body('U002')).toBe('B');
  });
});

describe('SY-3 누락 감지와 복구', () => {
  it('revision이 건너뛴 실시간 Delivery는 적용하지 않고, 같은 연결의 HELLO → SYNC로 복구한다', () => {
    approveContent(engine, 'U001', 'r1');
    engine.runUntilIdle();
    engine.internals.ws.dropNextToClient('U002', 'CHANGE'); // r2 유실 (연결은 유지)
    approveContent(engine, 'U001', 'r2');
    approveContent(engine, 'U001', 'r3');
    engine.advanceBy(10);
    // r3 도착 → revision 누락 감지 → 적용하지 않음
    expect(body('U002')).toBe('r1');
    expect(client('U002').sync).toBe('catching-up');
    engine.runUntilIdle();
    expect(eventsNamed('HELLO').at(-1)!.payload).toMatchObject({ recovery: { reason: 'gap', target: 'block:B001', receivedRevision: 3, receivedSeq: 3 } });
    expect(body('U002')).toBe('r3');
    expect(client('U002')).toMatchObject({ sync: 'synced', lastProcessedSeq: 3 });
    expect(replica('U002').lastReceivedRevision['block:B001']).toBe(3);
    const [, d2, d3] = deliveriesOf('U002');
    expect(d2).toMatchObject({ revision: 2, status: 'DELIVERED', via: 'catch-up' });
    expect(d3).toMatchObject({ revision: 3, status: 'DELIVERED', via: 'catch-up' });
    // 다른 수신자는 영향 없음
    expect(deliveriesOf('U003').every((d) => d.via === 'live')).toBe(true);
  });

  it('같은 연결에서 streamSeq가 역전된 Delivery도 적용하지 않고 복구한다', () => {
    approveContent(engine, 'U001', 'r1');
    approveMove(engine, 'U001', 'T001', 'E001', 250);
    engine.runUntilIdle();
    // seq 1(B001 r1)은 이미 적용됨. 새 대상처럼 보이지만 순번이 lastProcessedSeq(2)보다 작은 항목
    const old = streamEntries().find((e) => e.streamSeq === 1)!;
    engine.internals.ws.sendToClient('U002', {
      type: 'CHANGE',
      broadcastId: 'BC-T',
      deliveryId: 'DL-T',
      change: { ...old, target: 'block:B999', revision: 1 },
    });
    engine.advanceBy(10); // 도착 → 역전 감지, HELLO 전송
    expect(client('U002').sync).toBe('catching-up');
    engine.advanceBy(10); // HELLO 서버 도착
    expect(eventsNamed('HELLO').at(-1)!.payload).toMatchObject({ recovery: { reason: 'out-of-order' } });
    engine.runUntilIdle();
    expect(client('U002').sync).toBe('synced');
    expect(replica('U002').lastReceivedRevision['block:B999']).toBeUndefined();
  });
});

describe('SY-4 disconnected 사용자의 QUEUED 유지', () => {
  it('연결이 끊긴 동안의 Delivery는 시간이 지나도 QUEUED이며 DELIVERED가 되지 않는다', () => {
    engine.disconnect('U003');
    approveContent(engine, 'U001', 'a');
    approveMove(engine, 'U002', 'T001', 'E001', 220);
    approveContent(engine, 'U004', 'b');
    engine.advanceBy(10_000);
    expect(deliveriesOf('U003').map((d) => d.status)).toEqual(['QUEUED', 'QUEUED', 'QUEUED']);
    expect(world().broadcasts.every((b) => b.status === 'PARTIAL')).toBe(true);
    expect(client('U003')).toMatchObject({ sync: 'offline', lastProcessedSeq: 0 });
    expect(replica('U003').lastReceivedRevision).toMatchObject({ 'block:B001': 0, 'template:T001': 0 });
    // Presence 상태와 Delivery 상태는 독립: Presence는 disconnected로 남아 수신 대상에 포함된다
    expect(engine.internals.redis.hget('presence:template:T001', 'U003')).toMatchObject({ status: 'disconnected', connectionId: null });
    expect(client('U001').presence.U003.status).toBe('disconnected');
  });
});

describe('SY-5 재연결: syncWatermark 이전 이벤트 누락 방지', () => {
  it('끊김 중·전송 연결만 열린 상태·HELLO 처리 전에 승인된 변경이 모두 SYNC에 포함된다', () => {
    engine.disconnect('U002');
    approveContent(engine, 'U001', 'offline');
    engine.connect('U002');
    approveMove(engine, 'U001', 'T001', 'E001', 260); // 전송 연결은 열림, HELLO 미처리 → QUEUED
    engine.advanceBy(5);
    approveContent(engine, 'U003', 'before-hello'); // 여전히 HELLO 처리 전
    expect(deliveriesOf('U002').map((d) => d.status)).toEqual(['QUEUED', 'QUEUED', 'QUEUED']);
    engine.runUntilIdle();
    const read = eventsNamed('STREAM_READ').at(-1)!;
    expect(read.payload).toMatchObject({ syncWatermark: 3, entries: 3 });
    const sync = eventsNamed('SYNC').at(-1)!;
    expect((sync.payload as { changes: { streamSeq: number }[] }).changes.map((c) => c.streamSeq)).toEqual([1, 2, 3]);
    expect(body('U002')).toBe('before-hello');
    expect(replica('U002').documentView.elements.E001.props.position.y).toBe(260);
    expect(deliveriesOf('U002').every((d) => d.status === 'DELIVERED' && d.via === 'catch-up')).toBe(true);
  });
});

describe('SY-6 SYNC 중 신규 이벤트의 정상 전달', () => {
  it('watermark 이후 승인분은 SYNC에서 제외되고, SYNC보다 먼저 도착해도 보류 후 정확히 1회 반영된다', () => {
    engine.disconnect('U002');
    approveContent(engine, 'U001', 'r1');
    engine.connect('U002');
    engine.internals.ws.latencyMs = 50; // HELLO(10ms 전에 이미 전송) 이후 SYNC 응답을 늦춘다
    engine.advanceBy(10); // HELLO 처리 → watermark=1 확정, SYNC 전송 (도착 t=60)
    engine.internals.ws.latencyMs = 10;
    approveContent(engine, 'U001', 'r2'); // watermark 이후 → 실시간 Delivery (도착 t=20, SYNC보다 먼저)
    engine.advanceBy(15);
    expect(client('U002')).toMatchObject({ sync: 'catching-up', bufferedCount: 1 });
    expect(body('U002')).toBe('안녕하세요');

    engine.runUntilIdle();
    const sync = eventsNamed('SYNC').at(-1)!;
    expect(sync.payload).toMatchObject({ syncWatermark: 1 });
    expect((sync.payload as { changes: { streamSeq: number }[] }).changes.map((c) => c.streamSeq)).toEqual([1]);
    expect(body('U002')).toBe('r2');
    expect(replica('U002').documentView.blocks.B001.properties.content.revision).toBe(2);
    expect(client('U002')).toMatchObject({ sync: 'synced', bufferedCount: 0, lastProcessedSeq: 2 });
    const [d1, d2] = deliveriesOf('U002');
    expect(d1).toMatchObject({ streamSeq: 1, status: 'DELIVERED', via: 'catch-up' });
    expect(d2).toMatchObject({ streamSeq: 2, status: 'DELIVERED', via: 'live' });
    // Delivery 이벤트도 각 1회
    expect(world().events.filter((e) => e.name === 'DELIVERY' && e.deliveryId === d2.deliveryId && e.result === 'DELIVERED')).toHaveLength(1);
  });

  it('SYNC와 같은 시점 이후의 승인분은 FIFO로 SYNC 다음에 도착해 누락·중복 없이 반영된다', () => {
    engine.disconnect('U004');
    approveContent(engine, 'U001', 'r1');
    engine.connect('U004');
    engine.advanceBy(10); // HELLO 처리
    approveContent(engine, 'U001', 'r2');
    approveContent(engine, 'U002', 'r3');
    engine.runUntilIdle();
    expect(body('U004')).toBe('r3');
    expect(deliveriesOf('U004').map((d) => d.via)).toEqual(['catch-up', 'live', 'live']);
  });
});

describe('SY-7 SYNC 완료 상태', () => {
  it('lastReceivedRevision과 lastProcessedSeq(= watermark)가 정확하고, SYNC 적용 전에는 DELIVERED가 되지 않는다', () => {
    engine.disconnect('U003');
    approveContent(engine, 'U001', 'a');
    approveMove(engine, 'U001', 'T001', 'E001', 400);
    engine.connect('U003');
    engine.advanceBy(10); // HELLO 처리, SYNC 전송 중
    expect(deliveriesOf('U003').map((d) => d.status)).toEqual(['QUEUED', 'QUEUED']);
    expect(client('U003').sync).toBe('catching-up');
    engine.advanceBy(10); // SYNC 도착·적용
    expect(client('U003')).toMatchObject({ sync: 'synced', lastProcessedSeq: 2 });
    expect(replica('U003').lastReceivedRevision).toMatchObject({ 'block:B001': 1, 'template:T001': 1 });
    expect(deliveriesOf('U003').map((d) => d.status)).toEqual(['DELIVERED', 'DELIVERED']);
  });
});

describe('SY-8 Presence 요청은 REQ 순번과 이벤트 순서에 영향을 주지 않는다', () => {
  const run = (withPresence: boolean) => {
    engine = createSimulationEngine();
    const presence = (i: number) => {
      if (!withPresence) return;
      engine.updateLocal('U001', { cursorPosition: { x: i, y: i } });
      // v1.2.8: 요소 선택은 편집 권한 요청(네트워크 명령)이라 Presence 활동이 아니다 → 순수 Presence(커서)만 사용
      engine.updateLocal('U002', { cursorPosition: { x: i * 3, y: 2 } });
      engine.updateLocal('U003', { cursorPosition: { x: i * 2, y: 1 } });
    };
    presence(1);
    approveContent(engine, 'U001', 'A');
    presence(2);
    engine.advanceBy(30);
    presence(3);
    engine.disconnect('U003');
    approveMove(engine, 'U002', 'T001', 'E001', 300);
    presence(4);
    engine.advanceBy(70);
    engine.connect('U003');
    presence(5);
    approveContent(engine, 'U004', 'B');
    engine.runUntilIdle();
    return world();
  };

  it('Presence 활동 유무와 관계없이 이벤트 로그(sequence, REQ 순번, 순서, 내용)가 동일하다', () => {
    const quiet = run(false);
    const busy = run(true);
    expect(busy.presenceEvents.length).toBeGreaterThan(5);
    expect(JSON.stringify(busy.events)).toBe(JSON.stringify(quiet.events));
    expect(busy.events.map((e) => e.sequence)).toEqual(busy.events.map((_, i) => i + 1));
    const reqIds = busy.events.map((e) => e.requestId).filter((r): r is string => !!r && r.startsWith('REQ'));
    expect(reqIds.length).toBeGreaterThan(0);
    expect(busy.presenceEvents.every((e) => e.requestId?.startsWith('PRS'))).toBe(true);
    // Presence 순번은 별도 카운터로 1부터 연속
    expect(busy.presenceEvents.map((e) => e.sequence)).toEqual(busy.presenceEvents.map((_, i) => i + 1));
  });
});

describe('SY-9 초기 접속', () => {
  it('시드 접속 상태로 시작하고 연결 이벤트를 기록하지 않는다', () => {
    expect(world().events).toHaveLength(0);
    expect(world().presenceEvents).toHaveLength(0);
    expect(Object.values(world().connections).map((c) => [c.connectionId, c.status])).toEqual([
      ['CONN001', 'connected'],
      ['CONN002', 'connected'],
      ['CONN003', 'connected'],
      ['CONN004', 'connected'],
    ]);
    expect(Object.values(world().clients).every((c) => c.sync === 'synced' && c.lastProcessedSeq === 0)).toBe(true);
    expect(engine.internals.redis.get(STREAM_SEQ_KEY)).toBeNull();
  });
});
