import type { EditorIntent, LocalStatePatch } from '../editor/model/intents';
import type { InjectionScope } from '../engine/db/mockDatabase';
import type { ResetOptions, SimulationEngine, WorldState } from '../engine/engine';
import type { Json, UserId } from '../engine/types';

/**
 * 시나리오 정의 (SIMULATION_SCENARIOS §1.1, A~L).
 * 모든 단계는 편집기와 같은 경로(EditorPort → EngineAdapter → Simulation Engine)로 실행한다. DB를 직접 조작하지 않는다.
 */

export type ScenarioAction =
  | { kind: 'intent'; actor: UserId; intent: EditorIntent }
  | { kind: 'local'; actor: UserId; patch: LocalStatePatch }
  | { kind: 'engine'; run: (engine: SimulationEngine) => void };

export interface ScenarioStep {
  /** 시작 기준 시각 (시뮬레이션 ms) */
  at: number;
  label: string;
  action: ScenarioAction;
}

export interface ScenarioCheck {
  label: string;
  /** 기대값 설명 (표시용) */
  expected: Json;
  actual: (world: WorldState) => Json;
}

export interface ScenarioDef {
  id: string;
  title: string;
  summary: string;
  /** 초기화 옵션: Fixture(applyFixture 경로), 사용자별 초기 템플릿 */
  reset?: Pick<ResetOptions, 'fixtures' | 'viewing'>;
  /** 선행 시나리오의 명령을 시계를 빠르게 진행하며 실제로 실행 (PRECONDITION 구간) */
  precondition?: ScenarioStep[];
  /** precondition 뒤 적용하는 실패 주입 */
  failures?: { count: number; scope: InjectionScope };
  steps: ScenarioStep[];
  /** 마지막 단계 이후 검증 시점 (시작 기준 ms) */
  verifyAt: number;
  checks: ScenarioCheck[];
}

export interface CheckResult {
  label: string;
  expected: Json;
  actual: Json;
  pass: boolean;
}

export type RunnerStatus = 'idle' | 'initializing' | 'precondition' | 'running' | 'verifying' | 'done';

export interface RunnerState {
  status: RunnerStatus;
  scenarioId: string | null;
  /** 본 단계 시작 시각 (시뮬레이션 ms) */
  startedAt: number | null;
  verifyAt: number | null;
  stepsDone: number;
  stepsTotal: number;
  log: { at: number; label: string }[];
  results: CheckResult[];
  passed: boolean | null;
  /** 실행 횟수 (반복 실행 확인용) */
  runs: number;
}
