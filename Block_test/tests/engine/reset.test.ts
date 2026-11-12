import { describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent } from '../../src/editor/model/intents';
import { buildDocumentView } from '../../src/editor/model/documentModel';
import { createSimulationEngine } from '../../src/engine/engine';
import { createSeedTables } from '../../src/engine/seed';

/** 전체 초기화 (CLAUDE_PROMPT §8, SIMULATION_SCENARIOS §14 "초기화하면 모든 데이터, 이벤트, Lock, 예약 작업을 초기 상태로") */

describe('전체 초기화', () => {
  it('모든 상태를 Seed와 4명 사용자 초기 상태로 되돌리고 이전 예약 작업을 실행하지 않는다', () => {
    const engine = createSimulationEngine();
    const port = createEngineAdapter(engine);
    const fresh = createSimulationEngine().store.getState();
    const dispatch = (actor: string, intent: EditorIntent) => port.dispatch(actor, intent);

    // 다양한 상태를 만든다: Lock, Debounce, 재시도, DEAD, 구조 변경, 버전, Fixture, 연결 끊김, Presence, 실패 주입
    engine.loadFixture('K');
    engine.setFailureInjection(10, 'debounce');
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    dispatch('U002', { type: 'addElement', templateId: 'T001', kind: 'image' });
    engine.updateLocal('U003', { selectedElementId: 'E001', cursorPosition: { x: 1, y: 2 } });
    engine.disconnect('U004');
    engine.advanceBy(1500); // flush 실패 → 재시도 예약
    expect(engine.store.getState().timers.length).toBeGreaterThan(0);

    engine.reset();
    const w = engine.store.getState();
    expect(w.generation).toBe(1);
    expect(w.lastReset).toMatchObject({ generation: 1, fixtures: [] });
    expect(w.now).toBe(0);
    expect(w.timers).toEqual([]);
    expect(w.tables).toEqual(createSeedTables());
    expect(w.redis).toEqual(fresh.redis);
    expect(w.events).toEqual([]);
    expect(w.presenceEvents).toEqual([]);
    expect(w.broadcasts).toEqual([]);
    expect(w.deliveries).toEqual({});
    expect(w.dbChanges).toEqual([]);
    expect(w.dbTransactions).toEqual([]);
    expect(w.injection).toMatchObject({ remaining: 0, configured: 0, triggered: 0 });
    expect(w.connections).toEqual(fresh.connections);
    expect(engine.internals.redis.keys('lock:*')).toEqual([]);
    expect(engine.internals.redis.keys('fence:*')).toEqual([]);
    expect(engine.internals.redis.keys('debounce:*')).toEqual([]);
    for (const u of ['U001', 'U002', 'U003', 'U004']) {
      expect(w.clients[u]).toMatchObject({ sync: 'synced', lastProcessedSeq: 0, locks: {}, unconfirmed: [], versionPending: null, lastVersion: null });
      expect(w.clients[u].replica).toMatchObject({ connectionStatus: 'connected', viewingTemplateId: 'T001', selectedElementId: null, cursorPosition: null, pendingOps: [], undoStack: [], redoStack: [] });
      expect(w.clients[u].replica.documentView).toEqual(buildDocumentView(createSeedTables()));
    }
    expect(Object.keys(w.clients.U001.presence)).toEqual(['U002', 'U003', 'U004']);
    expect(w.clients.U001.presence.U003.selectedElementId).toBeNull();

    // 이전 세대의 예약(재시도, Lock TTL, Delivery)이 새 세대에 영향을 주지 않는다
    engine.advanceBy(60_000);
    expect(engine.store.getState().events).toEqual([]);
    expect(engine.store.getState().tables).toEqual(createSeedTables());
  });

  it('초기화 후 ID 순번이 처음부터 다시 시작한다 (같은 작업 → 같은 ID)', () => {
    const engine = createSimulationEngine();
    const port = createEngineAdapter(engine);
    const run = () => {
      port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' });
      port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'y' });
      engine.runUntilIdle();
      port.dispatch('U001', { type: 'save', templateId: 'T001' });
      engine.runUntilIdle();
      const w = engine.store.getState();
      return {
        events: JSON.stringify(w.events),
        ids: [w.tables.block.map((b) => b.id), w.tables.template_version.map((t) => t.id), w.tables.block_version.map((b) => b.id)],
        undo: JSON.stringify(w.clients.U001.replica.undoStack),
      };
    };
    const first = run();
    engine.reset();
    const second = run();
    expect(second).toEqual(first);
    expect(first.ids).toEqual([['B001', 'B002'], ['TV001', 'TV002'], ['BV001', 'BV002', 'BV003']]);
  });

  it('초기화 옵션으로 Fixture를 함께 만든다 (같은 applyFixture 경로)', () => {
    const engine = createSimulationEngine();
    engine.reset({ fixtures: [{ name: 'K' }], viewing: { U002: 'T002' }, label: '시나리오 K 초기화' });
    const w = engine.store.getState();
    expect(w.lastReset).toMatchObject({ fixtures: ['K'], label: '시나리오 K 초기화' });
    expect(w.tables.template.map((t) => t.id)).toEqual(['T001', 'T002']);
    expect(w.events.map((e) => [e.name, (e.payload as { createdBy?: string }).createdBy])).toEqual([['FIXTURE', 'ScenarioRunner']]);
    expect(w.clients.U002.replica.viewingTemplateId).toBe('T002');
    // 다시 초기화하면 Fixture도 사라진다
    engine.reset();
    expect(engine.store.getState().tables.template.map((t) => t.id)).toEqual(['T001']);
  });

  it('초기화 알림 구독자(어댑터 등)가 호출되고 store 구독은 유지된다', () => {
    const engine = createSimulationEngine();
    const seen: number[] = [];
    engine.onReset((g) => seen.push(g));
    let notified = 0;
    engine.store.subscribe(() => notified++);
    engine.reset();
    engine.reset();
    expect(seen).toEqual([1, 2]);
    expect(notified).toBeGreaterThanOrEqual(2);
  });
});
