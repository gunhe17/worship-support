import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { SCENARIOS } from '../../src/scenarios/definitions';
import { createScenarioRunner, type ScenarioRunner } from '../../src/scenarios/runner';

/** 시나리오 실행기: A~L (+ L 변형 DEAD) 전체 실행과 반복 실행 */

let engine: SimulationEngine;
let runner: ScenarioRunner;

beforeEach(() => {
  engine = createSimulationEngine();
  runner = createScenarioRunner(engine, createEngineAdapter(engine));
});

const runToEnd = (id: string) => {
  expect(runner.run(id)).toBe(true);
  expect(runner.store.getState().status).toBe('running');
  runner.fastForward();
  return runner.store.getState();
};

describe('시나리오 A~L', () => {
  it.each(SCENARIOS.map((s) => [s.id, s.title]))('%s: %s — 모든 검증 통과', (id) => {
    const state = runToEnd(id);
    const failed = state.results.filter((r) => !r.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(state).toMatchObject({ status: 'done', passed: true, scenarioId: id });
    expect(state.stepsDone).toBe(state.stepsTotal);
  });

  it('precondition 명령은 PRECONDITION 구간으로 기록되고 본 단계와 구분된다 (I)', () => {
    runToEnd('I');
    const w = engine.store.getState();
    const pre = w.events.filter((e) => e.section === 'PRECONDITION');
    expect(pre.some((e) => e.name === 'PROPERTY_UPDATE')).toBe(true);
    expect(w.events.filter((e) => e.section === null)[0].name).toBe('TEMPLATE_SAVE');
  });

  it('시나리오 초기화의 Fixture는 FIXTURE 이벤트(PRECONDITION)로 기록된다 (K)', () => {
    runToEnd('K');
    const f = engine.store.getState().events.filter((e) => e.name === 'FIXTURE');
    expect(f).toEqual([expect.objectContaining({ section: 'PRECONDITION', result: 'OK', payload: expect.objectContaining({ createdBy: 'ScenarioRunner', fixture: 'K' }) })]);
  });

  it('L: 실패 주입 설정은 FAULT_INJECTION 이벤트로 기록된다', () => {
    runToEnd('L');
    expect(engine.store.getState().events.find((e) => e.name === 'FAULT_INJECTION')).toMatchObject({ section: 'PRECONDITION', payload: { count: 2, scope: 'debounce' } });
  });
});

describe('반복 실행과 초기화', () => {
  it('같은 시나리오를 반복 실행하면 ID와 이벤트 로그가 동일하다 (G, J)', () => {
    for (const id of ['G', 'J']) {
      runToEnd(id);
      const first = JSON.stringify({ events: engine.store.getState().events, tables: engine.store.getState().tables });
      runToEnd(id);
      const second = JSON.stringify({ events: engine.store.getState().events, tables: engine.store.getState().tables });
      expect(second).toBe(first);
    }
    expect(runner.store.getState().runs).toBe(4);
  });

  it('다른 시나리오를 연속 실행해도 이전 실행의 상태·예약이 남지 않는다', () => {
    runner.run('L-DEAD'); // 재시도 예약이 남은 채로 다음 시나리오 실행
    engine.advanceBy(1500);
    runToEnd('A');
    const w = engine.store.getState();
    expect(runner.store.getState().passed).toBe(true);
    expect(w.injection).toMatchObject({ remaining: 0, configured: 0 });
    expect(w.events.some((e) => (e.payload as { key?: string } | null)?.key === 'debounce:block:B001:content' && e.name === 'DEBOUNCE_SAVE' && e.result === 'FAILED')).toBe(false);
    expect(w.timers.some((t) => t.label.includes('DEAD') || t.label.startsWith('debounce retry'))).toBe(false);
  });

  it('실행 중 외부에서 전체 초기화하면 시나리오가 중단되고 예약 단계는 실행되지 않는다', () => {
    runner.run('B');
    engine.advanceBy(100);
    engine.reset();
    expect(runner.store.getState().status).toBe('idle');
    engine.advanceBy(5000);
    expect(engine.store.getState().events).toEqual([]);
  });
});
