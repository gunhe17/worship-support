import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter, type AdapterNotice } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { renderView } from '../../src/editor/model/replica';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { createSeedTables } from '../../src/engine/seed';
import type { OpRejection } from '../../src/engine/client/clientRuntime';

/** SIMULATION_SCENARIOS A~F, §15 MU-1~MU-9 (Engine Adapter 경유) */

let engine: SimulationEngine;
let port: EditorPort;
let notices: AdapterNotice[];
let rejections: OpRejection[];

const world = () => engine.store.getState();
const replica = (id: string) => world().clients[id].replica;
const view = (id: string) => renderView(replica(id));
const pg = () => world().tables;
const liveRow = () => pg().block_live_state[0];
const propState = (path: string) => pg().block_property_state.find((r) => r.property_path === path);
const names = () => world().events.map((e) => e.name);
const at = (ms: number) => engine.advanceBy(ms - world().now);
const edit = (actor: string, propertyPath: string, value: string | number, gestureId?: string) =>
  port.dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath, value, gestureId } as EditorIntent);

beforeEach(() => {
  engine = createSimulationEngine();
  notices = [];
  rejections = [];
  port = createEngineAdapter(engine, (n) => notices.push(n));
  engine.onRejection((r) => rejections.push(r));
});

describe('시나리오 A: 텍스트 속성 편집', () => {
  it('Lock → UPDATE → Stream → 전파 → Debounce 1초 → PostgreSQL 저장 → PROPERTY_PERSISTED', () => {
    expect(edit('U001', 'content', '안녕하세요! 반갑습니다.').ok).toBe(true);
    // Optimistic: 즉시 화면 반영, 서버 승인 전
    expect(view('U001').blocks.B001.content.body).toBe('안녕하세요! 반갑습니다.');
    expect(replica('U001').pendingOps).toHaveLength(1);

    at(40);
    expect(replica('U001').pendingOps).toHaveLength(0);
    for (const u of ['U002', 'U003', 'U004']) expect(view(u).blocks.B001.content.body).toBe('안녕하세요! 반갑습니다.');
    // Debounce 대기 중: Redis는 최신, PostgreSQL은 이전 값 (의도된 차이)
    expect((liveRow().content as { body: string }).body).toBe('안녕하세요');
    expect(engine.internals.redis.get('debounce:block:B001:content')).toMatchObject({ status: 'WAITING', dueAt: 1030 });

    at(1029);
    expect(liveRow().revision).toBe(0);
    at(1030);
    expect(liveRow()).toMatchObject({
      content: { body: '안녕하세요! 반갑습니다.', style: { fontSize: 16, color: '#000000' } },
      revision: 1,
      persisted_revision: 1,
      updated_by: 'U001',
      persisted_at: '2026-01-01 14:00:01.030',
    });
    expect(propState('content')).toMatchObject({ revision: 1, persisted_revision: 1, last_fencing_token: 1 });
    // 변경하지 않는 테이블
    const seed = createSeedTables();
    for (const t of ['block', 'block_version', 'block_text', 'template_version', 'template_version_element'] as const) expect(pg()[t]).toEqual(seed[t]);
    expect(engine.internals.redis.exists('debounce:block:B001:content')).toBe(false);

    engine.runUntilIdle();
    const n = names();
    const order = ['PROPERTY_LOCK_REQUEST', 'PROPERTY_LOCK_GRANTED', 'PROPERTY_UPDATE', 'STREAM_XADD', 'PROPERTY_UPDATED', 'PROPERTY_UPDATE_ACK', 'DEBOUNCE_SCHEDULED', 'DEBOUNCE_SAVE', 'PROPERTY_PERSISTED'];
    expect(order.map((x) => n.indexOf(x))).toEqual([...order.map((x) => n.indexOf(x))].sort((a, b) => a - b));
    const persisted = world().broadcasts.find((b) => b.name === 'PROPERTY_PERSISTED')!;
    expect(persisted.recipients).toEqual(['U001', 'U002', 'U003', 'U004']);
    expect(persisted.status).toBe('COMPLETE');
    // 처리 단계 9개 기록 (CLAUDE_PROMPT §9)
    const update = world().events.find((e) => e.name === 'PROPERTY_UPDATE')!;
    expect((update.payload as { steps: { ok: boolean }[] }).steps).toHaveLength(9);
  });
});

