import { describe, expect, it } from 'vitest';
import { getTableDef, primaryKeyOf, TABLES } from '../../src/engine/db/schema';
import { createSeedTables } from '../../src/engine/seed';
import type { TableName } from '../../src/engine/types';
import { SIM_USERS } from '../../src/engine/users';

describe('schema', () => {
  it('21개 테이블을 정의한다 (CLAUDE_PROMPT §4.B)', () => {
    expect(TABLES).toHaveLength(21);
  });

  it('복합 PK를 문서대로 정의한다', () => {
    expect(primaryKeyOf('block_property_state')).toEqual(['block_id', 'property_path']);
    expect(primaryKeyOf('template_element_property_state')).toEqual([
      'template_id',
      'template_element_id',
      'property_path',
    ]);
  });

  it('block_text.style은 v1.1 확장 컬럼으로 표시된다', () => {
    const style = getTableDef('block_text').columns.find((c) => c.name === 'style');
    expect(style?.type).toBe('jsonb');
    expect(style?.extension).toBeTruthy();
  });
});

describe('seed', () => {
  const tables = createSeedTables();

  it('SIMULATION_SCENARIOS §1의 초기 데이터를 생성한다', () => {
    expect(tables.block).toEqual([expect.objectContaining({ id: 'B001', kind: 'text', current_version_id: 'BV001' })]);
    expect(tables.block_text).toEqual([
      { id: 'BV001', body: '안녕하세요', style: { fontSize: 16, color: '#000000' } },
    ]);
    expect(tables.block_live_state[0]).toMatchObject({ revision: 0, persisted_revision: 0, base_block_version_id: 'BV001' });
    expect(tables.template_version_element).toEqual([
      expect.objectContaining({ id: 'TVE001', template_version_id: 'TV001', block_version_id: 'BV001' }),
    ]);
    expect(tables.template_live_state).toEqual([expect.objectContaining({ template_id: 'T001', revision: 0 })]);
    expect(tables.template_live_element[0].props).toEqual({
      position: { x: 100, y: 100 },
      size: { width: 300, height: 100 },
    });
    expect(tables.block_property_state).toHaveLength(0);
    expect(tables.template_element_property_state).toHaveLength(0);
  });

  it('모든 FK가 존재하는 행을 참조한다', () => {
    for (const def of TABLES) {
      for (const col of def.columns.filter((c) => c.fk)) {
        for (const row of tables[def.name]) {
          const value = row[col.name];
          if (value === null) {
            expect(col.nullable, `${def.name}.${col.name} null`).toBe(true);
            continue;
          }
          const ref = tables[col.fk!.table as TableName].some((r) => r[col.fk!.column] === value);
          expect(ref, `${def.name}.${col.name}=${String(value)}`).toBe(true);
        }
      }
    }
  });

  it('호출마다 독립된 객체를 반환한다 (초기화 재사용)', () => {
    const a = createSeedTables();
    (a.block_live_state[0].content as { body: string }).body = 'changed';
    expect((createSeedTables().block_live_state[0].content as { body: string }).body).toBe('안녕하세요');
  });

  it('사용자 4명을 정의한다 (v1.2)', () => {
    expect(SIM_USERS.map((u) => [u.userId, u.name])).toEqual([
      ['U001', '사용자 1'],
      ['U002', '사용자 2'],
      ['U003', '사용자 3'],
      ['U004', '사용자 4'],
    ]);
  });
});
