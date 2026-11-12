import type { WorldState } from '../engine/engine';
import { contiguousPersisted, type LiveBlock, type LivePropertyMeta, type LiveTemplate } from '../engine/server/liveState';
import type { DebounceValue } from '../engine/server/editService';
import type { Json, Row } from '../engine/types';
import { useWorld } from '../editor/editorContext';
import styles from './monitor.module.css';

/**
 * Redis Live vs PostgreSQL Persisted 비교 (CLAUDE_PROMPT §14.3, DB_SCHEMA §7.2~7.3).
 * - 대상(블록, 템플릿 요소)별 값 비교: 다른 필드 강조
 * - 대상 전체 저장 상태: revision / 연속 persisted_revision
 * - 속성별 저장 상태: property_state 행 단위 + Debounce 상태(WAITING 남은 시간, FAILED)
 */

/** JSON → { 'style.fontSize': 16, body: '...' } */
function flatten(v: Json, prefix = ''): Record<string, Json> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, Json> = {};
    for (const [k, child] of Object.entries(v)) Object.assign(out, flatten(child, prefix ? `${prefix}.${k}` : k));
    return out;
  }
  return { [prefix]: v };
}

const show = (v: Json | undefined) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
const stringValue = <T,>(redis: WorldState['redis'], key: string) => {
  const v = redis[key];
  return v && v.type === 'string' ? (v.value as unknown as T) : null;
};

