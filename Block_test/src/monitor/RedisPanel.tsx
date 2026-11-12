import { useState } from 'react';
import type { PresenceInfo } from '../engine/protocol';
import type { RedisValue } from '../engine/redis/mockRedis';
import { simClock } from '../engine/simTime';
import type { Json } from '../engine/types';
import { useEditorStore, useWorld } from '../editor/editorContext';
import { Icon } from '../editor/ui/icons';
import styles from './monitor.module.css';

/**
 * MockRedis 실제 키 뷰어. 엔진 WorldState의 redis 스냅샷만 읽는다.
 * 그룹은 DB_SCHEMA §4, §8.2의 키 패턴 기준이다.
 */
const GROUPS = [
  { name: 'Live 상태', prefix: 'live:', pattern: 'live:block:{blockId} · live:template:{templateId}', note: '승인된 최신 상태 (실시간 화면의 원본)' },
  { name: 'Property Lock', prefix: 'lock:', pattern: 'lock:block:{blockId}:{path} · lock:template:{tid}:element:{eid}:{path}', note: 'Phase 3에서 생성' },
  { name: 'Fencing Token', prefix: 'fence:', pattern: 'fence:{lockKey}', note: 'INCR 단조 증가 · Phase 3에서 생성' },
  { name: 'Debounce 예약', prefix: 'debounce:', pattern: 'debounce:block:{blockId}:{path}', note: 'revision · dueAt · status · attempt · Phase 3에서 생성' },
  { name: 'Presence', prefix: 'presence:', pattern: 'presence:template:{templateId}', note: 'Hash + Pub/Sub 채널 (Stream 미기록)' },
  { name: '전역 순번', prefix: 'seq:', pattern: 'seq:stream', note: 'INCR · 승인된 변경마다 1 증가 (§8.9.1)' },
  { name: 'Stream', prefix: 'stream:', pattern: 'stream:block:{blockId} · stream:template:{templateId}', note: '승인된 변경 XADD · 재연결 따라잡기' },
] as const;

function JsonBlock({ value }: { value: Json }) {
  return <pre className={styles.jsonPre}>{JSON.stringify(value, null, 2)}</pre>;
}

