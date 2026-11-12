import { useState, type ReactNode } from 'react';
import type { InjectionScope } from '../engine/db/mockDatabase';
import { syncInfoOf } from '../engine/engine';
import type { DebounceValue } from '../engine/server/editService';
import { simClock } from '../engine/simTime';
import type { Json } from '../engine/types';
import { useEditorStore, useEngine, useWorld } from '../editor/editorContext';
import { syncLabel } from '../editor/ui/PresenceBar';
import { SCENARIOS } from '../scenarios/definitions';
import type { RunnerStatus } from '../scenarios/types';
import styles from './monitor.module.css';
import { useRunner, useRunnerState } from './runnerContext';

/**
 * Simulation Console (CLAUDE_PROMPT §8, §15.2): 시뮬레이터 조작.
 * 시나리오 실행 · 전체 초기화 · 실패 주입 · 저장 작업(재시도·DEAD·수동 재시도) · 연결 · Lock · Fixture.
 * 모든 조작은 엔진 메서드(또는 EditorPort)로만 수행한다.
 */

/** 상태 표시: 색 + 텍스트 라벨 (색만으로 구분하지 않음) */
type Tone = 'ok' | 'warn' | 'danger' | 'muted' | 'sent' | 'locked';
function Badge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={styles.status} data-tone={tone}>
      {children}
    </span>
  );
}

const RUNNER_STATUS: Record<RunnerStatus, { label: string; tone: Tone }> = {
  idle: { label: '대기', tone: 'muted' },
  initializing: { label: '초기화 중', tone: 'warn' },
  precondition: { label: 'PRECONDITION', tone: 'warn' },
  running: { label: '실행 중', tone: 'sent' },
  verifying: { label: '검증 중', tone: 'sent' },
  done: { label: '완료', tone: 'ok' },
};

