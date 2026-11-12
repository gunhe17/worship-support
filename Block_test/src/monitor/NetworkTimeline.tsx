import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { filterEvents, SERVER_LANES, type Lane, type SimEvent } from '../engine/logger';
import { simClock } from '../engine/simTime';
import type { UserId } from '../engine/types';
import { useEditorStore, useEditorStoreApi, useWorld } from '../editor/editorContext';
import { focusMonitor } from '../editor/store/editorState';
import { txSql } from '../engine/db/sql';
import { Icon } from '../editor/ui/icons';
import styles from './monitor.module.css';

const SERVER_LANE_META: Record<string, { name: string; short: string; color: string }> = {
  WS: { name: 'WS Server', short: 'WS', color: '#9aa3b4' },
  REDIS: { name: 'Redis', short: 'Redis', color: '#f85149' },
  WORKER: { name: 'Debounce Worker', short: 'Worker', color: '#f0883e' },
  PG: { name: 'PostgreSQL', short: 'PG', color: '#58a6ff' },
};

const RESULT_TONE: Record<SimEvent['result'], string> = {
  OK: 'ok',
  DELIVERED: 'ok',
  SENT: 'sent',
  PARTIAL: 'warn',
  QUEUED: 'warn',
  DENIED: 'danger',
  FAILED: 'danger',
  INFO: 'muted',
};

/** 행 식별자: Presence는 별도 순번이므로 접두사 P (§8.9.6) */
const rowKey = (e: SimEvent) => (e.category === 'presence' ? `P${e.sequence}` : String(e.sequence));

const CATEGORY_LABEL: Record<SimEvent['category'], string> = {
  request: 'REQ',
  response: 'RES',
  broadcast: 'BROADCAST',
  delivery: 'DELIVERY',
  connection: 'CONN',
  redis: 'REDIS',
  db: 'DB',
  worker: 'WORKER',
  presence: 'PUB/SUB',
  system: 'SYS',
};

/** 이벤트 1건의 레인 표시: 송신 레인(●) → 수신 레인(▸) */
function LaneTrack({ event, lanes, colorOf }: { event: SimEvent; lanes: Lane[]; colorOf: (l: Lane) => string }) {
  const from = lanes.indexOf(event.from);
  const to = event.to.map((l) => lanes.indexOf(l)).filter((i) => i >= 0);
  const all = [from, ...to].filter((i) => i >= 0);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const col = (i: number) => `${((i + 0.5) / lanes.length) * 100}%`;
  return (
    <div className={styles.track} style={{ gridColumn: `3 / span ${lanes.length}` }}>
      {max > min && (
        <span
          className={styles.trackLine}
          style={{ left: col(min), width: `${((max - min) / lanes.length) * 100}%`, background: colorOf(event.from) }}
        />
      )}
      {to.map((i) => (
        <span key={i} className={styles.trackTo} style={{ left: col(i), color: colorOf(lanes[i]) }} data-dir={i < from ? 'left' : 'right'} />
      ))}
      {from >= 0 && <span className={styles.trackFrom} style={{ left: col(from), background: colorOf(event.from) }} />}
    </div>
  );
}

/** DB 트랜잭션 이벤트(DEBOUNCE_SAVE, STRUCTURE_SAVE)의 SQL과 DB Explorer 이동 */
function TxSql({ txId }: { txId: string }) {
  const store = useEditorStoreApi();
  const tx = useWorld((w) => w.dbTransactions.find((t) => t.txId === txId));
  const changes = useWorld((w) => w.dbChanges);
  if (!tx) return null;
  const own = changes.filter((c) => c.txId === txId);
  return (
    <>
      <div className={styles.detailTxHead}>
        <span className={styles.subTitle}>트랜잭션 SQL</span>
        <button type="button" className={styles.consoleButton} onClick={() => focusMonitor(store, { txId })}>
          DB Explorer에서 보기
        </button>
      </div>
      <pre className={styles.sql}>{txSql(tx, own)}</pre>
    </>
  );
}

