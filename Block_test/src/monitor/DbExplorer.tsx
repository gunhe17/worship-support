import { useEffect, useState } from 'react';
import type { CrudChange } from '../engine/db/mockDatabase';
import { primaryKeyOf, TABLES, type ColumnDef, type TableDef } from '../engine/db/schema';
import type { Json, Row, TableName } from '../engine/types';
import { useEditorStore, useWorld } from '../editor/editorContext';
import { CrudHistory, OpBadge } from './CrudHistory';
import { useFreshChanges } from './useFreshChanges';
import { Icon } from '../editor/ui/icons';
import styles from './monitor.module.css';

const GROUPS: { key: TableDef['group']; label: string }[] = [
  { key: 'block', label: 'Block' },
  { key: 'block-content', label: 'Block content' },
  { key: 'block-live', label: 'Block live' },
  { key: 'template', label: 'Template' },
  { key: 'template-live', label: 'Template live' },
];

function JsonCell({ value }: { value: Json }) {
  const [open, setOpen] = useState(false);
  const inline = JSON.stringify(value);
  return (
    <div>
      <button type="button" className={styles.jsonToggle} onClick={() => setOpen((o) => !o)} title={open ? '접기' : '펼치기'}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10} />
        {open ? 'jsonb' : inline}
      </button>
      {open && <pre className={styles.jsonPre}>{JSON.stringify(value, null, 2)}</pre>}
    </div>
  );
}

function Cell({ col, value }: { col: ColumnDef; value: Json | undefined }) {
  if (value === null || value === undefined) return <span className={styles.null}>NULL</span>;
  if (col.type === 'jsonb') return <JsonCell value={value} />;
  if (typeof value === 'number') return <span className={styles.num}>{value}</span>;
  return <span className={col.type === 'text' ? styles.str : undefined}>{String(value)}</span>;
}

const rowKey = (table: TableName, row: Row) => JSON.stringify(primaryKeyOf(table).map((k) => row[k]));
const pkKey = (table: TableName, pk: Record<string, Json>) => JSON.stringify(primaryKeyOf(table).map((k) => pk[k]));

/**
 * PostgreSQL Mock 테이블 뷰어. 행 데이터는 엔진 MockDatabase 스냅샷에서만 읽는다.
 * 최근 CRUD는 행 왼쪽 표시와 변경 셀 강조로 보여 주고(색 + 텍스트 라벨), 일정 시간 후 강조가 사라진다.
 * 삭제된 행은 잠시 취소선 행으로 남긴다. 이력은 아래 CRUD 이력에 계속 남는다.
 */
export function DbExplorer() {
  const tables = useWorld((w) => w.tables);
  const changes = useWorld((w) => w.dbChanges);
  const focus = useEditorStore((s) => s.monitorFocus);
  const [selected, setSelected] = useState<TableName>('block_live_state');
  const def = TABLES.find((t) => t.name === selected)!;
  const rows = tables[selected];
  const fresh = useFreshChanges(changes);

  useEffect(() => {
    if (!focus) return;
    const table = focus.table ?? changes.find((c) => c.changeId === focus.changeId || c.txId === focus.txId)?.table;
    if (table) setSelected(table);
  }, [focus]);

  // 테이블별 최근 변경 (강조 중인 것만)
  const freshByTable = new Map<TableName, number>();
  const rowMarks = new Map<string, CrudChange>();
  const ghosts: CrudChange[] = [];
  for (const c of changes) {
    if (!fresh.has(c.changeId)) continue;
    freshByTable.set(c.table, (freshByTable.get(c.table) ?? 0) + 1);
    if (c.table !== selected) continue;
    if (c.op === 'DELETE') ghosts.push(c);
    else rowMarks.set(pkKey(c.table, c.pk), c);
  }
  // 삭제 후 같은 키로 다시 INSERT된 행은 유령 행으로 표시하지 않는다
  const liveKeys = new Set(rows.map((r) => rowKey(selected, r)));
  const ghostRows = ghosts.filter((g) => !liveKeys.has(pkKey(g.table, g.pk)));

  return (
    <div className={styles.explorerWrap}>
      <div className={styles.explorer}>
        <nav className={styles.tableList} aria-label="PostgreSQL 테이블">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <div className={styles.groupLabel}>{g.label}</div>
              {TABLES.filter((t) => t.group === g.key).map((t) => (
                <button
                  key={t.name}
                  type="button"
                  className={styles.tableItem}
                  aria-selected={t.name === selected}
                  data-fresh={freshByTable.has(t.name)}
                  onClick={() => setSelected(t.name)}
                  title={freshByTable.has(t.name) ? `최근 변경 ${freshByTable.get(t.name)}건` : undefined}
                >
                  <span>{t.name}</span>
                  <span className={styles.rowCount} data-zero={tables[t.name].length === 0}>
                    {tables[t.name].length}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.tableView}>
          <div className={styles.tableHead}>
            <span className={styles.tableName}>{def.name}</span>
            <span className={styles.tableDesc}>{def.description}</span>
            <span className={styles.tableStat}>
              {rows.length} rows · {def.columns.length} cols
            </span>
          </div>
          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.markCol} aria-label="변경" />
                  {def.columns.map((c) => (
                    <th key={c.name} title={c.fk ? `FK → ${c.fk.table}.${c.fk.column}` : c.extension}>
                      <div className={styles.colName}>
                        {c.pk && (
                          <span className={styles.keyBadge} data-key="pk">
                            PK
                          </span>
                        )}
                        {c.fk && (
                          <span className={styles.keyBadge} data-key="fk">
                            FK
                          </span>
                        )}
                        {c.name}
                        {c.extension && (
                          <span className={styles.keyBadge} data-key="ext">
                            v1.1
                          </span>
                        )}
                      </div>
                      <div className={styles.colType}>
                        {c.type}
                        {c.nullable ? ' · null' : ''}
                        {c.fk ? ` → ${c.fk.table}` : ''}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = rowKey(selected, row);
                  const mark = rowMarks.get(key);
                  const changed = new Set(mark?.op === 'UPDATE' ? mark.changedColumns : mark ? def.columns.map((c) => c.name) : []);
                  return (
                    <tr key={key} data-op={mark?.op} className={mark ? styles.markedRow : undefined}>
                      <td className={styles.markCol}>{mark && <OpBadge key={mark.changeId} op={mark.op} />}</td>
                      {def.columns.map((c) => (
                        <td
                          key={c.name}
                          data-changed={changed.has(c.name) || undefined}
                          title={changed.has(c.name) && mark?.before ? `이전 값: ${JSON.stringify(mark.before[c.name])}` : undefined}
                        >
                          <Cell col={c} value={row[c.name]} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {ghostRows.map((g) => (
                  <tr key={g.changeId} data-op="DELETE" className={`${styles.markedRow} ${styles.ghostRow}`}>
                    <td className={styles.markCol}>
                      <OpBadge op="DELETE" />
                    </td>
                    {def.columns.map((c) => (
                      <td key={c.name}>
                        <Cell col={c} value={g.before?.[c.name]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && ghostRows.length === 0 && <div className={styles.emptyRows}>0 rows</div>}
          </div>
        </div>
      </div>
      <CrudHistory table={selected} fresh={fresh} />
    </div>
  );
}
