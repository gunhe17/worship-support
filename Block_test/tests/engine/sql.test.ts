import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { applyUpdateSemantics, diffChange, sqlLiteral, toSql, txSql } from '../../src/engine/db/sql';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';

/** Phase 4: CRUD 변경 전후 비교와 SQL 미리보기 (CLAUDE_PROMPT §5, §10) */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const at = (ms: number) => engine.advanceBy(ms - world().now);
const edit = (actor: string, propertyPath: string, value: string | number) =>
  port.dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath, value } as EditorIntent);
const changesOf = (txId: string) => world().dbChanges.filter((c) => c.txId === txId);

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
});

describe('변경 전후 비교', () => {
  it('jsonb 컬럼은 바뀐 내부 경로만 비교 행으로 나온다 (시나리오 C 변형 1100ms의 color flush)', () => {
    edit('U001', 'style.fontSize', 20);
    at(100);
    edit('U002', 'style.color', '#ff0000');
    at(500);
    edit('U001', 'style.fontSize', 24);
    at(1130);
    const flush = world().dbChanges.find((c) => c.table === 'block_live_state')!;
    expect(diffChange(flush)).toEqual([
      { column: 'content', path: 'style.color', before: '#000000', after: '#ff0000' },
      { column: 'revision', path: null, before: 0, after: 3 },
      { column: 'updated_by', path: null, before: null, after: 'U002' },
      { column: 'updated_at', path: null, before: '2026-01-01 14:00:00.000', after: '2026-01-01 14:00:00.130' },
      { column: 'persisted_at', path: null, before: '2026-01-01 14:00:00.000', after: '2026-01-01 14:00:01.130' },
    ]);
    // persisted_revision은 0 → 0이라 변경 컬럼이 아니다 (미저장 rev 1 남음)
    expect(flush.changedColumns).not.toContain('persisted_revision');
  });

  it('INSERT는 변경 후 값만, DELETE는 변경 전 값만 가진다', () => {
    port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'image' });
    at(20);
    const insert = world().dbChanges.find((c) => c.op === 'INSERT' && c.table === 'block')!;
    expect(diffChange(insert).find((d) => d.column === 'current_version_id')).toEqual({ column: 'current_version_id', path: null, before: undefined, after: null });
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E002' });
    engine.runUntilIdle();
    const del = world().dbChanges.find((c) => c.op === 'DELETE')!;
    expect(diffChange(del).every((d) => d.after === undefined && d.before !== undefined)).toBe(true);
  });
});

