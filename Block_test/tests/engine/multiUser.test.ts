import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalAdapter } from '../../src/editor/adapters/localAdapter';
import { renderView } from '../../src/editor/model/replica';
import { createEditorStore, switchViewer } from '../../src/editor/store/editorState';
import { createSimulationEngine, syncInfoOf, type SimulationEngine } from '../../src/engine/engine';
import { filterEvents, type SimEvent } from '../../src/engine/logger';
import type { PresenceInfo } from '../../src/engine/protocol';
import { readLiveBlock, readLiveTemplate } from '../../src/engine/server/liveState';
import { approveContent as approveA, approveMove as approveM } from './helpers';

let engine: SimulationEngine;
const world = () => engine.store.getState();
const client = (id: string) => world().clients[id];
const replica = (id: string) => client(id).replica;
const view = (id: string) => renderView(replica(id));
const networkEvents = () => world().events;

const approveContent = (actor: string, body: string) => approveA(engine, actor, body);
const approveMove = (actor: string, templateId: string, elementId: string, y: number) => approveM(engine, actor, templateId, elementId, y);

beforeEach(() => {
  engine = createSimulationEngine();
});

describe('초기 상태', () => {
  it('4명 모두 T001에 접속하고, Redis에 live:* 와 Presence가 구성된다 (이벤트 0건)', () => {
    const w = world();
    expect(Object.values(w.clients).map((c) => [c.replica.connectionStatus, c.sync, c.replica.viewingTemplateId])).toEqual(
      Array(4).fill(['connected', 'synced', 'T001']),
    );
    expect(Object.keys(engine.internals.redis.hgetall('presence:template:T001'))).toEqual(['U001', 'U002', 'U003', 'U004']);
    expect(w.channels['presence:template:T001']).toHaveLength(4);
    expect(readLiveBlock(engine.internals.redis, 'B001')).toMatchObject({ revision: 0, content: { body: '안녕하세요' } });
    expect(Object.keys(readLiveTemplate(engine.internals.redis, 'T001')!.elements)).toEqual(['E001']);
    expect(w.events).toHaveLength(0);
    expect(client('U001').presence).not.toHaveProperty('U001');
    expect(Object.keys(client('U001').presence)).toEqual(['U002', 'U003', 'U004']);
  });
});

describe('Presence (§8.2)', () => {
  it('선택 변경은 Pub/Sub로 다른 사용자에게 전달되고, Stream·네트워크 이벤트에는 기록되지 않는다', () => {
    engine.updateLocal('U001', { selectedElementId: 'E001', selectedPropertyPath: 'content' });
    expect(client('U002').presence.U001.selectedElementId).toBeNull();
    engine.advanceBy(10);
    expect((engine.internals.redis.hget('presence:template:T001', 'U001') as unknown as PresenceInfo).selectedElementId).toBe('E001');
    engine.advanceBy(10);
    for (const id of ['U002', 'U003', 'U004']) {
      expect(client(id).presence.U001).toMatchObject({ selectedElementId: 'E001', selectedPropertyPath: 'content' });
    }
    // v1.2.8: 요소 선택은 요소 편집 권한 요청이기도 하다 → 네트워크 이벤트는 권한 요청·승인 2건뿐
    expect(networkEvents().map((e) => [e.name, e.actorUserId, e.target])).toEqual([
      ['PROPERTY_LOCK_REQUEST', 'U001', 'lock:template:T001:element:E001:edit'],
      ['PROPERTY_LOCK_GRANTED', 'U001', 'lock:template:T001:element:E001:edit'],
    ]);
    expect(world().presenceEvents.map((e) => e.name)).toEqual(['PRESENCE_UPDATE']);
    expect(engine.internals.redis.keys('stream:*')).toEqual([]);
  });

  it('커서 이동은 50ms throttle: 구간 안의 연속 이동은 즉시 1회 + 구간 끝 1회로 전송된다', () => {
    for (let i = 0; i < 10; i++) {
      engine.updateLocal('U002', { cursorPosition: { x: i * 10, y: 5 } });
      engine.advanceBy(4);
    }
    engine.advanceBy(100);
    const updates = world().presenceEvents.filter((e) => e.actorUserId === 'U002');
    expect(updates).toHaveLength(2);
    expect(updates.map((e) => e.timestamp)).toEqual([10, 60]);
    expect(client('U001').presence.U002.cursor).toEqual({ x: 90, y: 5 });
  });

  it('MU-4: 사용자별 선택은 서로 영향을 주지 않는다', () => {
    engine.updateLocal('U003', { selectedElementId: 'E001' });
    engine.updateLocal('U004', { selectedElementId: 'E999' });
    engine.advanceBy(50);
    expect(replica('U003').selectedElementId).toBe('E001');
    expect(replica('U004').selectedElementId).toBe('E999');
    expect(client('U001').presence.U003.selectedElementId).toBe('E001');
    expect(client('U001').presence.U004.selectedElementId).toBe('E999');
  });

  it('MU-5: 시점 전환은 네트워크 이벤트를 만들지 않고 각 사용자 상태를 보존한다', () => {
    const store = createEditorStore(engine);
    const port = createLocalAdapter(store, engine);
    port.updateLocal('U001', { selectedElementId: 'E001', selectedPropertyPath: 'style.fontSize', cursorPosition: { x: 10, y: 20 } });
    engine.runUntilIdle();
    const before = { events: world().events.length, presence: world().presenceEvents.length, redis: world().redis };
    switchViewer(store, 'U002');
    switchViewer(store, 'U001');
    engine.runUntilIdle();
    expect(world().events).toHaveLength(before.events);
    expect(world().presenceEvents).toHaveLength(before.presence);
    expect(world().redis).toBe(before.redis);
    expect(replica('U001')).toMatchObject({ selectedElementId: 'E001', selectedPropertyPath: 'style.fontSize', cursorPosition: { x: 10, y: 20 } });
  });
});

