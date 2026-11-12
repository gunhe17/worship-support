import type { VirtualClock } from '../clock';
import type { IdGenerator } from '../ids';
import type { Json, Row, TableName, Tables, UserId } from '../types';
import { getTableDef, primaryKeyOf, TABLE_NAMES, TABLES, type ColumnDef } from './schema';

/**
 * MockDatabase: PostgreSQL을 흉내 내는 테이블 저장소 (DB_SCHEMA §6, CLAUDE_PROMPT §6).
 * - 테이블은 JSON 행 배열이며 copy-on-write로 갱신한다 (변경되지 않은 테이블은 참조 유지).
 * - 모든 쓰기는 transaction 안에서만 일어나고, 실패하면 전체 롤백한다 (§7.9).
 * - 컬럼, NOT NULL, 타입, PK는 즉시 검사하고 FK는 커밋 시점에 검사한다 (block ↔ block_version 순환 참조 대응).
 * - 모든 CRUD는 변경 전·후 행과 함께 기록한다 (Phase 4 시각화의 원천).
 */

export type CrudOp = 'INSERT' | 'UPDATE' | 'DELETE';
export type PrimaryKey = Record<string, Json>;

export interface CrudChange {
  changeId: string;
  txId: string;
  op: CrudOp;
  table: TableName;
  pk: PrimaryKey;
  before: Row | null;
  after: Row | null;
  /** UPDATE에서 값이 달라진 컬럼 (INSERT/DELETE는 전체 컬럼) */
  changedColumns: string[];
  at: number;
  requestId: string | null;
  actorUserId: UserId | null;
}

export interface TxRecord {
  txId: string;
  label: string;
  status: 'COMMITTED' | 'ROLLED_BACK';
  error: string | null;
  at: number;
  requestId: string | null;
  actorUserId: UserId | null;
  /** 커밋된 변경 (롤백 시 시도했던 변경 수만 남긴다) */
  changeIds: string[];
  attemptedChanges: number;
  kind: TxKind;
  /** 실패 주입으로 실패한 트랜잭션인가 */
  injected: boolean;
  /** 롤백된 트랜잭션이 시도했던 변경 (적용되지 않음, SQL 미리보기용) */
  attempted?: CrudDraft[];
}

export type CrudDraft = Omit<CrudChange, 'changeId' | 'txId' | 'at' | 'requestId' | 'actorUserId'>;

/** 트랜잭션 종류 (실패 주입 대상 선택용) */
export type TxKind = 'debounce' | 'version' | 'structure' | 'fixture' | 'other';
/** 실패 주입 대상: any는 fixture를 제외한 모든 쓰기 트랜잭션 */
export type InjectionScope = 'any' | 'debounce' | 'version' | 'structure';

export interface FailureInjection {
  /** 남은 실패 횟수 */
  remaining: number;
  /** 설정한 실패 횟수 */
  configured: number;
  /** 실제로 실패시킨 트랜잭션 수 (이번 설정 이후) */
  triggered: number;
  scope: InjectionScope;
  error: string;
}

export interface TxContext {
  label: string;
  kind?: TxKind;
  requestId?: string | null;
  actorUserId?: UserId | null;
}

export type TxResult<T> =
  | { ok: true; txId: string; value: T; changes: CrudChange[] }
  | { ok: false; txId: string; error: string; /** DbError 코드 (없으면 일반 오류) */ errorCode: DbError['code'] | null };

export class DbError extends Error {
  constructor(
    readonly code:
      | 'UNKNOWN_COLUMN'
      | 'NOT_NULL'
      | 'TYPE'
      | 'DUPLICATE_KEY'
      | 'NOT_FOUND'
      | 'FK_VIOLATION'
      | 'WRITE_FAILED'
      /** 저장하려는 값이 이미 저장된 값보다 오래됨 (재시도해도 해결되지 않음) */
      | 'STALE_REVISION'
      | 'FENCING_TOKEN_STALE',
    message: string,
  ) {
    super(message);
  }
}

const pkOf = (table: TableName, row: Row): PrimaryKey =>
  Object.fromEntries(primaryKeyOf(table).map((k) => [k, row[k]]));

const matchesPk = (row: Row, pk: PrimaryKey) => Object.entries(pk).every(([k, v]) => row[k] === v);

export const formatPk = (pk: PrimaryKey) =>
  Object.entries(pk)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(', ');

const isJsonEqual = (a: Json | undefined, b: Json | undefined) => JSON.stringify(a) === JSON.stringify(b);

function checkType(table: TableName, col: ColumnDef, value: Json | undefined): void {
  if (value === undefined || value === null) {
    if (!col.nullable) throw new DbError('NOT_NULL', `${table}.${col.name}: NOT NULL 위반`);
    return;
  }
  const ok =
    col.type === 'jsonb' ||
    ((col.type === 'text' || col.type === 'timestamptz') && typeof value === 'string') ||
    ((col.type === 'integer' || col.type === 'bigint') && Number.isInteger(value));
  if (!ok) throw new DbError('TYPE', `${table}.${col.name}: ${col.type} 타입이 아닌 값 ${JSON.stringify(value)}`);
}

