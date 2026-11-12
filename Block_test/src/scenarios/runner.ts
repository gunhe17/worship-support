import type { EditorPort } from '../editor/model/intents';
import type { SimulationEngine, WorldState } from '../engine/engine';
import { createStore, type Store } from '../engine/store';
import type { Json } from '../engine/types';
import { scenarioById } from './definitions';
import type { CheckResult, RunnerState, ScenarioDef, ScenarioStep } from './types';

/**
 * 시나리오 실행기 (CLAUDE_PROMPT §8, SIMULATION_SCENARIOS §1.1).
 * 1) 전체 초기화 (Fixture는 applyFixture 경로, FIXTURE 이벤트 기록)
 * 2) precondition: 선행 명령을 시계를 빠르게 진행하며 실제로 실행 (PRECONDITION 구간)
 * 3) 실패 주입 (해당 시나리오)
 * 4) 본 단계: VirtualClock에 예약 → 사용자의 시계 제어(재생·일시정지·단계 진행·배속)를 따른다
 * 5) verifyAt 시각에 검증
 * 모든 명령은 EditorPort(EngineAdapter) → Simulation Engine을 거친다.
 */

const IDLE: RunnerState = {
  status: 'idle',
  scenarioId: null,
  startedAt: null,
  verifyAt: null,
  stepsDone: 0,
  stepsTotal: 0,
  log: [],
  results: [],
  passed: null,
  runs: 0,
};

const canon = (v: Json): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
    .join(',')}}`;
};

export function evaluate(def: ScenarioDef, world: WorldState): CheckResult[] {
  return def.checks.map((c) => {
    let actual: Json;
    try {
      actual = c.actual(world);
    } catch (err) {
      actual = `오류: ${err instanceof Error ? err.message : String(err)}`;
    }
    return { label: c.label, expected: c.expected, actual, pass: canon(actual) === canon(c.expected) };
  });
}

export interface ScenarioRunner {
  readonly store: Store<RunnerState>;
  /** 시나리오 실행 (항상 전체 초기화부터) */
  run(id: string): boolean;
  /** 본 단계를 즉시 끝까지 진행 (시계를 verifyAt까지 빠르게) */
  fastForward(): void;
  /** 실행기 상태만 초기화 (엔진 전체 초기화는 engine.reset) */
  clear(): void;
}

export function createScenarioRunner(engine: SimulationEngine, port: EditorPort): ScenarioRunner {
  const store = createStore<RunnerState>(IDLE);
  let runToken = 0;

  const apply = (step: ScenarioStep) => {
    const a = step.action;
    if (a.kind === 'intent') port.dispatch(a.actor, a.intent);
    else if (a.kind === 'local') port.updateLocal(a.actor, a.patch);
    else a.run(engine);
  };

  /** 외부에서 전체 초기화하면 실행 중인 시나리오는 중단된다 (이전 예약은 새 세대에서 실행되지 않음) */
  let ownReset = false;
  engine.onReset(() => {
    if (ownReset) return;
    runToken++;
    store.setState((s) => (s.status === 'idle' ? s : { ...IDLE, runs: s.runs }));
  });

  return {
    store,

    run(id) {
      const def = scenarioById(id);
      if (!def) return false;
      const token = ++runToken;
      const runs = store.getState().runs + 1;
      store.setState(() => ({ ...IDLE, status: 'initializing', scenarioId: id, stepsTotal: def.steps.length, runs }));

      // 1) 전체 초기화 + Fixture
      ownReset = true;
      engine.reset({
        fixtures: def.reset?.fixtures ?? [],
        viewing: def.reset?.viewing,
        initialSection: def.precondition || def.failures || def.reset?.fixtures?.length ? 'PRECONDITION' : null,
        label: `시나리오 ${id} 초기화`,
      });
      ownReset = false;

      // 2) precondition: 실제 명령을 빠르게 실행
      if (def.precondition?.length) {
        store.setState((s) => ({ ...s, status: 'precondition' }));
        engine.setSection('PRECONDITION');
        let t = 0;
        for (const step of def.precondition) {
          engine.advanceBy(step.at - t);
          t = step.at;
          apply(step);
        }
        engine.runUntilIdle();
      }
      // 3) 실패 주입 (precondition 구간에 기록)
      if (def.failures) {
        engine.setSection('PRECONDITION');
        engine.setFailureInjection(def.failures.count, def.failures.scope);
      }
      engine.setSection(null);

      // 4) 본 단계 예약
      const startedAt = engine.store.getState().now;
      store.setState((s) => ({ ...s, status: 'running', startedAt, verifyAt: startedAt + def.verifyAt }));
      def.steps.forEach((step) =>
        engine.scheduleAfter(step.at, `시나리오 ${id}: ${step.label}`, () => {
          if (token !== runToken) return;
          apply(step);
          store.setState((s) => ({ ...s, stepsDone: s.stepsDone + 1, log: [...s.log, { at: engine.snapshotNow().now - startedAt, label: step.label }] }));
        }),
      );
      // 5) 검증
      engine.scheduleAfter(def.verifyAt, `시나리오 ${id}: 검증`, () => {
        if (token !== runToken) return;
        store.setState((s) => ({ ...s, status: 'verifying' }));
        // 검증은 이 시각까지 처리된 결과를 본다 (같은 시각 작업 이후)
        engine.scheduleAfter(0, `시나리오 ${id}: 결과`, () => {
          if (token !== runToken) return;
          const results = evaluate(def, engine.snapshotNow());
          store.setState((s) => ({ ...s, status: 'done', results, passed: results.every((r) => r.pass) }));
        });
      });
      return true;
    },

    fastForward() {
      const s = store.getState();
      if (s.status !== 'running' || s.verifyAt === null) return;
      engine.advanceBy(Math.max(0, s.verifyAt - engine.store.getState().now));
    },

    clear() {
      runToken++;
      store.setState((s) => ({ ...IDLE, runs: s.runs }));
    },
  };
}
