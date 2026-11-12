import { TABLE_NAMES } from './db/schema';
import { simTimestamp } from './simTime';
import type { Tables } from './types';

/**
 * 초기 시드 데이터 (SIMULATION_SCENARIOS.md §1, v1.1).
 * 호출할 때마다 새 객체를 반환하므로 초기화 시 그대로 재사용할 수 있다.
 */
export function createSeedTables(): Tables {
  const t0 = simTimestamp(0);
  const tables = Object.fromEntries(TABLE_NAMES.map((n) => [n, []])) as unknown as Tables;

  const textStyle = { fontSize: 16, color: '#000000' };
  const e001Props = { position: { x: 100, y: 100 }, size: { width: 300, height: 100 } };

  tables.block.push({
    id: 'B001',
    workspace_id: 'W001',
    kind: 'text',
    current_version_id: 'BV001',
    created_by: 'U001',
    created_at: t0,
  });
  tables.block_version.push({
    id: 'BV001',
    block_id: 'B001',
    version: 1,
    changed_by: 'U001',
    changed_at: t0,
  });
  tables.block_text.push({ id: 'BV001', body: '안녕하세요', style: { ...textStyle } });
  tables.block_live_state.push({
    block_id: 'B001',
    base_block_version_id: 'BV001',
    content: { body: '안녕하세요', style: { ...textStyle } },
    revision: 0,
    persisted_revision: 0,
    updated_by: null,
    updated_at: t0,
    persisted_at: t0,
  });

  tables.template.push({
    id: 'T001',
    workspace_id: 'W001',
    name: '자기소개 템플릿',
    current_version_id: 'TV001',
    created_by: 'U001',
    created_at: t0,
  });
  tables.template_version.push({
    id: 'TV001',
    template_id: 'T001',
    version: 1,
    created_by: 'U001',
    created_at: t0,
    restored_from_version_id: null,
  });
  tables.template_element.push({
    id: 'E001',
    template_id: 'T001',
    block_id: 'B001',
    created_at: t0,
    deleted_at: null,
  });
  tables.template_version_element.push({
    id: 'TVE001',
    template_version_id: 'TV001',
    template_element_id: 'E001',
    block_version_id: 'BV001',
    sequence: 1,
    render_zone: 'main',
    props: structuredClone(e001Props),
  });
  tables.template_live_state.push({
    template_id: 'T001',
    revision: 0,
    persisted_revision: 0,
    updated_by: null,
    updated_at: t0,
    persisted_at: t0,
  });
  tables.template_live_element.push({
    template_id: 'T001',
    template_element_id: 'E001',
    block_id: 'B001',
    sequence: 1,
    render_zone: 'main',
    props: structuredClone(e001Props),
    updated_at: t0,
  });

  return tables;
}