function PresenceTable({ fields }: { fields: Record<string, Json> }) {
  const users = useEditorStore((s) => s.users);
  return (
    <table className={styles.miniTable}>
      <thead>
        <tr>
          <th>user</th>
          <th>status</th>
          <th>connection</th>
          <th>selected</th>
          <th>path</th>
          <th>cursor</th>
          <th>updated</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(fields).map(([userId, raw]) => {
          const p = raw as unknown as PresenceInfo;
          const color = users.find((u) => u.userId === userId)?.color;
          return (
            <tr key={userId}>
              <td>
                <span className={styles.userDot} style={{ background: color }} />
                {userId}
              </td>
              <td>
                <span className={styles.status} data-tone={p.status === 'connected' ? 'ok' : 'muted'}>
                  {p.status === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </td>
              <td>{p.connectionId ?? <span className={styles.null}>NULL</span>}</td>
              <td>{p.selectedElementId ?? <span className={styles.null}>—</span>}</td>
              <td>{p.selectedPropertyPath ?? <span className={styles.null}>—</span>}</td>
              <td>{p.cursor ? `${p.cursor.x},${p.cursor.y}` : <span className={styles.null}>—</span>}</td>
              <td>{simClock(p.updatedAt)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function KeyRow({ name, value, now }: { name: string; value: RedisValue; now: number }) {
  const [open, setOpen] = useState(name.startsWith('presence:'));
  const summary =
    value.type === 'string'
      ? summarizeString(value.value)
      : value.type === 'hash'
        ? `${Object.keys(value.fields).length} fields`
        : `${value.entries.length} entries · last ${value.entries.at(-1)?.id ?? '-'}`;
  const ttl = value.expiresAt !== null ? Math.max(0, value.expiresAt - now) : null;

  return (
    <div className={styles.keyItem}>
      <button type="button" className={styles.keyRow} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10} />
        <span className={styles.keyType} data-type={value.type}>
          {value.type.toUpperCase()}
        </span>
        <span className={styles.keyName}>{name}</span>
        <span className={styles.keySummary}>{summary}</span>
        {ttl !== null && <span className={styles.ttl}>TTL {(ttl / 1000).toFixed(1)}s</span>}
      </button>
      {open && (
        <div className={styles.keyBody}>
          {value.type === 'string' && <JsonBlock value={value.value} />}
          {value.type === 'hash' &&
            (name.startsWith('presence:') ? <PresenceTable fields={value.fields} /> : <JsonBlock value={value.fields} />)}
          {value.type === 'stream' && (
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>id</th>
                  <th>name</th>
                  <th>revision</th>
                  <th>seq</th>
                  <th>actor</th>
                  <th>request</th>
                </tr>
              </thead>
              <tbody>
                {value.entries.map((e) => (
                  <tr key={e.id}>
                    <td>{e.id}</td>
                    <td>{String(e.fields.name)}</td>
                    <td>{String(e.fields.revision)}</td>
                    <td>{String(e.fields.streamSeq)}</td>
                    <td>{String(e.fields.actorUserId)}</td>
                    <td>{String(e.fields.requestId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function summarizeString(v: Json): string {
  if (v && typeof v === 'object' && !Array.isArray(v) && 'revision' in v) return `revision ${String(v.revision)}`;
  const s = JSON.stringify(v);
  return s.length > 48 ? `${s.slice(0, 45)}...` : s;
}

export function RedisPanel() {
  const data = useWorld((w) => w.redis);
  const channels = useWorld((w) => w.channels);
  const log = useWorld((w) => w.redisLog);
  // TTL이 있는 키가 있을 때만 시계 진행에 맞춰 다시 그린다
  const now = useWorld((w) => (Object.values(w.redis).some((v) => v.expiresAt !== null) ? w.now : 0));
  const keys = Object.keys(data).sort();

  return (
    <div className={styles.redis}>
      {GROUPS.map((g) => {
        const groupKeys = keys.filter((k) => k.startsWith(g.prefix));
        const groupChannels = g.prefix === 'presence:' ? Object.entries(channels) : [];
        return (
          <div key={g.name} className={styles.keyGroup}>
            <div className={styles.keyGroupHead}>
              <span className={styles.keyGroupName}>{g.name}</span>
              <span className={styles.keyCount}>{groupKeys.length}</span>
              <span className={styles.keyPattern}>{g.pattern}</span>
            </div>
            {groupKeys.length === 0 && <div className={styles.keyEmpty}>(empty) · {g.note}</div>}
            {groupKeys.map((k) => (
              <KeyRow key={k} name={k} value={data[k]} now={now} />
            ))}
            {groupChannels.map(([ch, subs]) => (
              <div key={ch} className={styles.channelRow}>
                <span className={styles.keyType} data-type="channel">
                  PUBSUB
                </span>
                <span className={styles.keyName}>{ch}</span>
                <span className={styles.keySummary}>구독 {subs.length} · {subs.join(', ')}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div className={styles.keyGroup}>
        <div className={styles.keyGroupHead}>
          <span className={styles.keyGroupName}>최근 명령</span>
          <span className={styles.keyCount}>{log.length}</span>
          <span className={styles.keyPattern}>최근 200건 · 최신순</span>
        </div>
        <div className={styles.cmdLog}>
          {[...log]
            .reverse()
            .slice(0, 60)
            .map((c) => (
              <div key={c.seq} className={styles.cmdRow}>
                <span className={styles.cmdTime}>{simClock(c.at)}</span>
                <span className={styles.cmdName}>{c.command}</span>
                <span className={styles.keyName}>{c.key}</span>
                <span className={styles.keySummary}>{c.detail}</span>
                <span className={styles.cmdResult}>{c.result}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
