import { useEffect, useMemo, useState } from 'react';
import type { CrudChange, CrudDraft, TxRecord } from '../engine/db/mockDatabase';
import { formatPk } from '../engine/db/mockDatabase';
import { diffChange, toSql, txSql } from '../engine/db/sql';
import { simClock } from '../engine/simTime';
import type { Json, TableName } from '../engine/types';
import { useEditorStore, useWorld } from '../editor/editorContext';
import { Icon } from '../editor/ui/icons';
import styles from './monitor.module.css';

/**
 * CRUD 이력 · 변경 전후 비교 · SQL 미리보기 (CLAUDE_PROMPT §5, §10).
 * 트랜잭션 단위로 묶어 보여 주고, 롤백된 트랜잭션도 표시한다. SQL은 실행하지 않는 설명용이다.
 */

const OP_LABEL = { INSERT: '+ INSERT', UPDATE: '~ UPDATE', DELETE: '- DELETE' } as const;
const TX_LIMIT = 40;

const show = (v: Json | undefined) => (v === undefined ? '' : v === null ? 'NULL' : typeof v === 'string' ? v : JSON.stringify(v));

export function OpBadge({ op }: { op: CrudChange['op'] }) {
  return (
    <span className={styles.crudOp} data-op={op}>
      {OP_LABEL[op]}
    </span>
  );
}