function validateRow(table: TableName, row: Row): void {
  const def = getTableDef(table);
  for (const key of Object.keys(row)) {
    if (!def.columns.some((c) => c.name === key)) throw new DbError('UNKNOWN_COLUMN', `${table}.${key}: 존재하지 않는 컬럼`);
  }
  for (const col of def.columns) checkType(table, col, row[col.name]);
}

export class Transaction {
  readonly changes: Omit<CrudChange, 'changeId' | 'txId' | 'at' | 'requestId' | 'actorUserId'>[] = [];

  constructor(private working: Tables) {}

  get tables(): Tables {
    return this.working;
  }

  select(table: TableName, where?: Partial<Row> | ((row: Row) => boolean)): Row[] {
    return selectRows(this.working, table, where);
  }

  get(table: TableName, pk: PrimaryKey): Row | undefined {
    return this.working[table].find((r) => matchesPk(r, pk));
  }

  insert(table: TableName, row: Row): Row {
    const full: Row = Object.fromEntries(getTableDef(table).columns.map((c) => [c.name, row[c.name] ?? null]));
    for (const key of Object.keys(row)) if (!(key in full)) full[key] = row[key];
    validateRow(table, full);
    const pk = pkOf(table, full);
    if (this.get(table, pk)) throw new DbError('DUPLICATE_KEY', `${table}: 중복 키 (${formatPk(pk)})`);
    const stored = structuredClone(full);
    this.working = { ...this.working, [table]: [...this.working[table], stored] };
    this.changes.push({ op: 'INSERT', table, pk, before: null, after: stored, changedColumns: Object.keys(stored) });
    return stored;
  }

  /** 지정한 컬럼만 교체한다. jsonb 컬럼은 통째로 교체되므로 경로 병합은 호출자가 수행한다. */
  update(table: TableName, pk: PrimaryKey, patch: Row): Row {
    const rows = this.working[table];
    const index = rows.findIndex((r) => matchesPk(r, pk));
    if (index < 0) throw new DbError('NOT_FOUND', `${table}: 행 없음 (${formatPk(pk)})`);
    const before = rows[index];
    const after: Row = { ...before, ...structuredClone(patch) };
    validateRow(table, after);
    if (!isJsonEqual(pkOf(table, after) as Json, pk as Json))
      throw new DbError('TYPE', `${table}: PK 컬럼은 변경할 수 없습니다`);
    const changedColumns = Object.keys(patch).filter((k) => !isJsonEqual(before[k], after[k]));
    const next = [...rows];
    next[index] = after;
    this.working = { ...this.working, [table]: next };
    this.changes.push({ op: 'UPDATE', table, pk, before, after, changedColumns });
    return after;
  }

  delete(table: TableName, pk: PrimaryKey): Row {
    const rows = this.working[table];
    const before = rows.find((r) => matchesPk(r, pk));
    if (!before) throw new DbError('NOT_FOUND', `${table}: 행 없음 (${formatPk(pk)})`);
    this.working = { ...this.working, [table]: rows.filter((r) => r !== before) };
    this.changes.push({ op: 'DELETE', table, pk, before, after: null, changedColumns: Object.keys(before) });
    return before;
  }
}

function selectRows(tables: Tables, table: TableName, where?: Partial<Row> | ((row: Row) => boolean)): Row[] {
  const rows = tables[table];
  if (!where) return rows;
  if (typeof where === 'function') return rows.filter(where);
  return rows.filter((r) => Object.entries(where).every(([k, v]) => isJsonEqual(r[k], v as Json)));
}

/** 커밋 시점 FK 검사: 변경된 행의 참조 대상 존재 여부 + 삭제된 행을 참조하는 행 존재 여부 */
function checkForeignKeys(tables: Tables, changes: Transaction['changes']): void {
  for (const ch of changes) {
    if (ch.after) {
      for (const col of getTableDef(ch.table).columns) {
        const v = ch.after[col.name];
        if (!col.fk || v === null || v === undefined) continue;
        if (!tables[col.fk.table].some((r) => r[col.fk!.column] === v))
          throw new DbError('FK_VIOLATION', `${ch.table}.${col.name}=${String(v)}: ${col.fk.table}.${col.fk.column}에 없음`);
      }
    }
    if (ch.op === 'DELETE' && ch.before) {
      for (const def of TABLES) {
        for (const col of def.columns) {
          if (col.fk?.table !== ch.table) continue;
          const v = ch.before[col.fk.column];
          if (tables[def.name].some((r) => r[col.name] === v))
            throw new DbError('FK_VIOLATION', `${ch.table}(${String(v)})를 ${def.name}.${col.name}가 참조 중`);
        }
      }
    }
  }
}