const show = (v: Json) => (typeof v === 'string' ? v : JSON.stringify(v));

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={styles.consoleSection}>
      <div className={styles.keyGroupHead}>
        <span className={styles.keyGroupName}>{title}</span>
        {hint && <span className={styles.keyPattern}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ScenarioSection() {
  const runner = useRunner();
  const state = useRunnerState((s) => s);
  const now = useWorld((w) => (state.status === 'running' || state.status === 'verifying' ? w.now : 0));
  const [selected, setSelected] = useState(SCENARIOS[0].id);
  const def = SCENARIOS.find((s) => s.id === selected)!;
  const status = RUNNER_STATUS[state.status];
  const active = state.scenarioId === selected;

  return (
    <Section title="시나리오 실행" hint="전체 초기화 → Fixture · PRECONDITION → 본 단계(VirtualClock) → 검증">
      <div className={styles.consoleRow}>
        <select className={styles.consoleSelect} value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="시나리오">
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.title}
            </option>
          ))}
        </select>
        <button type="button" className={styles.consoleButton} data-primary onClick={() => runner.run(selected)}>
          {active && state.status !== 'idle' ? '다시 실행' : '실행'}
        </button>
        <button
          type="button"
          className={styles.consoleButton}
          disabled={state.status !== 'running'}
          onClick={() => runner.fastForward()}
          title="본 단계를 검증 시각까지 즉시 진행 (시계를 빠르게)"
        >
          끝까지 진행
        </button>
      </div>
      <div className={styles.consoleSummary}>{def.summary}</div>
      {def.precondition && <div className={styles.keyEmpty}>precondition: {def.precondition.map((p) => p.label).join(' → ')}</div>}
      {def.reset?.fixtures?.length ? <div className={styles.keyEmpty}>Fixture: {def.reset.fixtures.map((f) => f.name).join(', ')} (applyFixture · FIXTURE 이벤트)</div> : null}
      {def.failures && (
        <div className={styles.keyEmpty}>
          실패 주입: {def.failures.scope} 쓰기 {def.failures.count}회
        </div>
      )}

      {state.scenarioId && (
        <div className={styles.runnerStatus}>
          <div className={styles.consoleRow}>
            <b>시나리오 {state.scenarioId}</b>
            <Badge tone={status.tone}>{status.label}</Badge>
            {state.status === 'done' && <Badge tone={state.passed ? 'ok' : 'danger'}>{state.passed ? 'PASS' : 'FAIL'}</Badge>}
            <span className={styles.keySummary}>
              단계 {state.stepsDone}/{state.stepsTotal}
              {state.verifyAt !== null && state.status === 'running' && ` · 검증까지 ${Math.max(0, state.verifyAt - now)}ms`}
              {` · 실행 ${state.runs}회`}
            </span>
          </div>
          {state.log.length > 0 && (
            <ol className={styles.runnerLog}>
              {state.log.map((l, i) => (
                <li key={i}>
                  <span className={styles.cmdTime}>t+{l.at}</span> {l.label}
                </li>
              ))}
            </ol>
          )}
          {state.results.length > 0 && (
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>검증</th>
                  <th>기대</th>
                  <th>실제</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.results.map((r) => (
                  <tr key={r.label} className={r.pass ? undefined : styles.diffRow}>
                    <td className={styles.wrapCell}>{r.label}</td>
                    <td className={styles.wrapCell}>{show(r.expected)}</td>
                    <td className={styles.wrapCell}>{show(r.actual)}</td>
                    <td>
                      <Badge tone={r.pass ? 'ok' : 'danger'}>{r.pass ? 'PASS' : 'FAIL'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function ResetSection() {
  const engine = useEngine();
  const lastReset = useWorld((w) => w.lastReset);
  const generation = useWorld((w) => w.generation);
  const [resetting, setResetting] = useState(false);
  const reset = () => {
    setResetting(true);
    // "초기화 중"을 그린 뒤 하나의 엔진 작업으로 초기화
    requestAnimationFrame(() => {
      engine.reset({ label: '전체 초기화 (Console)' });
      setResetting(false);
    });
  };
  return (
    <Section title="전체 초기화" hint="DB · Redis · WebSocket · 시계·예약 작업 · 이벤트 · Lock · Debounce · 재시도 · Replica · Presence · Fixture">
      <div className={styles.consoleRow}>
        <button type="button" className={styles.consoleButton} data-danger onClick={reset} disabled={resetting}>
          전체 초기화
        </button>
        {resetting ? (
          <Badge tone="warn">초기화 중</Badge>
        ) : lastReset ? (
          <>
            <Badge tone="ok">초기화 완료</Badge>
            <span className={styles.keySummary}>
              {lastReset.label} · 세대 {generation}
              {lastReset.fixtures.length ? ` · Fixture ${lastReset.fixtures.join(', ')}` : ''} · {new Date(lastReset.realTime).toLocaleTimeString()}
            </span>
          </>
        ) : (
          <span className={styles.keySummary}>최초 상태 (Seed)</span>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

const SCOPES: { value: InjectionScope; label: string }[] = [
  { value: 'debounce', label: 'Debounce 저장' },
  { value: 'version', label: '명시적 저장·복원' },
  { value: 'structure', label: '구조 변경' },
  { value: 'any', label: '모든 쓰기 (Fixture 제외)' },
];

function FailureSection() {
  const engine = useEngine();
  const injection = useWorld((w) => w.injection);
  const transactions = useWorld((w) => w.dbTransactions);
  const injectedTx = transactions.filter((t) => t.injected);
  const [count, setCount] = useState(2);
  const [scope, setScope] = useState<InjectionScope>('debounce');
  const active = injection.remaining > 0;
  return (
    <Section title="실패 주입" hint="MockDatabase 쓰기 트랜잭션 실패 (connection reset (mock))">
      <div className={styles.consoleRow}>
        <label className={styles.consoleLabel}>
          횟수
          <input
            type="number"
            min={0}
            max={20}
            className={styles.consoleInput}
            value={count}
            onChange={(e) => setCount(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
          />
        </label>
        <select className={styles.consoleSelect} value={scope} onChange={(e) => setScope(e.target.value as InjectionScope)} aria-label="실패 주입 대상">
          {SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" className={styles.consoleButton} onClick={() => engine.setFailureInjection(count, scope)}>
          적용
        </button>
        <button type="button" className={styles.consoleButton} disabled={!active} onClick={() => engine.setFailureInjection(0)}>
          해제
        </button>
      </div>
      <div className={styles.consoleRow}>
        <Badge tone={active ? 'danger' : 'muted'}>{active ? '활성' : '비활성'}</Badge>
        <span className={styles.keySummary}>
          대상 {SCOPES.find((s) => s.value === injection.scope)?.label} · 남은 {injection.remaining}/{injection.configured} · 실제 실패 {injection.triggered}건 · 누적 주입 실패 트랜잭션{' '}
          {injectedTx.length}건
        </span>
      </div>
      {injectedTx.length > 0 && (
        <div className={styles.cmdLog}>
          {injectedTx
            .slice(-5)
            .reverse()
            .map((t) => (
              <div key={t.txId} className={styles.cmdRow}>
                <span className={styles.cmdTime}>{simClock(t.at)}</span>
                <span className={styles.cmdName}>ROLLBACK</span>
                <span className={styles.keyName}>{t.txId}</span>
                <span className={styles.keySummary}>{t.label}</span>
              </div>
            ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

const JOB_STATUS: Record<DebounceValue['status'], { label: string; tone: Tone }> = {
  WAITING: { label: '저장 대기', tone: 'warn' },
  FLUSHING: { label: '저장 중', tone: 'sent' },
  FAILED: { label: '재시도 대기', tone: 'danger' },
  DEAD: { label: 'DEAD', tone: 'danger' },
};

function SaveJobsSection() {
  const engine = useEngine();
  const redis = useWorld((w) => w.redis);
  const now = useWorld((w) => (Object.keys(w.redis).some((k) => k.startsWith('debounce:')) ? w.now : 0));
  const events = useWorld((w) => w.events);
  const recent = events.filter((e) => e.name === 'DEBOUNCE_SAVE').slice(-4).reverse();
  const jobs = Object.entries(redis)
    .filter(([k, v]) => k.startsWith('debounce:') && v.type === 'string')
    .map(([key, v]) => ({ key, d: (v as { value: unknown }).value as DebounceValue }));
  return (
    <Section title="저장 작업" hint="Debounce · 재시도(1s · 2s · 4s, 최대 3회) · DEAD · 수동 재시도">
      {jobs.length === 0 ? (
        <div className={styles.keyEmpty}>대기 중인 저장 작업 없음</div>
      ) : (
        <table className={styles.miniTable}>
          <thead>
            <tr>
              <th>대상</th>
              <th>상태</th>
              <th>attempt / retry</th>
              <th>다음</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map(({ key, d }) => {
              const st = JOB_STATUS[d.status];
              const next = d.status === 'WAITING' ? d.dueAt : d.status === 'FAILED' ? d.nextRetryAt : null;
              return (
                <tr key={key}>
                  <td className={styles.wrapCell} title={key}>
                    {d.target}
                    {d.elementId ? `/${d.elementId}` : ''} · {d.propertyPath}
                    <div className={styles.keySummary}>
                      rev {d.targetRevision} · {d.requestId}
                    </div>
                  </td>
                  <td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {d.lastError && <div className={styles.countdown}>{d.lastError}</div>}
                  </td>
                  <td>
                    {d.attempt} / {d.retryCount}
                  </td>
                  <td>{next !== null ? `${simClock(next)} (${Math.max(0, next - now)}ms)` : d.status === 'DEAD' ? (d.retryable === false ? `재시도 불가 (${d.lastErrorCode}) · 즉시 DEAD` : '자동 재시도 없음') : '—'}</td>
                  <td>
                    {d.status === 'DEAD' && (
                      <button type="button" className={styles.consoleButton} onClick={() => engine.manualRetry(key)} title="최신 Live 값으로 1회 저장 시도">
                        수동 재시도
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {recent.length > 0 && (
        <div className={styles.cmdLog}>
          {recent.map((e) => {
            const p = e.payload as { trigger: string; attempt: number; retryCount: number; status: string; key: string };
            const tone: Tone = e.result === 'OK' ? 'ok' : p.status === 'DEAD' ? 'danger' : 'warn';
            const label = e.result === 'OK' ? '저장 완료' : p.status === 'DEAD' ? 'DEAD' : '실패';
            return (
              <div key={e.sequence} className={styles.cmdRow}>
                <span className={styles.cmdTime}>{simClock(e.timestamp)}</span>
                <Badge tone={tone}>{label}</Badge>
                <span className={styles.keyName}>{p.trigger === 'manual' ? '수동 재시도' : p.trigger === 'retry' ? `재시도 ${p.retryCount}` : '최초'}</span>
                <span className={styles.keySummary}>
                  attempt {p.attempt} · {p.key}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function ClientsSection() {
  const engine = useEngine();
  const users = useEditorStore((s) => s.users);
  const clients = useWorld((w) => w.clients);
  const syncs = useWorld((w) => users.map((u) => syncLabel(syncInfoOf(w, u.userId)) ?? '동기화됨').join('\u0001')).split('\u0001');
  return (
    <Section title="클라이언트" hint="연결 · 동기화 · Lock · 승인 대기 작업">
      <table className={styles.miniTable}>
        <thead>
          <tr>
            <th>user</th>
            <th>연결</th>
            <th>동기화</th>
            <th>pending</th>
            <th>seq</th>
            <th>보유 Lock</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => {
            const c = clients[u.userId];
            const connected = c.replica.connectionStatus === 'connected';
            const locks = Object.entries(c.locks);
            return (
              <tr key={u.userId}>
                <td>
                  <span className={styles.userDot} style={{ background: u.color }} />
                  {u.userId}
                </td>
                <td>
                  <Badge tone={connected ? 'ok' : 'muted'}>{connected ? 'CONNECTED' : 'DISCONNECTED'}</Badge>
                </td>
                <td className={syncs[i] === '동기화됨' ? undefined : styles.warnText}>{syncs[i]}</td>
                <td title={c.unconfirmed.map((x) => `${x.requestId} ${x.propertyPath} · 승인 확인 대기`).join('\n') || undefined}>
                  {c.replica.pendingOps.length}
                  {c.unconfirmed.length > 0 && <span className={styles.warnText}> · 확인 대기 {c.unconfirmed.length}</span>}
                </td>
                <td>{c.lastProcessedSeq}</td>
                <td className={styles.lockCell}>
                  {locks.length === 0
                    ? '—'
                    : locks.map(([key, l]) => (
                        <div key={key} title={key}>
                          <Badge tone={l.status === 'held' ? 'locked' : 'warn'}>{l.status === 'held' ? 'LOCKED' : 'REQUEST'}</Badge> {key.replace(/^lock:/, '')}
                          {l.expiresAt !== undefined && ` · ~${simClock(l.expiresAt)}`}
                        </div>
                      ))}
                </td>
                <td className={styles.actions}>
                  <button
                    type="button"
                    className={styles.consoleButton}
                    onClick={() => (connected ? engine.disconnect(u.userId) : engine.connect(u.userId))}
                    title={connected ? '연결 끊기 (CLIENT_DISCONNECTED)' : '재연결 (WS_OPEN → HELLO → SYNC)'}
                  >
                    {connected ? '연결 끊기' : '재연결'}
                  </button>
                  <button
                    type="button"
                    className={styles.consoleButton}
                    disabled={locks.length === 0}
                    onClick={() => engine.endEdit(u.userId)}
                    title="보유 Lock 명시적 해제 (PROPERTY_LOCK_RELEASE)"
                  >
                    Lock 해제
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function FixtureSection() {
  const engine = useEngine();
  const hasT002 = useWorld((w) => w.tables.template.some((t) => t.id === 'T002'));
  return (
    <Section title="FIXTURE" hint="명령이 아닌 초기 데이터 추가 (SIMULATION_SCENARIOS §1.1 예외)">
      <div className={styles.consoleRow}>
        <button
          type="button"
          className={styles.consoleButton}
          disabled={hasT002}
          onClick={() => engine.loadFixture('K')}
          title="T002(경력 템플릿) · TV101 · E101(B001 공유) · TVE101 추가"
        >
          {hasT002 ? '시나리오 K fixture 추가됨' : '시나리오 K: T002 추가'}
        </button>
      </div>
      <div className={styles.keyEmpty}>추가 후 상단 템플릿 선택에서 사용자별로 T002로 전환할 수 있습니다 (예: 사용자 2 시점 → T002).</div>
    </Section>
  );
}

export function ConsolePanel() {
  const latency = useWorld((w) => w.latencyMs);
  return (
    <div className={styles.redis}>
      <ScenarioSection />
      <ResetSection />
      <FailureSection />
      <SaveJobsSection />
      <ClientsSection />
      <FixtureSection />
      <div className={styles.keyEmpty}>
        네트워크 지연 {latency}ms · 다른 사용자로 편집하려면 상단에서 시점을 전환한 뒤 편집하세요 (편집 요청의 actor = 현재 시점 사용자).
      </div>
    </div>
  );
}
