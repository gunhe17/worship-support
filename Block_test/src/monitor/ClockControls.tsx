import { useEffect } from 'react';
import { SPEEDS, type SimulationEngine } from '../engine/engine';
import { simClock } from '../engine/simTime';
import { useEngine, useWorld } from '../editor/editorContext';
import { Icon } from '../editor/ui/icons';
import styles from './clock.module.css';

/**
 * VirtualClock 구동: 실제 프레임 간격 × 배속만큼 시뮬레이션 시간을 진행한다.
 * 일시정지 중에는 진행하지 않는다 (네트워크 지연, Presence throttle도 함께 멈춤).
 */
export function useClockDriver(engine: SimulationEngine): void {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      // 탭 전환 등으로 프레임이 크게 밀리면 한 번에 최대 250ms만 진행
      engine.tick(Math.min(250, t - last));
      last = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
}

/** 시뮬레이션 시각, 재생/일시정지, 단계 진행, 배속 */
export function ClockControls() {
  const engine = useEngine();
  const now = useWorld((w) => w.now);
  const running = useWorld((w) => w.running);
  const speed = useWorld((w) => w.speed);
  const timers = useWorld((w) => w.timers);
  const next = timers[0];

  return (
    <div className={styles.clock} role="group" aria-label="시뮬레이션 시계">
      <span className={styles.time} title="시뮬레이션 시각 (실제 시각과 무관)">
        <span className={styles.state} data-running={running}>
          {running ? 'RUN' : 'PAUSE'}
        </span>
        {simClock(now)}
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => engine.setRunning(!running)}
        aria-label={running ? '일시정지' : '재개'}
        title={running ? '일시정지' : '재개'}
      >
        <Icon name={running ? 'pause' : 'play'} size={12} />
      </button>
      <button
        type="button"
        className={styles.button}
        disabled={running || !next}
        onClick={() => engine.step()}
        aria-label="다음 예약 작업 실행"
        title={next ? `단계 진행: ${simClock(next.dueAt)} ${next.label}` : '예약된 작업 없음'}
      >
        <Icon name="step" size={12} />
      </button>
      <select
        className={styles.speed}
        value={speed}
        onChange={(e) => engine.setSpeed(Number(e.target.value))}
        aria-label="배속"
        title="시뮬레이션 배속"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            ×{s}
          </option>
        ))}
      </select>
      <span className={styles.queue} title={timers.map((t) => `${simClock(t.dueAt)} ${t.label}`).join('\n') || '예약된 작업 없음'}>
        예약 {timers.length}
      </span>
    </div>
  );
}