describe('시나리오 B: 연속 입력과 Debounce', () => {
  it('0/300/600ms 입력은 예약이 갱신되어 마지막 입력 1초 뒤 한 번만 저장된다', () => {
    edit('U001', 'content', '안녕하세요', 'g');
    edit('U001', 'content', '안녕하세요x', 'g'); // 같은 값 회피용 중간 입력 없이 진행
    engine.runUntilIdle();
    engine = createSimulationEngine();
    port = createEngineAdapter(engine);
    // 실제 시나리오
    edit('U001', 'content', '안녕하세요!', 'g'); // 승인 30ms
    at(300);
    edit('U001', 'content', '안녕하세요! 반갑', 'g'); // 승인 310ms (Lock 보유)
    at(600);
    edit('U001', 'content', '안녕하세요! 반갑습니다.', 'g'); // 승인 610ms
    at(1609);
    expect(liveRow().revision).toBe(0);
    const scheduled = world().events.filter((e) => e.name === 'DEBOUNCE_SCHEDULED').map((e) => (e.payload as { dueAt: number }).dueAt);
    expect(scheduled).toEqual([1030, 1310, 1610]);
    at(1610);
    expect(liveRow()).toMatchObject({ revision: 3, persisted_revision: 3, content: { body: '안녕하세요! 반갑습니다.' } });
    expect(propState('content')).toMatchObject({ revision: 3, persisted_revision: 3 });
    expect(world().events.filter((e) => e.name === 'DEBOUNCE_SAVE')).toHaveLength(1);
    expect(pg().block_version).toHaveLength(1);
    // 입력 3회는 하나의 Undo 항목
    expect(replica('U001').undoStack).toHaveLength(1);
  });
});

describe('시나리오 C / MU-2: 서로 다른 속성 동시 편집', () => {
  it('기본: 두 Lock 모두 획득, 속성별 flush로 persisted_revision 1 → 2', () => {
    edit('U001', 'style.fontSize', 24); // 승인 30 (rev1)
    at(100);
    edit('U002', 'style.color', '#ff0000'); // 승인 130 (rev2)
    at(1030);
    expect(liveRow()).toMatchObject({ revision: 2, persisted_revision: 1 });
    expect((liveRow().content as { style: object }).style).toEqual({ fontSize: 24, color: '#000000' });
    at(1130);
    expect(liveRow()).toMatchObject({ revision: 2, persisted_revision: 2 });
    expect((liveRow().content as { style: object }).style).toEqual({ fontSize: 24, color: '#ff0000' });
    expect(world().events.filter((e) => e.name === 'PROPERTY_LOCK_GRANTED')).toHaveLength(2);
    expect(rejections).toHaveLength(0);
  });

  it('변형: 미저장 rev 1이 남아 있으면 persisted_revision은 0, 이후 fontSize flush로 3', () => {
    edit('U001', 'style.fontSize', 20, 'a'); // rev1 @30
    at(100);
    edit('U002', 'style.color', '#ff0000'); // rev2 @130
    at(500);
    edit('U001', 'style.fontSize', 24, 'a'); // rev3 @510 (Debounce 1510으로 연장)
    at(1130);
    expect(liveRow()).toMatchObject({ revision: 3, persisted_revision: 0 });
    expect((liveRow().content as { style: { fontSize: number } }).style.fontSize).toBe(16);
    expect(propState('style.color')).toMatchObject({ revision: 1, persisted_revision: 1 });
    expect(propState('style.fontSize')).toMatchObject({ revision: 2, persisted_revision: 0 });
    at(1510);
    expect(liveRow()).toMatchObject({ revision: 3, persisted_revision: 3 });
    expect(liveRow().content).toMatchObject({ style: { fontSize: 24, color: '#ff0000' } });
    expect(propState('style.fontSize')).toMatchObject({ revision: 2, persisted_revision: 2 });
  });
});