function ValueDiff({ live, pg }: { live: Json; pg: Json }) {
  const a = flatten(live);
  const b = flatten(pg);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return (
    <table className={styles.miniTable}>
      <thead>
        <tr>
          <th>필드</th>
          <th>Redis Live</th>
          <th>PostgreSQL</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const diff = show(a[k]) !== show(b[k]);
          return (
            <tr key={k} data-diff={diff} className={diff ? styles.diffRow : undefined}>
              <td>{k}</td>
              <td>{show(a[k])}</td>
              <td className={diff ? styles.stale : undefined}>{show(b[k])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RevisionSummary({ liveRevision, livePersisted, pgRow }: { liveRevision: number; livePersisted: number; pgRow: Row | undefined }) {
  const synced = pgRow && pgRow.revision === liveRevision && pgRow.persisted_revision === liveRevision;
  return (
    <div className={styles.revSummary}>
      <span>
        Redis revision <b>{liveRevision}</b> · 연속 저장 <b>{livePersisted}</b>
      </span>
      <span>
        PG revision <b>{String(pgRow?.revision ?? '—')}</b> · persisted_revision <b>{String(pgRow?.persisted_revision ?? '—')}</b>
      </span>
      <span className={styles.status} data-tone={synced ? 'ok' : 'warn'}>
        {synced ? 'PERSISTED' : 'WAITING'}
      </span>
    </div>
  );
}

function PropertyStates({
  rows,
  now,
}: {
  rows: { path: string; meta: LivePropertyMeta; pg: Row | undefined; debounce: DebounceValue | null }[];
  now: number;
}) {
  if (rows.length === 0) return <div className={styles.keyEmpty}>속성 변경 없음 (property_state 행은 첫 저장 시 INSERT)</div>;
  return (
    <table className={styles.miniTable}>
      <thead>
        <tr>
          <th>property_path</th>
          <th>Redis rev</th>
          <th>PG rev / persisted</th>
          <th>fencing</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ path, meta, pg, debounce }) => {
          const status = debounce?.status ?? (meta.persistedRevision === meta.revision ? 'PERSISTED' : 'WAITING');
          const tone = status === 'PERSISTED' ? 'ok' : status === 'FAILED' || status === 'DEAD' ? 'danger' : 'warn';
          return (
            <tr key={path}>
              <td>{path}</td>
              <td>{meta.revision}</td>
              <td>{pg ? `${String(pg.revision)} / ${String(pg.persisted_revision)}` : '—'}</td>
              <td>{pg ? String(pg.last_fencing_token) : '—'}</td>
              <td>
                <span className={styles.status} data-tone={tone}>
                  {status}
                </span>
                {debounce?.status === 'WAITING' && <span className={styles.countdown}> {Math.max(0, debounce.dueAt - now)}ms</span>}
                {debounce?.lastError && <span className={styles.countdown}> {debounce.lastError} · 시도 {debounce.attempt}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ComparePanel() {
  const redis = useWorld((w) => w.redis);
  const tables = useWorld((w) => w.tables);
  // Debounce 대기 중일 때만 남은 시간을 위해 시계를 따라 다시 그린다
  const now = useWorld((w) => (Object.keys(w.redis).some((k) => k.startsWith('debounce:')) ? w.now : 0));

  const blocks = Object.keys(redis)
    .filter((k) => k.startsWith('live:block:'))
    .sort()
    .map((k) => stringValue<LiveBlock>(redis, k)!)
    .filter(Boolean);
  const templates = Object.keys(redis)
    .filter((k) => k.startsWith('live:template:'))
    .sort()
    .map((k) => stringValue<LiveTemplate>(redis, k)!)
    .filter(Boolean);

  return (
    <div className={styles.redis}>
      {blocks.map((b) => {
        const pg = tables.block_live_state.find((r) => r.block_id === b.blockId);
        return (
          <section key={b.blockId} className={styles.compareCard}>
            <div className={styles.keyGroupHead}>
              <span className={styles.keyGroupName}>블록 {b.blockId}</span>
              <span className={styles.keyPattern}>live:block:{b.blockId} ↔ block_live_state</span>
            </div>
            <div className={styles.subTitle}>블록 전체 저장 상태</div>
            <RevisionSummary liveRevision={b.revision} livePersisted={contiguousPersisted(b)} pgRow={pg} />
            <div className={styles.subTitle}>콘텐츠</div>
            <ValueDiff live={b.content as Json} pg={(pg?.content as Json) ?? null} />
            <div className={styles.subTitle}>속성별 저장 상태 (block_property_state)</div>
            <PropertyStates
              now={now}
              rows={Object.entries(b.properties).map(([path, meta]) => ({
                path,
                meta,
                pg: tables.block_property_state.find((r) => r.block_id === b.blockId && r.property_path === path),
                debounce: stringValue<DebounceValue>(redis, `debounce:block:${b.blockId}:${path}`),
              }))}
            />
            {b.unpersisted.length > 0 && (
              <div className={styles.keyEmpty}>
                미저장 revision: {b.unpersisted.map((u) => `${u.revision}(${u.key})`).join(', ')}
              </div>
            )}
          </section>
        );
      })}

      {templates.map((t) => {
        const pg = tables.template_live_state.find((r) => r.template_id === t.templateId);
        return (
          <section key={t.templateId} className={styles.compareCard}>
            <div className={styles.keyGroupHead}>
              <span className={styles.keyGroupName}>템플릿 {t.templateId}</span>
              <span className={styles.keyPattern}>live:template:{t.templateId} ↔ template_live_state · template_live_element</span>
            </div>
            <div className={styles.subTitle}>템플릿 전체 저장 상태</div>
            <RevisionSummary liveRevision={t.revision} livePersisted={contiguousPersisted(t)} pgRow={pg} />
            {Object.entries(t.elements).map(([eid, el]) => {
              const row = tables.template_live_element.find((r) => r.template_id === t.templateId && r.template_element_id === eid);
              return (
                <div key={eid}>
                  <div className={styles.subTitle}>
                    요소 {eid} · 블록 {el.blockId} · 배치
                  </div>
                  <ValueDiff live={el.props as unknown as Json} pg={(row?.props as Json) ?? null} />
                  <PropertyStates
                    now={now}
                    rows={Object.entries(el.properties).map(([path, meta]) => ({
                      path,
                      meta,
                      pg: tables.template_element_property_state.find(
                        (r) => r.template_id === t.templateId && r.template_element_id === eid && r.property_path === path,
                      ),
                      debounce: stringValue<DebounceValue>(redis, `debounce:template:${t.templateId}:element:${eid}:${path}`),
                    }))}
                  />
                </div>
              );
            })}
          </section>
        );
      })}
      <div className={styles.keyEmpty}>
        Debounce 대기 중 Redis와 PostgreSQL 값이 다른 것은 의도된 동작입니다 (§14.2).
      </div>
    </div>
  );
}
