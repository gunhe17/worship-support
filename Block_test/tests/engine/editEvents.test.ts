import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { renderView } from '../../src/editor/model/replica';
import type { OpRejection } from '../../src/engine/client/clientRuntime';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { STREAM_SEQ_KEY } from '../../src/engine/server/broadcaster';

/** DB_SCHEMA §8.10.8 검증 조건 ED-1 ~ ED-6, ED-8 (ED-7 재시도·DEAD는 Phase 6) */

let engine: SimulationEngine;
let port: EditorPort;
let rejections: OpRejection[];

const world = () => engine.store.getState();
const client = (id: string) => world().clients[id];
const replica = (id: string) => client(id).replica;
const view = (id: string) => renderView(replica(id));
const liveRow = () => world().tables.block_live_state[0];
const events = (name: string) => world().events.filter((e) => e.name === name);
const at = (ms: number) => engine.advanceBy(ms - world().now);
const edit = (actor: string, propertyPath: string, value: string | number) =>
  port.dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath, value } as EditorIntent);
const endEdit = (actor: string) => port.dispatch(actor, { type: 'endEdit' });
const streamCount = () => engine.internals.redis.keys('stream:*').reduce((n, k) => n + engine.internals.redis.xrange(k).length, 0);
const redisBody = () => (engine.internals.redis.get('live:block:B001') as { content: { body: string } }).content.body;

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
  rejections = [];
  engine.onRejection((r) => rejections.push(r));
});

describe('ED-1 ACK(편집 승인)와 PostgreSQL 영구 저장의 구분', () => {
  it('ACK 시점에는 PostgreSQL이 이전 값이고, PROPERTY_PERSISTED는 DEBOUNCE_SAVE 커밋 뒤에만 발생한다', () => {
    edit('U001', 'content', '승인됨');
    at(30); // 서버 승인 (ACK 전송)
    const ack = events('PROPERTY_UPDATE_ACK')[0];
    expect(ack).toMatchObject({ timestamp: 30, result: 'OK' });
    expect(redisBody()).toBe('승인됨');
    expect(liveRow()).toMatchObject({ revision: 0, persisted_revision: 0, content: { body: '안녕하세요' } });
    expect(engine.internals.redis.get('debounce:block:B001:content')).toMatchObject({ status: 'WAITING' });
    at(1029);
    expect(events('PROPERTY_PERSISTED')).toHaveLength(0);
    expect(events('DEBOUNCE_SAVE')).toHaveLength(0);
    at(1030);
    const save = events('DEBOUNCE_SAVE')[0];
    const persisted = events('PROPERTY_PERSISTED')[0];
    expect(save).toMatchObject({ result: 'OK', timestamp: 1030 });
    expect(persisted.sequence).toBeGreaterThan(save.sequence);
    expect(ack.sequence).toBeLessThan(save.sequence);
    expect(liveRow()).toMatchObject({ revision: 1, persisted_revision: 1, content: { body: '승인됨' } });
  });
});

describe('ED-2 PROPERTY_PERSISTED는 Stream과 전역 순번을 사용하지 않는다', () => {
  it('알림 전후로 Stream, seq:stream, 수신자의 documentView·수신 revision·처리 순번이 변하지 않는다', () => {
    edit('U001', 'content', 'x');
    at(100);
    const before = {
      stream: streamCount(),
      seq: engine.internals.redis.get(STREAM_SEQ_KEY),
      view: replica('U002').documentView,
      rev: { ...replica('U002').lastReceivedRevision },
      seqU2: client('U002').lastProcessedSeq,
    };
    at(1100); // flush 1030 + 알림 도착 1040
    const notice = world().broadcasts.find((b) => b.name === 'PROPERTY_PERSISTED')!;
    expect(notice).toMatchObject({ kind: 'notice', streamId: null, status: 'COMPLETE' });
    expect(streamCount()).toBe(before.stream);
    expect(engine.internals.redis.get(STREAM_SEQ_KEY)).toBe(before.seq);
    expect(replica('U002').documentView).toBe(before.view);
    expect(replica('U002').lastReceivedRevision).toEqual(before.rev);
    expect(client('U002').lastProcessedSeq).toBe(before.seqU2);
    expect(events('STREAM_XADD')).toHaveLength(1);
  });
});