describe('SQL 미리보기', () => {
  it('속성별 flush는 jsonb_set으로 해당 경로만 갱신하는 UPDATE가 된다 (다른 속성의 미저장 값 미포함)', () => {
    edit('U001', 'style.fontSize', 20);
    at(100);
    edit('U002', 'style.color', '#ff0000');
    at(500);
    edit('U001', 'style.fontSize', 24);
    at(1130);
    const flush = world().dbChanges.find((c) => c.table === 'block_live_state')!;
    expect(toSql(flush)).toBe(
      [
        'UPDATE block_live_state',
        'SET',
        `    content = jsonb_set(content, '{style,color}', '"#ff0000"'::jsonb),`,
        '    revision = 3,',
        `    updated_by = 'U002',`,
        `    updated_at = '2026-01-01 14:00:00.130',`,
        `    persisted_at = '2026-01-01 14:00:01.130'`,
        `WHERE block_id = 'B001';`,
      ].join('\n'),
    );
    expect(toSql(flush)).not.toContain('fontSize');
  });

  it('property_state 첫 저장은 INSERT, 이후 저장은 UPDATE (복합 PK WHERE)', () => {
    edit('U001', 'content', 'A');
    at(1100);
    edit('U001', 'content', 'B');
    at(2200);
    const states = world().dbChanges.filter((c) => c.table === 'block_property_state');
    expect(toSql(states[0])).toBe(
      `INSERT INTO block_property_state (block_id, property_path, revision, persisted_revision, last_fencing_token, updated_at)\nVALUES ('B001', 'content', 1, 1, 1, '2026-01-01 14:00:00.030');`,
    );
    expect(toSql(states[1])).toContain(`WHERE block_id = 'B001' AND property_path = 'content';`);
  });

  it('구조 변경 트랜잭션은 BEGIN … COMMIT 안에 INSERT/UPDATE가 순서대로 나온다', () => {
    port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'image' });
    at(20);
    const tx = world().dbTransactions.at(-1)!;
    const sql = txSql(tx, changesOf(tx.txId));
    expect(sql.split('\n')[1]).toBe('BEGIN;');
    expect(sql.match(/^(INSERT INTO|UPDATE) \w+/gm)).toEqual([
      'INSERT INTO block',
      'INSERT INTO block_live_state',
      'INSERT INTO template_element',
      'INSERT INTO template_live_element',
      'UPDATE template_live_state',
    ]);
    expect(sql).toContain(`'{"file_url":null,"alt_text":"","width":300,"height":200}'::jsonb`);
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
  });

  it('요소 삭제는 DELETE와 deleted_at UPDATE', () => {
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    at(20);
    const tx = world().dbTransactions.at(-1)!;
    const sql = txSql(tx, changesOf(tx.txId));
    expect(sql).toContain(`DELETE FROM template_live_element\nWHERE template_id = 'T001' AND template_element_id = 'E001';`);
    expect(sql).toContain(`UPDATE template_element\nSET\n    deleted_at = '2026-01-01 14:00:00.010'\nWHERE id = 'E001';`);
  });

  it('롤백된 트랜잭션은 시도한 문장과 ROLLBACK을 보여 준다', () => {
    engine.internals.db.failNextWrites(1);
    edit('U001', 'content', '실패 테스트');
    at(1100);
    const tx = world().dbTransactions.at(-1)!;
    expect(tx.status).toBe('ROLLED_BACK');
    const sql = txSql(tx, []);
    expect(sql).toContain('UPDATE block_live_state');
    expect(sql).toContain('-- 오류: connection reset (mock)');
    expect(sql.trim().endsWith('ROLLBACK;')).toBe(true);
    expect(world().tables.block_live_state[0].revision).toBe(0);
  });

  it('문자열 리터럴의 작은따옴표를 이스케이프한다', () => {
    expect(sqlLiteral("It's")).toBe("'It''s'");
    expect(sqlLiteral({ body: "a'b" }, { name: 'content', type: 'jsonb' })).toBe(`'{"body":"a''b"}'::jsonb`);
    expect(sqlLiteral(null)).toBe('NULL');
  });
});

describe('SQL 설명과 Mock 상태의 일치', () => {
  it('모든 UPDATE의 SQL 의미를 변경 전 행에 적용하면 기록된 변경 후 행과 같다', () => {
    edit('U001', 'content', '안녕하세요!');
    edit('U001', 'style.fontSize', 24);
    at(100);
    edit('U002', 'style.color', '#123456');
    port.dispatch('U003', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 220, 'size.width': 360 } });
    port.dispatch('U004', { type: 'addElement', templateId: 'T001', kind: 'list' });
    engine.runUntilIdle();
    port.dispatch('U004', { type: 'reorderElement', templateId: 'T001', elementId: 'E002', toIndex: 0 });
    port.dispatch('U001', { type: 'undo' });
    engine.runUntilIdle();
    const updates = world().dbChanges.filter((c) => c.op === 'UPDATE');
    expect(updates.length).toBeGreaterThan(8);
    for (const u of updates) expect(applyUpdateSemantics(u), `${u.changeId} ${u.table}`).toEqual(u.after);
    // SQL 문자열이 모든 변경에 대해 생성된다
    for (const c of world().dbChanges) expect(toSql(c).length).toBeGreaterThan(10);
  });
});
