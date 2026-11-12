import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import styles from './app.module.css';
import { createEngineAdapter } from './editor/adapters/engineAdapter';
import { EditorProvider } from './editor/editorContext';
import { createEditorStore, pushToast, remapMultiSelection } from './editor/store/editorState';
import { createSimulationEngine } from './engine/engine';
import { ClockControls, useClockDriver } from './monitor/ClockControls';
import { RunnerProvider } from './monitor/runnerContext';
import { createScenarioRunner } from './scenarios/runner';
import { EditorShell } from './editor/ui/EditorShell';
import { Icon } from './editor/ui/icons';
import { MonitorPanel } from './monitor/MonitorPanel';
import { NetworkTimeline } from './monitor/NetworkTimeline';

function useDragSize(initial: number, axis: 'x' | 'y', min: number, max: () => number) {
  const [size, setSize] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const start = (e: ReactPointerEvent) => {
    e.preventDefault();
    const startPos = axis === 'x' ? e.clientX : e.clientY;
    const startSize = size;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const delta = startPos - (axis === 'x' ? ev.clientX : ev.clientY);
      setSize(Math.max(min, Math.min(max(), startSize + delta)));
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return { size, dragging, start };
}

export function App() {
  const engine = useMemo(() => createSimulationEngine(), []);
  const store = useMemo(() => createEditorStore(engine), [engine]);
  // Phase 3: 편집 명령은 Engine Adapter → Simulation Engine (Lock · Fencing · Debounce · PostgreSQL)
  const port = useMemo(
    () => createEngineAdapter(engine, (n) =>
        pushToast(
          store,
          // 개발자 정보를 끈 화면에서는 사용자 언어 문구
          !store.getState().devInfo && n.plain ? { tone: n.tone, title: n.plain.title, detail: n.plain.detail } : { tone: n.tone, title: n.title, detail: n.detail },
        )),
    [store, engine],
  );
  const runner = useMemo(() => createScenarioRunner(engine, port), [engine, port]);
  // 임시 요소 ID → 서버 ID: 화면 전용 다중 선택 목록도 함께 바꾼다
  useEffect(() => engine.onIdAssigned((userId, a) => remapMultiSelection(store, userId, a.localElementId, a.elementId)), [engine, store]);
  useClockDriver(engine);

  const monitor = useDragSize(Math.round(Math.min(420, Math.max(340, window.innerWidth * 0.24))), 'x', 300, () => window.innerWidth * 0.6);
  const timeline = useDragSize(170, 'y', 90, () => window.innerHeight * 0.6);
  const [monitorOpen, setMonitorOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(true);

  return (
    <EditorProvider store={store} port={port} engine={engine}>
      <RunnerProvider runner={runner}>
      <div className={styles.app}>
        <header className={styles.header}>
          <span className={styles.product}>Template Editor Simulator</span>
          <span className={styles.mock} title="실제 PostgreSQL, Redis, WebSocket 서버에 연결하지 않습니다">
            <Icon name="cloudOff" size={12} />
            MOCK · 실제 네트워크 연결 없음
          </span>
          <span className={styles.phase} title="속성·구조 편집, 명시적 저장·복원, Presence, 연결은 모두 Simulation Engine을 거칩니다">
            Phase 6 · EngineAdapter
          </span>
          <span className={styles.spacer} />
          <ClockControls />
          {!monitorOpen && (
            <button type="button" className={styles.headerButton} onClick={() => setMonitorOpen(true)}>
              <Icon name="panelRight" size={12} /> DB Explorer
            </button>
          )}
        </header>

        <div
          className={styles.main}
          style={{ gridTemplateColumns: monitorOpen ? `minmax(0, 1fr) 5px ${monitor.size}px` : 'minmax(0, 1fr)' }}
        >
          <EditorShell />
          {monitorOpen && (
            <>
              <div className={styles.splitV} data-dragging={monitor.dragging} onPointerDown={monitor.start} role="separator" aria-orientation="vertical" />
              <MonitorPanel onCollapse={() => setMonitorOpen(false)} />
            </>
          )}
        </div>

        <div className={styles.bottom}>
          {timelineOpen && <div className={styles.splitH} data-dragging={timeline.dragging} onPointerDown={timeline.start} role="separator" aria-orientation="horizontal" />}
          <div style={{ height: timelineOpen ? timeline.size : 34 }}>
            <NetworkTimeline collapsed={!timelineOpen} onToggle={() => setTimelineOpen((o) => !o)} />
          </div>
        </div>
      </div>
      </RunnerProvider>
    </EditorProvider>
  );
}