describe('Broadcast / Delivery (§8.3)', () => {
  it('MU-1: 부모 Broadcast 1건 + Delivery 3건, DELIVERED 시점에만 replica가 갱신된다', () => {
    const b = approveContent('U001', '안녕하세요!');
    expect(b).toMatchObject({ recipients: ['U002', 'U003', 'U004'], status: 'PARTIAL' });
    expect(b.deliveryIds).toHaveLength(3);
    expect(Object.values(world().deliveries).map((d) => d.status)).toEqual(['SENT', 'SENT', 'SENT']);
    expect(view('U002').blocks.B001.content.body).toBe('안녕하세요');

    engine.advanceBy(10);
    expect(world().broadcasts[0].status).toBe('COMPLETE');
    for (const id of ['U002', 'U003', 'U004']) {
      expect(view(id).blocks.B001.content.body).toBe('안녕하세요!');
      expect(replica(id).lastReceivedRevision['block:B001']).toBe(1);
      expect(replica(id).documentView.blocks.B001.properties.content).toEqual({ revision: 1, lastActorUserId: 'U001' });
    }
    // actor 자신은 수신 대상이 아니다 (Phase 3에서 응답으로 반영)
    expect(replica('U001').lastReceivedRevision['block:B001']).toBe(0);

    const names = networkEvents().map((e) => `${e.name}:${e.result}`);
    expect(names).toEqual(['STREAM_XADD:OK', 'PROPERTY_UPDATED:PARTIAL', 'DELIVERY:DELIVERED', 'DELIVERY:DELIVERED', 'DELIVERY:DELIVERED']);
    const broadcastEvent = networkEvents()[1];
    expect(broadcastEvent.to).toEqual(['U002', 'U003', 'U004']);
    for (const d of networkEvents().slice(2)) {
      expect(d).toMatchObject({ actorUserId: 'U001', actorName: '사용자 1', parentSequence: broadcastEvent.sequence, durationMs: 10, requestId: b.requestId });
    }
  });

  it('모든 이벤트가 공통 필드를 가진다 (§8.7)', () => {
    approveContent('U001', 'x');
    engine.runUntilIdle();
    const keys: (keyof SimEvent)[] = ['requestId', 'actorUserId', 'actorName', 'timestamp', 'target', 'propertyPath', 'payload', 'result', 'sequence'];
    for (const e of networkEvents()) for (const k of keys) expect(e, `${e.name}.${k}`).toHaveProperty(k);
    expect(networkEvents().every((e) => e.target === 'block:B001' && e.propertyPath === 'content')).toBe(true);
    expect(networkEvents().map((e) => e.sequence)).toEqual([...networkEvents().map((e) => e.sequence)].sort((a, b) => a - b));
  });

  it('MU-7: 연결이 끊긴 U003은 QUEUED, 나머지는 DELIVERED. 재연결 시 Stream으로 따라잡은 뒤에만 동기화 상태가 된다', () => {
    engine.disconnect('U003');
    engine.advanceBy(10);
    expect(client('U001').presence.U003.status).toBe('disconnected');

    const b = approveContent('U001', '안녕하세요!');
    engine.advanceBy(10);
    const byUser = Object.fromEntries(Object.values(world().deliveries).map((d) => [d.recipientUserId, d.status]));
    expect(byUser).toEqual({ U002: 'DELIVERED', U003: 'QUEUED', U004: 'DELIVERED' });
    expect(world().broadcasts[0].status).toBe('PARTIAL');
    expect(view('U003').blocks.B001.content.body).toBe('안녕하세요');
    expect(syncInfoOf(world(), 'U003')).toEqual({ state: 'offline', behind: [{ target: 'block:B001', received: 0, current: 1 }] });

    engine.connect('U003');
    expect(syncInfoOf(world(), 'U003').state).toBe('catching-up');
    engine.runUntilIdle();
    expect(view('U003').blocks.B001.content.body).toBe('안녕하세요!');
    expect(replica('U003').lastReceivedRevision['block:B001']).toBe(1);
    expect(syncInfoOf(world(), 'U003')).toEqual({ state: 'synced', behind: [] });
    const d = Object.values(world().deliveries).find((x) => x.recipientUserId === 'U003')!;
    expect(d).toMatchObject({ status: 'DELIVERED', via: 'catch-up' });
    expect(world().broadcasts.find((x) => x.broadcastId === b.broadcastId)!.status).toBe('COMPLETE');
    expect(networkEvents().map((e) => e.name)).toEqual(
      expect.arrayContaining(['CLIENT_DISCONNECTED', 'WS_OPEN', 'HELLO', 'STREAM_READ', 'SYNC']),
    );
    expect(client('U001').presence.U003.status).toBe('connected');
  });

  it('전송 중 연결이 끊긴 Delivery는 FAILED, 재연결 따라잡기로 DELIVERED', () => {
    approveContent('U001', 'A');
    engine.disconnect('U004');
    engine.advanceBy(10);
    expect(Object.values(world().deliveries).find((d) => d.recipientUserId === 'U004')!.status).toBe('FAILED');
    engine.connect('U004');
    engine.runUntilIdle();
    expect(view('U004').blocks.B001.content.body).toBe('A');
    expect(Object.values(world().deliveries).find((d) => d.recipientUserId === 'U004')!).toMatchObject({ status: 'DELIVERED', via: 'catch-up' });
  });

  it('재연결 HELLO 처리 전에 승인된 변경도 누락 없이 따라잡는다 (순서 보장)', () => {
    engine.disconnect('U002');
    approveContent('U001', 'r1');
    engine.connect('U002');
    approveContent('U001', 'r2'); // 전송 계층은 열렸지만 서버 세션 참여(HELLO) 전 → QUEUED
    engine.advanceBy(5);
    approveContent('U001', 'r3');
    engine.runUntilIdle();
    expect(view('U002').blocks.B001.content.body).toBe('r3');
    expect(replica('U002').lastReceivedRevision['block:B001']).toBe(3);
    expect(Object.values(world().deliveries).filter((d) => d.recipientUserId === 'U002').every((d) => d.status === 'DELIVERED')).toBe(true);
  });

  it('이미 받은 revision은 따라잡기에서 중복 적용하지 않는다', () => {
    approveContent('U001', 'A');
    engine.advanceBy(10);
    engine.disconnect('U002');
    approveMove('U001', 'T001', 'E001', 300);
    engine.connect('U002');
    engine.runUntilIdle();
    const sync = networkEvents().filter((e) => e.name === 'SYNC').at(-1)!;
    expect((sync.payload as { changes: unknown[] }).changes).toHaveLength(1);
    expect(view('U002').elements.E001.props.position.y).toBe(300);
    expect(replica('U002').lastReceivedRevision).toMatchObject({ 'block:B001': 1, 'template:T001': 1 });
  });

  it('MU-6: Timeline 필터는 선택한 actorUserId의 이벤트만 남기고, Presence는 명시적으로 포함할 때만 보인다', () => {
    approveContent('U001', 'A');
    engine.updateLocal('U002', { selectedElementId: 'E001' });
    engine.disconnect('U003');
    engine.runUntilIdle();
    const { events, presenceEvents } = world();
    const u1 = filterEvents(events, presenceEvents, { actorUserId: 'U001', includePresence: false });
    expect(u1.length).toBeGreaterThan(0);
    expect(u1.every((e) => e.actorUserId === 'U001')).toBe(true);
    // v1.2.8: U002의 선택은 요소 편집 권한 요청(네트워크)이고, Presence는 따로 기록된다
    expect(filterEvents(events, presenceEvents, { actorUserId: 'U002', includePresence: false }).map((e) => [e.name, e.target])).toEqual([
      ['PROPERTY_LOCK_REQUEST', 'lock:template:T001:element:E001:edit'],
      ['PROPERTY_LOCK_GRANTED', 'lock:template:T001:element:E001:edit'],
    ]);
    expect(filterEvents(events, presenceEvents, { actorUserId: 'U002', includePresence: true }).map((e) => e.name)).toEqual([
      'PROPERTY_LOCK_REQUEST',
      'PROPERTY_LOCK_GRANTED',
      // Presence는 Pub/Sub 전달 시점에 기록된다
      'PRESENCE_UPDATE',
    ]);
    expect(filterEvents(events, presenceEvents, { actorUserId: 'U003', includePresence: false }).map((e) => e.name)).toEqual(['CLIENT_DISCONNECTED']);
  });
});