function DiffTable({ change }: { change: CrudDraft }) {
  const rows = diffChange(change);
  return (
    <table className={styles.miniTable}>
      <thead>
        <tr>
          <th>컬럼</th>
          <th>이전 값</th>
          <th>새로운 값</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={`${d.column}.${d.path ?? ''}`}>
            <td>
              {d.column}
              {d.path && <span className={styles.diffPath}>.{d.path}</span>}
            </td>
            <td className={styles.diffBefore}>{d.before === undefined ? <span className={styles.null}>—</span> : show(d.before)}</td>
            <td className={styles.diffAfter} data-op={change.op}>
              {d.after === undefined ? <span className={styles.null}>—</span> : show(d.after)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SqlBlock({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.sqlWrap}>
      <button
        type="button"
        className={styles.sqlCopy}
        onClick={() => {
          void navigator.clipboard?.writeText(sql).then(() => setCopied(true));
          setTimeout(() => setCopied(false), 1200);
        }}
        title="SQL 복사"
      >
        {copied ? '복사됨' : '복사'}
      </button>
      <pre className={styles.sql}>{sql}</pre>
      <div className={styles.sqlNote}>미리보기 전용 · 실행하지 않음 · Mock DB 변경과 동일한 결과</div>
    </div>
  );
}

type Selection = { kind: 'change'; id: string } | { kind: 'tx'; id: string } | null;

export function CrudHistory({ table, fresh }: { table: TableName; fresh: Set<string> }) {
  const changes = useWorld((w) => w.dbChanges);
  const transactions = useWorld((w) => w.dbTransactions);
  const focus = useEditorStore((s) => s.monitorFocus);
  const [scope, setScope] = useState<'table' | 'all'>('table');
  const [selection, setSelection] = useState<Selection>(null);

  // Timeline 등에서 특정 트랜잭션·변경으로 이동 요청
  useEffect(() => {
    if (!focus) return;
    if (focus.changeId) setSelection({ kind: 'change', id: focus.changeId });
    else if (focus.txId) {
      setSelection({ kind: 'tx', id: focus.txId });
      setScope('all');
    }
  }, [focus]);

  const byTx = useMemo(() => {
    const map = new Map<string, CrudChange[]>();
    for (const c of changes) map.set(c.txId, [...(map.get(c.txId) ?? []), c]);
    return map;
  }, [changes]);

  const visibleTx = useMemo(() => {
    const list = [...transactions].reverse().filter((tx) => {
      if (scope === 'all') return true;
      const own = byTx.get(tx.txId) ?? tx.attempted ?? [];
      return own.some((c) => c.table === table);
    });
    return list.slice(0, TX_LIMIT);
  }, [transactions, byTx, scope, table]);

  const selectedChange = selection?.kind === 'change' ? changes.find((c) => c.changeId === selection.id) : undefined;
  const selectedTx = selection?.kind === 'tx' ? transactions.find((t) => t.txId === selection.id) : undefined;

  return (
    <div className={styles.history}>
      <div className={styles.historyHead}>
        <span className={styles.subTitle}>CRUD 이력</span>
        <div className={styles.segment} role="group" aria-label="이력 범위">
          <button type="button" aria-pressed={scope === 'table'} onClick={() => setScope('table')}>
            이 테이블
          </button>
          <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            전체
          </button>
        </div>
        <span className={styles.timelineCount}>
          트랜잭션 {transactions.length} · CRUD {changes.length}
        </span>
      </div>
      <div className={styles.historySplit}>
        <div className={styles.historyList}>
          {visibleTx.length === 0 && <div className={styles.subEmpty}>기록 없음 — 이 테이블에 대한 CRUD가 아직 없습니다.</div>}
          {visibleTx.map((tx) => (
            <TxGroup
              key={tx.txId}
              tx={tx}
              changes={(byTx.get(tx.txId) ?? []).filter((c) => scope === 'all' || c.table === table)}
              fresh={fresh}
              selection={selection}
              onSelect={setSelection}
            />
          ))}
        </div>
        <div className={styles.historyDetail}>
          {selectedChange ? (
            <>
              <div className={styles.detailTitle}>
                <OpBadge op={selectedChange.op} />
                <span className={styles.keyName}>{selectedChange.table}</span>
                <span className={styles.keySummary}>{formatPk(selectedChange.pk)}</span>
              </div>
              <div className={styles.detailMeta}>
                {selectedChange.changeId} · {selectedChange.txId} · {simClock(selectedChange.at)}
                {selectedChange.requestId && ` · ${selectedChange.requestId}`}
                {selectedChange.actorUserId && ` · ${selectedChange.actorUserId}`}
              </div>
              <div className={styles.subTitle}>변경 전후 비교</div>
              <DiffTable change={selectedChange} />
              <div className={styles.subTitle}>SQL</div>
              <SqlBlock sql={toSql(selectedChange)} />
            </>
          ) : selectedTx ? (
            <>
              <div className={styles.detailTitle}>
                <span className={styles.status} data-tone={selectedTx.status === 'COMMITTED' ? 'ok' : 'danger'}>
                  {selectedTx.status}
                </span>
                <span className={styles.keyName}>{selectedTx.txId}</span>
                <span className={styles.keySummary}>{selectedTx.label}</span>
              </div>
              <div className={styles.subTitle}>트랜잭션 SQL</div>
              <SqlBlock sql={txSql(selectedTx, byTx.get(selectedTx.txId) ?? [])} />
            </>
          ) : (
            <div className={styles.subEmpty}>
              <Icon name="info" size={12} /> 변경을 선택하면 이전 값 / 새로운 값과 SQL을 보여 줍니다. 트랜잭션 머리글을 선택하면 BEGIN … COMMIT 전체를 보여 줍니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TxGroup({
  tx,
  changes,
  fresh,
  selection,
  onSelect,
}: {
  tx: TxRecord;
  changes: CrudChange[];
  fresh: Set<string>;
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const rolledBack = tx.status === 'ROLLED_BACK';
  return (
    <div className={styles.txGroup} data-status={tx.status}>
      <button
        type="button"
        className={styles.txHead}
        aria-pressed={selection?.kind === 'tx' && selection.id === tx.txId}
        onClick={() => onSelect({ kind: 'tx', id: tx.txId })}
        title={`${tx.label}${tx.error ? `\n오류: ${tx.error}` : ''}`}
      >
        <span className={styles.cmdTime}>{simClock(tx.at)}</span>
        <span className={styles.keyName}>{tx.txId}</span>
        <span className={styles.status} data-tone={rolledBack ? 'danger' : 'ok'}>
          {rolledBack ? 'ROLLBACK' : 'COMMIT'}
        </span>
        <span className={styles.keySummary}>{tx.label}</span>
        {tx.actorUserId && <span className={styles.cmdResult}>{tx.actorUserId}</span>}
      </button>
      {rolledBack && (
        <div className={styles.txRolled}>
          시도한 변경 {tx.attemptedChanges}건 · 적용 안 됨 · {tx.error}
        </div>
      )}
      {changes.map((c) => (
        <button
          type="button"
          key={c.changeId}
          className={styles.changeRow}
          data-fresh={fresh.has(c.changeId)}
          data-op={c.op}
          aria-pressed={selection?.kind === 'change' && selection.id === c.changeId}
          onClick={() => onSelect({ kind: 'change', id: c.changeId })}
        >
          <OpBadge op={c.op} />
          <span className={styles.keyName}>{c.table}</span>
          <span className={styles.keySummary}>
            {formatPk(c.pk)}
            {c.op === 'UPDATE' && ` · ${c.changedColumns.join(', ')}`}
          </span>
        </button>
      ))}
    </div>
  );
}