describe('시나리오 D / MU-3: 동일 속성 Lock 충돌', () => {
  it('나중 요청은 PROPERTY_LOCK_DENIED, 소유자 U001, B의 작업만 제거되고 DB 변경 없음', () => {
    edit('U001', 'content', 'A의 편집');
    at(100);
    edit('U002', 'content', 'B의 편집');
    expect(view('U002').blocks.B001.content.body).toBe('B의 편집'); // Optimistic
    at(130);
    expect(world().events.find((e) => e.name === 'PROPERTY_LOCK_DENIED')).toMatchObject({ actorUserId: 'U002', result: 'DENIED' });
    expect(rejections).toEqual([expect.objectContaining({ userId: 'U002', code: 'PROPERTY_LOCK_DENIED', ownerUserId: 'U001' })]);
    expect(notices[0].detail).toContain('U001');
    expect(replica('U002').pendingOps).toHaveLength(0);
    expect(view('U002').blocks.B001.content.body).toBe('A의 편집');
    expect(replica('U002').undoStack).toHaveLength(0);
    engine.runUntilIdle();
    expect(liveRow()).toMatchObject({ revision: 1, updated_by: 'U001', content: { body: 'A의 편집' } });
    expect(world().dbChanges.every((c) => c.actorUserId === 'U001')).toBe(true);
  });

  it('Lock은 명시적 해제 또는 TTL 10초 만료로만 풀린다', () => {
    edit('U001', 'content', 'A');
    at(5000);
    expect(engine.internals.redis.exists('lock:block:B001:content')).toBe(true);
    at(10_031);
    expect(engine.internals.redis.exists('lock:block:B001:content')).toBe(false);
    expect(names()).toContain('LOCK_EXPIRED');
    // 만료 후 다시 편집하면 클라이언트가 Lock을 재요청한다 (fencing token 증가)
    edit('U001', 'content', 'A2');
    engine.runUntilIdle();
    expect(rejections).toHaveLength(0);
    expect(engine.internals.redis.get('fence:lock:block:B001:content')).toBe(2);
    expect(propState('content')).toMatchObject({ last_fencing_token: 2 });
  });

  it('편집 종료(endEdit) 시 Lock을 해제하고 다른 사용자가 획득할 수 있다', () => {
    edit('U001', 'content', 'A');
    at(40);
    port.dispatch('U001', { type: 'endEdit' });
    at(60);
    expect(engine.internals.redis.exists('lock:block:B001:content')).toBe(false);
    edit('U002', 'content', 'B');
    engine.runUntilIdle();
    expect(rejections).toHaveLength(0);
    expect(view('U001').blocks.B001.content.body).toBe('B');
  });
});

describe('시나리오 E: 텍스트 크기 변경', () => {
  it('fontSize 16 → 24, 네트워크 흐름과 DB 변경 (block_version 생성 없음)', () => {
    edit('U001', 'style.fontSize', 24);
    engine.runUntilIdle();
    const flow = world()
      .events.filter((e) => e.actorUserId === 'U001' && e.category !== 'delivery' && e.name !== 'STREAM_XADD')
      .map((e) => e.name);
    expect(flow).toEqual(['PROPERTY_LOCK_REQUEST', 'PROPERTY_LOCK_GRANTED', 'PROPERTY_UPDATE', 'PROPERTY_UPDATED', 'PROPERTY_UPDATE_ACK', 'DEBOUNCE_SCHEDULED', 'DEBOUNCE_SAVE', 'PROPERTY_PERSISTED', 'LOCK_EXPIRED']);
    expect(liveRow()).toMatchObject({ revision: 1, content: { style: { fontSize: 24 } } });
    expect(propState('style.fontSize')).toMatchObject({ revision: 1, persisted_revision: 1 });
    expect(pg().block_version).toHaveLength(1);
  });
});