describe('공유 블록 수신 대상 (§8.3, 시나리오 K 규칙)', () => {
  it('블록 콘텐츠 변경은 두 템플릿의 접속자 모두에게, 배치 변경은 해당 템플릿 접속자에게만 전달된다', () => {
    engine = createSimulationEngine({ fixtures: [{ name: 'K' }], viewing: { U002: 'T002' } });
    expect(engine.internals.db.integrityErrors()).toEqual([]);
    expect(approveContent('U001', '공유 블록 수정').recipients).toEqual(['U002', 'U003', 'U004']);
    expect(approveMove('U001', 'T001', 'E001', 250).recipients).toEqual(['U003', 'U004']);
    // T002는 U002만 보고 있으므로 actor 제외 수신자 없음
    expect(approveMove('U002', 'T002', 'E101', 60).recipients).toEqual([]);
    engine.runUntilIdle();
    expect(view('U002').blocks.B001.content.body).toBe('공유 블록 수정');
    expect(view('U002').elements.E001.props.position.y).toBe(100);
  });

  it('템플릿 전환(VIEW_TEMPLATE)은 이전 템플릿 Presence에서 빠지고 새 템플릿을 따라잡는다', () => {
    engine = createSimulationEngine({ fixtures: [{ name: 'K' }] });
    approveMove('U001', 'T002', 'E101', 77); // T002 접속자 없음 → 수신자 0명
    engine.updateLocal('U002', { viewingTemplateId: 'T002' });
    engine.runUntilIdle();
    expect(Object.keys(engine.internals.redis.hgetall('presence:template:T001'))).toEqual(['U001', 'U003', 'U004']);
    expect(Object.keys(engine.internals.redis.hgetall('presence:template:T002'))).toEqual(['U002']);
    expect(client('U001').presence).not.toHaveProperty('U002');
    expect(client('U002').presence).toEqual({});
    expect(view('U002').elements.E101.props.position.y).toBe(77);
    expect(client('U002').sync).toBe('synced');
  });
});

describe('결정성 (§7.10)', () => {
  it('같은 입력을 두 번 실행하면 이벤트 로그가 동일하다', () => {
    const run = () => {
      engine = createSimulationEngine();
      engine.updateLocal('U001', { selectedElementId: 'E001' });
      approveContent('U001', 'A');
      engine.disconnect('U003');
      approveContent('U002', 'B');
      engine.connect('U003');
      engine.runUntilIdle();
      return JSON.stringify([world().events, world().presenceEvents, world().deliveries]);
    };
    expect(run()).toBe(run());
  });
});