describe('ED-3 disconnected 사용자의 저장 완료 알림', () => {
  it('알림 Delivery는 QUEUED로 유지되고 재연결 SYNC 적용 후에만 DELIVERED(catch-up)가 된다', () => {
    engine.disconnect('U003');
    edit('U001', 'content', 'offline 중 저장');
    at(5000);
    const notice = world().broadcasts.find((b) => b.name === 'PROPERTY_PERSISTED')!;
    const u3 = () => Object.values(world().deliveries).find((d) => d.broadcastId === notice.broadcastId && d.recipientUserId === 'U003')!;
    expect(notice.recipients).toContain('U003');
    expect(u3().status).toBe('QUEUED');
    expect(notice.status).toBe('PARTIAL');
    engine.connect('U003');
    at(world().now + 10); // HELLO 처리, SYNC 전송 중
    expect(u3().status).toBe('QUEUED');
    at(world().now + 10); // SYNC 적용
    expect(u3()).toMatchObject({ status: 'DELIVERED', via: 'catch-up' });
    expect(world().broadcasts.find((b) => b.broadcastId === notice.broadcastId)!.status).toBe('COMPLETE');
  });
});

describe('ED-4 Lock 명시적 해제와 TTL 만료의 구분', () => {
  it('포커스 해제(텍스트)는 PROPERTY_LOCK_RELEASE로 기록되고 Lock이 삭제된다', () => {
    edit('U001', 'content', 'a');
    at(40);
    endEdit('U001');
    at(60);
    expect(events('PROPERTY_LOCK_RELEASE')).toEqual([expect.objectContaining({ actorUserId: 'U001', result: 'OK', target: 'lock:block:B001:content' })]);
    expect(engine.internals.redis.exists('lock:block:B001:content')).toBe(false);
    expect(events('LOCK_EXPIRED')).toHaveLength(0);
  });

  it('드래그·리사이즈 완료 시 배치 속성 Lock을 모두 해제한다', () => {
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'size.width': 320, 'size.height': 120 }, gestureId: 'r' });
    at(40);
    endEdit('U001');
    at(60);
    expect(events('PROPERTY_LOCK_RELEASE').map((e) => e.target).sort()).toEqual([
      'lock:template:T001:element:E001:size.height',
      'lock:template:T001:element:E001:size.width',
    ]);
    expect(engine.internals.redis.keys('lock:*')).toEqual([]);
  });

  it('Undo는 명령 처리 요청 후 Lock을 해제한다 (PROPERTY_UPDATE 뒤에 해제 도착)', () => {
    edit('U001', 'style.fontSize', 24);
    at(40);
    endEdit('U001');
    at(100);
    port.dispatch('U001', { type: 'undo' });
    engine.runUntilIdle();
    const undoUpdate = world().events.filter((e) => e.name === 'PROPERTY_UPDATE')[1];
    const release = events('PROPERTY_LOCK_RELEASE')[1];
    expect(undoUpdate).toMatchObject({ result: 'OK' });
    expect(release.sequence).toBeGreaterThan(undoUpdate.sequence);
    expect(liveRow().content).toMatchObject({ style: { fontSize: 16 } });
    expect(events('LOCK_EXPIRED')).toHaveLength(0);
  });

  it('연결이 끊기면 명시적 해제 없이 TTL 10초 후 LOCK_EXPIRED로 해제된다', () => {
    edit('U001', 'content', 'a');
    at(40);
    engine.disconnect('U001');
    at(10_029);
    expect(engine.internals.redis.exists('lock:block:B001:content')).toBe(true);
    at(10_031);
    expect(events('PROPERTY_LOCK_RELEASE')).toHaveLength(0);
    expect(events('LOCK_EXPIRED')).toEqual([expect.objectContaining({ actorUserId: 'U001', from: 'REDIS', target: 'lock:block:B001:content' })]);
  });

  it('만료 뒤 늦게 온 해제 요청은 다른 사용자가 새로 획득한 Lock을 지우지 않는다', () => {
    edit('U001', 'content', 'a');
    at(10_031); // 만료
    edit('U002', 'content', 'b');
    at(10_100); // U002 획득·승인
    endEdit('U001'); // U001 클라이언트는 이전 lockToken으로 해제 요청
    at(10_200);
    const late = events('PROPERTY_LOCK_RELEASE').at(-1)!;
    expect(late).toMatchObject({ actorUserId: 'U001', result: 'INFO' });
    expect(engine.internals.redis.get('lock:block:B001:content')).toMatchObject({ userId: 'U002' });
  });
});