export class MockDatabase {
  private _tables: Tables;
  private _changes: CrudChange[] = [];
  private _transactions: TxRecord[] = [];
  private _injection: FailureInjection = { remaining: 0, configured: 0, triggered: 0, scope: 'any', error: 'connection reset (mock)' };
  version = 0;

  constructor(
    private clock: VirtualClock,
    private ids: IdGenerator,
    seed: Tables,
  ) {
    this._tables = Object.fromEntries(TABLE_NAMES.map((n) => [n, structuredClone(seed[n] ?? [])])) as unknown as Tables;
  }

  get tables(): Tables {
    return this._tables;
  }
  get changes(): readonly CrudChange[] {
    return this._changes;
  }
  get transactions(): readonly TxRecord[] {
    return this._transactions;
  }
  /** 남은 실패 주입 횟수 */
  get injectedFailures(): number {
    return this._injection.remaining;
  }

  get injection(): FailureInjection {
    return this._injection;
  }

  /**
   * 다음 n회의 쓰기 트랜잭션을 실패시킨다 (시나리오 L, Simulation Console 실패 주입).
   * scope로 대상 트랜잭션 종류를 지정한다. n = 0이면 비활성화. Fixture 트랜잭션은 대상이 아니다.
   */
  failNextWrites(n: number, opts: string | { error?: string; scope?: InjectionScope } = {}): void {
    const o = typeof opts === 'string' ? { error: opts } : opts;
    const count = Math.max(0, Math.floor(n));
    this._injection = { remaining: count, configured: count, triggered: 0, scope: o.scope ?? 'any', error: o.error ?? 'connection reset (mock)' };
    this.version++;
  }

  private injectionApplies(kind: TxKind): boolean {
    const inj = this._injection;
    if (inj.remaining <= 0 || kind === 'fixture') return false;
    return inj.scope === 'any' || inj.scope === kind;
  }

  select(table: TableName, where?: Partial<Row> | ((row: Row) => boolean)): Row[] {
    return selectRows(this._tables, table, where);
  }

  get(table: TableName, pk: PrimaryKey): Row | undefined {
    return this._tables[table].find((r) => matchesPk(r, pk));
  }

  /**
   * 트랜잭션 실행. fn이 예외를 던지거나 실패가 주입되어 있으면 롤백한다.
   * 쓰기가 없는 트랜잭션은 실패 주입 횟수를 소비하지 않는다.
   */
  transaction<T>(ctx: TxContext, fn: (tx: Transaction) => T): TxResult<T> {
    const txId = this.ids.next('TX');
    const tx = new Transaction(this._tables);
    const kind: TxKind = ctx.kind ?? 'other';
    const base = { txId, label: ctx.label, kind, at: this.clock.now, requestId: ctx.requestId ?? null, actorUserId: ctx.actorUserId ?? null };
    let injected = false;
    try {
      const value = fn(tx);
      if (tx.changes.length > 0 && this.injectionApplies(kind)) {
        this._injection = { ...this._injection, remaining: this._injection.remaining - 1, triggered: this._injection.triggered + 1 };
        injected = true;
        throw new DbError('WRITE_FAILED', this._injection.error);
      }
      checkForeignKeys(tx.tables, tx.changes);
      const changes: CrudChange[] = tx.changes.map((c) => ({
        ...c,
        changeId: this.ids.next('CH', 4),
        txId,
        at: base.at,
        requestId: base.requestId,
        actorUserId: base.actorUserId,
      }));
      this._tables = tx.tables;
      this._changes = [...this._changes, ...changes];
      this._transactions = [
        ...this._transactions,
        { ...base, status: 'COMMITTED', error: null, changeIds: changes.map((c) => c.changeId), attemptedChanges: changes.length, injected: false },
      ];
      this.version++;
      return { ok: true, txId, value, changes };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this._transactions = [
        ...this._transactions,
        { ...base, status: 'ROLLED_BACK', error, changeIds: [], attemptedChanges: tx.changes.length, attempted: [...tx.changes], injected },
      ];
      this.version++;
      return { ok: false, txId, error, errorCode: err instanceof DbError ? err.code : null };
    }
  }

  /** 전체 FK 무결성 검사 (테스트용) */
  integrityErrors(): string[] {
    const errors: string[] = [];
    for (const def of TABLES) {
      for (const col of def.columns.filter((c) => c.fk)) {
        for (const row of this._tables[def.name]) {
          const v = row[col.name];
          if (v === null || v === undefined) continue;
          if (!this._tables[col.fk!.table].some((r) => r[col.fk!.column] === v))
            errors.push(`${def.name}.${col.name}=${String(v)}`);
        }
      }
    }
    return errors;
  }
}