describe('시나리오 F: 요소 위치 변경', () => {
  it('E001 y 100 → 300: template_live_element.props와 template 속성 상태만 갱신', () => {
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    at(40);
    expect(view('U003').elements.E001.props.position.y).toBe(300);
    expect(pg().template_live_element[0].props).toMatchObject({ position: { y: 100 } });
    // 배치 속성 Lock은 템플릿 요소 단위 키
    expect(engine.internals.redis.keys('lock:*')).toEqual(['lock:template:T001:element:E001:position.y']);
    engine.runUntilIdle();
    expect(pg().template_live_element[0].props).toEqual({ position: { x: 100, y: 300 }, size: { width: 300, height: 100 } });
    expect(pg().template_live_state[0]).toMatchObject({ revision: 1, persisted_revision: 1, updated_by: 'U001' });
    expect(pg().template_element_property_state).toEqual([
      expect.objectContaining({ template_id: 'T001', template_element_id: 'E001', property_path: 'position.y', revision: 1, persisted_revision: 1, last_fencing_token: 1 }),
    ]);
    expect(liveRow().revision).toBe(0); // 블록 콘텐츠는 변경 없음
    expect(pg().template_version_element).toEqual(createSeedTables().template_version_element);
  });
});

describe('다중 사용자 (Engine Adapter)', () => {
  it('MU-1: 부모 Broadcast 1건, Delivery 3건, 각 replica lastReceivedRevision 갱신', () => {
    edit('U001', 'content', 'x');
    engine.runUntilIdle();
    const b = world().broadcasts.filter((x) => x.name === 'PROPERTY_UPDATED');
    expect(b).toHaveLength(1);
    expect(b[0].recipients).toEqual(['U002', 'U003', 'U004']);
    for (const u of ['U001', 'U002', 'U003', 'U004']) expect(replica(u).lastReceivedRevision['block:B001']).toBe(1);
  });

  it('MU-7: 연결 끊긴 U003은 QUEUED, 재연결 시 Stream으로 따라잡는다. 연결 끊긴 동안의 편집은 거부된다', () => {
    engine.disconnect('U003');
    edit('U001', 'content', 'while offline');
    engine.runUntilIdle();
    const d = Object.values(world().deliveries).filter((x) => x.recipientUserId === 'U003');
    expect(d.every((x) => x.status === 'QUEUED')).toBe(true);
    expect(edit('U003', 'content', 'offline edit').ok).toBe(true);
    expect(rejections.at(-1)).toMatchObject({ userId: 'U003', code: 'DISCONNECTED' });
    expect(view('U003').blocks.B001.content.body).toBe('안녕하세요');
    engine.connect('U003');
    engine.runUntilIdle();
    expect(view('U003').blocks.B001.content.body).toBe('while offline');
    expect(Object.values(world().deliveries).filter((x) => x.recipientUserId === 'U003').every((x) => x.status === 'DELIVERED')).toBe(true);
  });

  it('MU-8: Optimistic 작업 3개 중 두 번째만 거부되면 첫 번째와 세 번째는 유지된다', () => {
    // U002가 position.y Lock을 먼저 보유
    port.dispatch('U002', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 150 } });
    at(40);
    edit('U001', 'content', '첫 번째');
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 500 } });
    edit('U001', 'content', '세 번째');
    expect(replica('U001').pendingOps).toHaveLength(3);
    engine.runUntilIdle();
    expect(rejections.map((r) => [r.userId, (r.op as { propertyPath: string }).propertyPath, r.code])).toEqual([['U001', 'position.y', 'PROPERTY_LOCK_DENIED']]);
    expect(view('U001').blocks.B001.content.body).toBe('세 번째');
    expect(view('U001').elements.E001.props.position.y).toBe(150);
    expect(liveRow()).toMatchObject({ revision: 2, content: { body: '세 번째' } });
  });

  it('MU-9: 다른 사용자가 다시 수정한 속성의 Undo는 UNDO_CONFLICT이고 값을 덮어쓰지 않는다 (클라이언트 사전 검증)', () => {
    edit('U001', 'content', 'U001 값');
    at(40);
    port.dispatch('U001', { type: 'endEdit' });
    at(60);
    edit('U002', 'content', 'U002 값');
    engine.runUntilIdle();
    const r = port.dispatch('U001', { type: 'undo' });
    expect(r).toMatchObject({ ok: false, code: 'UNDO_CONFLICT' });
    expect(replica('U001').undoStack).toHaveLength(0);
    engine.runUntilIdle();
    expect(liveRow().content).toMatchObject({ body: 'U002 값' });
  });

  it('MU-9 (서버 검증): 다른 사용자의 변경이 아직 도착하지 않은 시점의 Undo도 서버가 UNDO_CONFLICT로 거부한다', () => {
    edit('U001', 'content', 'U001 값');
    at(40);
    port.dispatch('U001', { type: 'endEdit' });
    at(60); // U001 Lock 해제 완료
    edit('U002', 'content', 'U002 값'); // Lock 요청 70 → 승인 응답 80 → UPDATE 승인 90 → U001 수신 100
    at(85);
    port.dispatch('U002', { type: 'endEdit' }); // 해제 도착 95
    at(96);
    expect(view('U001').blocks.B001.content.body).toBe('U001 값'); // 아직 U002 변경 미수신
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true); // 사전 검증 통과
    engine.runUntilIdle();
    expect(rejections).toEqual([expect.objectContaining({ userId: 'U001', code: 'UNDO_CONFLICT' })]);
    expect(world().events.find((e) => e.name === 'PROPERTY_UPDATE_REJECTED')).toMatchObject({ resultDetail: 'UNDO_CONFLICT' });
    expect(liveRow().content).toMatchObject({ body: 'U002 값' });
    expect(view('U001').blocks.B001.content.body).toBe('U002 값');
    expect(replica('U001').redoStack).toHaveLength(0);
  });

  it('Undo/Redo는 새 편집 명령으로 처리되어 Lock·Debounce를 거친다', () => {
    edit('U001', 'style.fontSize', 24);
    engine.runUntilIdle();
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true);
    engine.runUntilIdle();
    expect(liveRow()).toMatchObject({ revision: 2, persisted_revision: 2, content: { style: { fontSize: 16 } } });
    expect(port.dispatch('U001', { type: 'redo' }).ok).toBe(true);
    engine.runUntilIdle();
    expect(liveRow()).toMatchObject({ revision: 3, content: { style: { fontSize: 24 } } });
    const undoUpdate = world().events.filter((e) => e.name === 'PROPERTY_UPDATE')[1];
    expect(undoUpdate.payload).toMatchObject({ undo: { direction: 'undo', expectedCurrent: 24 } });
  });

  it('Fencing Token이 현재 Lock과 다르면 거부된다', () => {
    edit('U001', 'content', 'A');
    engine.runUntilIdle();
    const lock = world().clients.U001.locks['lock:block:B001:content'];
    engine.internals.ws.sendToServer('U001', {
      type: 'PROPERTY_UPDATE',
      requestId: 'REQ-T',
      op: { opId: 'x', actorUserId: 'U001', type: 'PROPERTY_UPDATE', target: { scope: 'block', blockId: 'B001' }, propertyPath: 'content', value: 'stale' },
      baseRevision: 1,
      lockToken: lock.lockToken!,
      fencingToken: lock.fencingToken! - 1,
    });
    engine.runUntilIdle();
    expect(world().events.find((e) => e.requestId === 'REQ-T' && e.name === 'PROPERTY_UPDATE')).toMatchObject({ result: 'DENIED' });
    expect(liveRow().content).toMatchObject({ body: 'A' });
  });

});