describe('ED-5 DISCONNECTED 거부와 rejectedBy', () => {
  it('연결이 없는 상태의 신규 편집은 서버 전송 없이 클라이언트 거부로 기록된다', () => {
    engine.disconnect('U001');
    const before = world().events.length;
    expect(edit('U001', 'content', '오프라인').ok).toBe(true); // Optimistic 접수 후 즉시 거부
    const added = world().events.slice(before);
    expect(added.map((e) => e.name)).toEqual(['PROPERTY_UPDATE_REJECTED']);
    expect(added[0]).toMatchObject({ from: 'U001', to: [], result: 'DENIED', payload: { code: 'DISCONNECTED', rejectedBy: 'client' } });
    expect(rejections).toEqual([expect.objectContaining({ code: 'DISCONNECTED', rejectedBy: 'client' })]);
    expect(replica('U001').pendingOps).toHaveLength(0);
    expect(replica('U001').undoStack).toHaveLength(0);
    engine.runUntilIdle();
    expect(redisBody()).toBe('안녕하세요');
  });

  it('Lock 획득 대기 중 연결이 끊기면 대기 작업을 DISCONNECTED로 거부하고 서버는 처리하지 않는다', () => {
    edit('U001', 'content', '대기 중');
    at(5); // PROPERTY_LOCK_REQUEST 전송 중 (도착 10)
    engine.disconnect('U001');
    engine.runUntilIdle();
    expect(events('PROPERTY_UPDATE_REJECTED')).toEqual([expect.objectContaining({ payload: expect.objectContaining({ code: 'DISCONNECTED', rejectedBy: 'client' }) })]);
    expect(events('PROPERTY_LOCK_REQUEST')).toHaveLength(0);
    expect(engine.internals.redis.keys('lock:*')).toEqual([]);
  });

  it('Lock 충돌은 클라이언트 거부(PROPERTY_LOCK_DENIED, 소유자 포함), 서버 검증 실패는 서버 거부로 기록된다', () => {
    edit('U001', 'content', 'A');
    at(100);
    edit('U002', 'content', 'B');
    at(200);
    expect(events('PROPERTY_UPDATE_REJECTED')).toEqual([
      expect.objectContaining({ actorUserId: 'U002', from: 'U002', payload: expect.objectContaining({ code: 'PROPERTY_LOCK_DENIED', rejectedBy: 'client', ownerUserId: 'U001' }) }),
    ]);
    // 서버 거부: 현재 Lock과 다른 fencingToken
    const lock = client('U001').locks['lock:block:B001:content'];
    engine.internals.ws.sendToServer('U001', {
      type: 'PROPERTY_UPDATE',
      requestId: 'REQ-STALE',
      op: { opId: 'x', actorUserId: 'U001', type: 'PROPERTY_UPDATE', target: { scope: 'block', blockId: 'B001' }, propertyPath: 'content', value: 'stale' },
      baseRevision: 1,
      lockToken: lock.lockToken!,
      fencingToken: lock.fencingToken! + 5,
    });
    at(300);
    expect(events('PROPERTY_UPDATE_REJECTED').at(-1)).toMatchObject({ from: 'WS', to: ['U001'], payload: { code: 'FENCING_TOKEN_STALE', rejectedBy: 'server' } });
  });
});

