import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from '../editor/store/createStore';
import type { ScenarioRunner } from '../scenarios/runner';
import type { RunnerState } from '../scenarios/types';

const RunnerContext = createContext<ScenarioRunner | null>(null);

export function RunnerProvider({ runner, children }: { runner: ScenarioRunner; children: ReactNode }) {
  return <RunnerContext.Provider value={runner}>{children}</RunnerContext.Provider>;
}

export function useRunner(): ScenarioRunner {
  const r = useContext(RunnerContext);
  if (!r) throw new Error('RunnerProvider missing');
  return r;
}

export function useRunnerState<S>(selector: (s: RunnerState) => S): S {
  return useStore(useRunner().store, selector);
}