function EventDetail({ event, onClose, colorOf }: { event: SimEvent; onClose: () => void; colorOf: (l: Lane) => string }) {
  const txId = (event.payload as { txId?: unknown } | null)?.txId;
  const laneName = (l: Lane) => SERVER_LANE_META[l]?.name ?? `Client ${l}`;
  const rows: [string, string | null][] = [
    [event.category === 'presence' ? 'presenceSequence' : 'sequence', String(event.sequence)],
    ['timestamp', simClock(event.timestamp)],
    ['category', event.category],
    ['requestId', event.requestId],
    ['actorUserId', event.actorUserId],
    ['actorName', event.actorName],
    ['from → to', `${laneName(event.from)} → ${event.to.map(laneName).join(', ') || '—'}`],
    ['target', event.target],
    ['propertyPath', event.propertyPath],
    ['result', `${event.result}${event.resultDetail ? ` · ${event.resultDetail}` : ''}`],
    ['처리 시간', event.durationMs === null ? null : `${event.durationMs}ms`],
    ['broadcastId', event.broadcastId],
    ['deliveryId', event.deliveryId],
    ['parent', event.parentSequence === null ? null : `#${event.parentSequence}`],
  ];
  return (
    <aside className={styles.detail} aria-label="이벤트 상세">
      <div className={styles.detailHead}>
        <span className={styles.detailName} style={{ ['--lane-color' as string]: colorOf(event.from) }}>
          <span className={styles.laneDot} />
          {event.name}
        </span>
        <button type="button" className={styles.tabAction} onClick={onClose} aria-label="상세 닫기">
          <Icon name="close" size={12} />
        </button>
      </div>
      <dl className={styles.detailList}>
        {rows
          .filter(([, v]) => v !== null)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {typeof txId === 'string' && <TxSql txId={txId} />}
      <div className={styles.subTitle}>Payload</div>
      <pre className={styles.jsonPre}>{JSON.stringify(event.payload, null, 2)}</pre>
    </aside>
  );
}

/**
 * Network Timeline.
 * 레인: Client U001~U004 · WS Server · Redis · Worker · PostgreSQL (v1.2)
 * 이벤트는 EventLogger(전역 sequence)에서 읽는다. 사용자 필터는 actorUserId 기준 (MU-6).
 * Presence(Pub/Sub)는 기본 숨김이며 시나리오 기대값 비교 대상이 아니다 (§8.2).
 */
export function NetworkTimeline({ onToggle, collapsed }: { onToggle: () => void; collapsed: boolean }) {
  const users = useEditorStore((s) => s.users);
  const events = useWorld((w) => w.events);
  const presenceEvents = useWorld((w) => w.presenceEvents);
  const [filter, setFilter] = useState<UserId | 'all'>('all');
  const [showPresence, setShowPresence] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const stickBottom = useRef(true);

  const lanes: Lane[] = useMemo(() => [...users.map((u) => u.userId), ...SERVER_LANES], [users]);
  const colorOf = (l: Lane) => users.find((u) => u.userId === l)?.color ?? SERVER_LANE_META[l]?.color ?? '#6b7486';
  const visible = useMemo(
    () => filterEvents(events, showPresence ? presenceEvents : [], { actorUserId: filter, includePresence: showPresence }),
    [events, presenceEvents, filter, showPresence],
  );
  // 시나리오 precondition 로그는 PRECONDITION 구간으로 접어서 표시한다 (SIMULATION_SCENARIOS §1.1)
  const [showPrecondition, setShowPrecondition] = useState(false);
  const preconditionCount = visible.filter((e) => e.section === 'PRECONDITION').length;
  const rows = showPrecondition ? visible : visible.filter((e) => e.section !== 'PRECONDITION');
  const selected = visible.find((e) => rowKey(e) === selectedKey) ?? null;
  const gridStyle = { gridTemplateColumns: `44px 92px repeat(${lanes.length}, minmax(40px, 0.55fr)) minmax(280px, 4fr)` } as CSSProperties;

  // 맨 아래를 보고 있을 때만 새 이벤트를 따라간다
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  return (
    <section className={styles.timeline} aria-label="Network Timeline">
      <div className={styles.timelineHead}>
        <span className={styles.timelineTitle}>
          <Icon name="pulse" size={13} /> Network Timeline
        </span>
        <span className={styles.timelineCount}>
          {visible.length} / {events.length + (showPresence ? presenceEvents.length : 0)}
        </span>
        <div className={styles.filters} role="group" aria-label="actor 필터">
          <button type="button" className={styles.filterChip} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            전체
          </button>
          {users.map((u) => (
            <button
              key={u.userId}
              type="button"
              className={styles.filterChip}
              style={{ ['--chip-color' as string]: u.color }}
              aria-pressed={filter === u.userId}
              onClick={() => setFilter(u.userId)}
              title={`actorUserId = ${u.userId}인 이벤트만 표시`}
            >
              <span className={styles.chipDot} />
              {u.userId}
            </button>
          ))}
          <button
            type="button"
            className={styles.filterChip}
            aria-pressed={showPresence}
            onClick={() => setShowPresence((v) => !v)}
            title="Presence(Pub/Sub) 이벤트 표시 · 최근 300건만 보관 (휘발성)"
          >
            Presence {presenceEvents.length > 0 && <span className={styles.chipCount}>{presenceEvents.length}</span>}
          </button>
        </div>
        <span className={styles.tabSpacer} />
        <button type="button" className={styles.tabAction} onClick={onToggle} aria-label={collapsed ? '타임라인 펼치기' : '타임라인 접기'}>
          <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
        </button>
      </div>
      {!collapsed && (
        <div className={styles.timelineMain}>
          <div className={styles.timelineTable}>
            <div className={styles.lanes} style={gridStyle}>
              <span>#</span>
              <span>시각 (sim)</span>
              {lanes.map((l) => (
                <span key={l} className={styles.lane} style={{ ['--lane-color' as string]: colorOf(l) }} title={SERVER_LANE_META[l]?.name ?? `Client ${l}`}>
                  <span className={styles.laneDot} />
                  {SERVER_LANE_META[l]?.short ?? l}
                </span>
              ))}
              <span>이벤트 · 결과</span>
            </div>
            <div
              className={styles.timelineBody}
              ref={bodyRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
              }}
            >
              {visible.length === 0 ? (
                <div className={styles.timelineEmpty}>
                  <Icon name="info" size={14} />
                  {events.length === 0
                    ? '네트워크 이벤트 없음 — 요소를 선택하거나 커서를 움직이면 Presence(Pub/Sub)가 기록됩니다. 편집 명령은 Phase 3에서 엔진에 연결됩니다.'
                    : `필터(${filter})에 해당하는 이벤트가 없습니다`}
                </div>
              ) : (
                <>
                {preconditionCount > 0 && (
                  <button type="button" className={styles.preconditionRow} onClick={() => setShowPrecondition((v) => !v)} aria-expanded={showPrecondition}>
                    <Icon name={showPrecondition ? 'chevronDown' : 'chevronRight'} size={11} />
                    PRECONDITION · {preconditionCount}건 {showPrecondition ? '접기' : '펼치기'} (초기화 · Fixture · 선행 명령 · 실패 주입)
                  </button>
                )}
                {rows.map((e) => (
                  <button
                    type="button"
                    key={rowKey(e)}
                    data-section={e.section ?? undefined}
                    className={styles.eventRow}
                    style={gridStyle}
                    aria-pressed={rowKey(e) === selectedKey}
                    data-category={e.category}
                    onClick={() => setSelectedKey(rowKey(e) === selectedKey ? null : rowKey(e))}
                  >
                    <span className={styles.eventSeq}>{rowKey(e)}</span>
                    <span className={styles.eventTime}>{simClock(e.timestamp)}</span>
                    <LaneTrack event={e} lanes={lanes} colorOf={colorOf} />
                    <span className={styles.eventInfo}>
                      <span className={styles.eventCategory}>{CATEGORY_LABEL[e.category]}</span>
                      <span className={styles.eventName}>{e.name}</span>
                      <span className={styles.status} data-tone={RESULT_TONE[e.result]}>
                        {e.result}
                      </span>
                      <span className={styles.eventMeta}>
                        {[e.target, e.propertyPath, e.resultDetail, e.durationMs !== null ? `${e.durationMs}ms` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                ))}
                </>
              )}
            </div>
          </div>
          {selected && <EventDetail event={selected} onClose={() => setSelectedKey(null)} colorOf={colorOf} />}
        </div>
      )}
    </section>
  );
}