describe('ED-6 연결 단절과 재연결 SYNC의 requestId 기반 판정', () => {
  it('서버 승인 직후(ACK 도착 전) 끊겨도 저장은 계속되고, 재연결 후 승인으로 복구된다 (재전송·중복 없음)', () => {
    edit('U001', 'content', '승인 후 단절');
    at(35); // 30 승인, ACK 도착 40 전
    engine.disconnect('U001');
    const requestId = events('PROPERTY_UPDATE')[0].requestId!;
    expect(client('U001').unconfirmed).toEqual([expect.objectContaining({ requestId, propertyPath: 'content' })]);
    expect(replica('U001').pendingOps).toHaveLength(0);
    expect(rejections).toHaveLength(0);
    expect(replica('U001').undoStack).toHaveLength(1);
    // 서버 측 처리는 연결 단절과 무관하게 진행
    at(1030);
    expect(liveRow()).toMatchObject({ revision: 1, persisted_revision: 1, content: { body: '승인 후 단절' } });

    at(2000);
    engine.connect('U001');
    engine.runUntilIdle();
    const hello = events('HELLO').at(-1)!;
    expect(hello.payload).toMatchObject({ unconfirmedRequestIds: [requestId] });
    const sync = events('SYNC').at(-1)!;
    expect(sync.payload).toMatchObject({ requestResults: { [requestId]: { status: 'APPROVED', opId: expect.any(String) } } });
    expect(client('U001').unconfirmed).toEqual([]);
    expect(rejections).toHaveLength(0);
    expect(view('U001').blocks.B001.content.body).toBe('승인 후 단절');
    expect(replica('U001').lastReceivedRevision['block:B001']).toBe(1);
    expect(replica('U001').undoStack).toHaveLength(1);
    expect(events('PROPERTY_UPDATE')).toHaveLength(1); // 재전송 없음
    expect(streamCount()).toBe(1);
  });

  it('서버에 도달하지 못한 요청은 DISCONNECTED로 거부되며, 같은 블록의 다른 사용자 변경(revision 증가)과 혼동하지 않는다', () => {
    edit('U001', 'content', '도달 실패');
    at(25); // PROPERTY_UPDATE 전송 20 → 도착 30 전에 단절
    engine.disconnect('U001');
    edit('U002', 'style.color', '#ff0000'); // 블록 revision을 올리는 다른 사용자 변경
    at(1500);
    expect(liveRow()).toMatchObject({ revision: 1, content: { body: '안녕하세요', style: { color: '#ff0000' } } });
    expect(rejections).toHaveLength(0); // 판정 전에는 거부하지 않음
    engine.connect('U001');
    engine.runUntilIdle();
    const requestId = (events('HELLO').at(-1)!.payload as { unconfirmedRequestIds: string[] }).unconfirmedRequestIds[0];
    expect(events('SYNC').at(-1)!.payload).toMatchObject({ requestResults: { [requestId]: { status: 'NOT_RECEIVED' } } });
    expect(rejections).toEqual([expect.objectContaining({ userId: 'U001', code: 'DISCONNECTED', rejectedBy: 'client', requestId })]);
    expect(events('PROPERTY_UPDATE_REJECTED').at(-1)).toMatchObject({ requestId, payload: { code: 'DISCONNECTED', rejectedBy: 'client' } });
    expect(view('U001').blocks.B001.content).toMatchObject({ body: '안녕하세요', style: { color: '#ff0000' } });
    expect(replica('U001').undoStack).toHaveLength(0);
    expect(client('U001').unconfirmed).toEqual([]);
  });

  it('서버가 처리 시 거부했으나 응답을 받지 못한 요청은 재연결 후 서버 사유로 거부된다 (중복 기록 없음)', () => {
    edit('U001', 'content', 'U001 값');
    at(40);
    endEdit('U001');
    at(60);
    edit('U002', 'content', 'U002 값');
    at(85);
    endEdit('U002');
    at(96);
    port.dispatch('U001', { type: 'undo' }); // 사전 검증 통과, 서버에서 UNDO_CONFLICT (126)
    at(130); // 거부 응답 도착(136) 전에 단절
    engine.disconnect('U001');
    expect(rejections).toHaveLength(0);
    engine.connect('U001');
    engine.runUntilIdle();
    expect(rejections).toEqual([expect.objectContaining({ userId: 'U001', code: 'UNDO_CONFLICT', rejectedBy: 'server' })]);
    expect(events('PROPERTY_UPDATE_REJECTED')).toHaveLength(1); // 서버 기록 1건만
    expect(view('U001').blocks.B001.content.body).toBe('U002 값');
    expect(replica('U001').redoStack).toHaveLength(0);
  });
});

describe('ED-8 Undo도 속성 Lock과 Fencing Token 검증을 거친다', () => {
  it('다른 사용자가 Lock을 보유한 속성의 Undo는 PROPERTY_LOCK_DENIED로 거부되고 값은 바뀌지 않는다', () => {
    edit('U001', 'style.fontSize', 24);
    at(40);
    endEdit('U001');
    at(100);
    // U002가 같은 속성 Lock을 보유 (값 변경 없이 Lock만 획득)
    engine.internals.ws.sendToServer('U002', {
      type: 'PROPERTY_LOCK_REQUEST',
      requestId: 'REQ-HOLD',
      lockKey: 'lock:block:B001:style.fontSize',
      target: { scope: 'block', blockId: 'B001' },
      propertyPath: 'style.fontSize',
    });
    at(200);
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true); // 클라이언트 사전 검증은 통과
    engine.runUntilIdle();
    expect(rejections).toEqual([expect.objectContaining({ userId: 'U001', code: 'PROPERTY_LOCK_DENIED', ownerUserId: 'U002' })]);
    expect(liveRow().content).toMatchObject({ style: { fontSize: 24 } });
    expect(replica('U001').redoStack).toHaveLength(0);
  });

  it('Undo 요청은 보유한 Lock의 fencingToken을 포함하고 서버가 검증한다', () => {
    edit('U001', 'style.fontSize', 24);
    engine.runUntilIdle(); // Lock 만료까지 진행
    port.dispatch('U001', { type: 'undo' });
    at(world().now + 40);
    const undoUpdate = world().events.filter((e) => e.name === 'PROPERTY_UPDATE')[1];
    expect(undoUpdate.payload).toMatchObject({ undo: { direction: 'undo' }, fencingToken: 2 });
    expect((undoUpdate.payload as { steps: { name: string; ok: boolean }[] }).steps.filter((s) => /Lock|Fencing/.test(s.name))).toEqual([
      { name: 'Lock 확인', ok: true, detail: 'lock:block:B001:style.fontSize' },
      { name: 'Fencing Token 확인', ok: true, detail: '2' },
    ]);
  });
});
