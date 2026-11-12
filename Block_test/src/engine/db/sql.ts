import type { Json, JsonObject, Row, TableName } from '../types';
import type { CrudDraft, TxRecord } from './mockDatabase';
import { getTableDef, primaryKeyOf, type ColumnDef } from './schema';

/**
 * CRUD 기록 → 변경 전후 비교와 SQL 미리보기 (CLAUDE_PROMPT §5, §10).
 * SQL은 실행하지 않는다. MockDatabase가 기록한 변경 전·후 행에서 생성하므로 화면 상태와 항상 일치한다.
 * - 시각은 NOW()가 아니라 시뮬레이션 시각 리터럴을 쓴다 (§7.10, Mock 상태와 정확히 일치)
 * - jsonb 컬럼의 일부 경로만 바뀐 UPDATE는 jsonb_set으로 표현한다 (속성별 Debounce 병합, §7.3)
 */

export interface FieldDiff {
  column: string;
  /** jsonb 내부 경로 (예: style.fontSize). 컬럼 전체 비교면 null */
  path: string | null;
  before: Json | undefined;
  after: Json | undefined;
}

const isObject = (v: Json | undefined): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** 두 jsonb 객체의 바뀐 말단 경로 (배열은 말단으로 취급) */
export function jsonLeafDiff(before: Json | undefined, after: Json | undefined, prefix: string[] = []): { path: string[]; before: Json | undefined; after: Json | undefined }[] {
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((k) => jsonLeafDiff(before[k], after[k], [...prefix, k]));
  }
  return same(before, after) ? [] : [{ path: prefix, before, after }];
}

const columnOf = (table: TableName, name: string): ColumnDef | undefined => getTableDef(table).columns.find((c) => c.name === name);

/** 변경 전·후 비교 행 */
export function diffChange(change: CrudDraft): FieldDiff[] {
  const cols = getTableDef(change.table).columns.map((c) => c.name);
  if (change.op === 'INSERT') return cols.map((column) => ({ column, path: null, before: undefined, after: change.after![column] }));
  if (change.op === 'DELETE') return cols.map((column) => ({ column, path: null, before: change.before![column], after: undefined }));
  return change.changedColumns.flatMap((column): FieldDiff[] => {
    const before = change.before![column];
    const after = change.after![column];
    if (columnOf(change.table, column)?.type === 'jsonb' && isObject(before) && isObject(after))
      return jsonLeafDiff(before, after).map((d) => ({ column, path: d.path.join('.'), before: d.before, after: d.after }));
    return [{ column, path: null, before, after }];
  });
}

/* ------------------------------------------------------------------ */
/* SQL                                                                 */
/* ------------------------------------------------------------------ */

const quote = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function sqlLiteral(value: Json | undefined, col?: ColumnDef): string {
  if (value === null || value === undefined) return 'NULL';
  if (col?.type === 'jsonb') return `${quote(JSON.stringify(value))}::jsonb`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return quote(value);
  return `${quote(JSON.stringify(value))}::jsonb`;
}

const whereOf = (table: TableName, pk: Row) =>
  primaryKeyOf(table)
    .map((k) => `${k} = ${sqlLiteral(pk[k], columnOf(table, k))}`)
    .join(' AND ');

/** jsonb 부분 갱신 식: 말단 경로가 적고 키 삭제가 없으면 jsonb_set 중첩, 아니면 전체 교체 */
function jsonbSetExpr(column: string, before: Json | undefined, after: Json | undefined, col: ColumnDef): string {
  if (isObject(before) && isObject(after)) {
    const leaves = jsonLeafDiff(before, after);
    if (leaves.length > 0 && leaves.length <= 3 && leaves.every((l) => l.after !== undefined && l.path.length > 0)) {
      return leaves.reduce(
        (expr, l) => `jsonb_set(${expr}, ${quote(`{${l.path.join(',')}}`)}, ${quote(JSON.stringify(l.after))}::jsonb)`,
        column,
      );
    }
  }
  return sqlLiteral(after, col);
}

export function toSql(change: CrudDraft): string {
  const def = getTableDef(change.table);
  if (change.op === 'INSERT') {
    const cols = def.columns.map((c) => c.name);
    const values = def.columns.map((c) => sqlLiteral(change.after![c.name], c));
    return `INSERT INTO ${change.table} (${cols.join(', ')})\nVALUES (${values.join(', ')});`;
  }
  if (change.op === 'DELETE') return `DELETE FROM ${change.table}\nWHERE ${whereOf(change.table, change.pk as Row)};`;
  const sets = change.changedColumns.map((name) => {
    const col = columnOf(change.table, name)!;
    const expr =
      col.type === 'jsonb' ? jsonbSetExpr(name, change.before![name], change.after![name], col) : sqlLiteral(change.after![name], col);
    return `    ${name} = ${expr}`;
  });
  if (sets.length === 0) return `-- ${change.table}: 값 변경 없음 (UPDATE 생략 가능)\nUPDATE ${change.table} SET ${primaryKeyOf(change.table)[0]} = ${primaryKeyOf(change.table)[0]}\nWHERE ${whereOf(change.table, change.pk as Row)};`;
  return `UPDATE ${change.table}\nSET\n${sets.join(',\n')}\nWHERE ${whereOf(change.table, change.pk as Row)};`;
}

/** 트랜잭션 전체 SQL. 롤백된 트랜잭션은 시도한 문장과 ROLLBACK을 표시한다 */
export function txSql(tx: TxRecord, changes: readonly CrudDraft[]): string {
  const body = (tx.status === 'COMMITTED' ? changes : (tx.attempted ?? [])).map(toSql);
  const head = `-- ${tx.txId} · ${tx.label}${tx.requestId ? ` · ${tx.requestId}` : ''}${tx.actorUserId ? ` · ${tx.actorUserId}` : ''}`;
  if (tx.status === 'COMMITTED') return [head, 'BEGIN;', ...body, 'COMMIT;'].join('\n');
  return [head, 'BEGIN;', ...body, `-- 오류: ${tx.error}`, 'ROLLBACK;'].join('\n');
}

/**
 * 검증용: UPDATE SQL의 의미(SET 컬럼 교체, jsonb_set 경로 갱신)를 변경 전 행에 적용한 결과.
 * 이 값이 기록된 변경 후 행과 같아야 SQL 설명과 Mock 상태가 일치한다.
 */
export function applyUpdateSemantics(change: CrudDraft): Row {
  const row: Row = { ...change.before! };
  for (const name of change.changedColumns) {
    const col = columnOf(change.table, name)!;
    const before = change.before![name];
    const after = change.after![name];
    const leaves = col.type === 'jsonb' && isObject(before) && isObject(after) ? jsonLeafDiff(before, after) : null;
    if (leaves && leaves.length > 0 && leaves.length <= 3 && leaves.every((l) => l.after !== undefined && l.path.length > 0)) {
      let value: Json = structuredClone(before as Json);
      for (const l of leaves) value = setPath(value as JsonObject, l.path, l.after!);
      row[name] = value;
    } else row[name] = structuredClone(after ?? null);
  }
  return row;
}

/** PostgreSQL jsonb_set(create_missing = true) 의미 */
function setPath(obj: JsonObject, path: string[], value: Json): JsonObject {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = obj[head];
  return { ...obj, [head]: setPath(isObject(child) ? child : {}, rest, value) };
}
