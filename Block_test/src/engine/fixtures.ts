import type { MockDatabase } from './db/mockDatabase';
import type { EventLogger } from './logger';
import type { MockRedis } from './redis/mockRedis';
import { bootstrapTemplateLive } from './server/liveState';
import { simTimestamp } from './simTime';
import type { Row, TableName } from './types';

/**
 * 시나리오 FIXTURE (SIMULATION_SCENARIOS §1.1).
 * precondition은 원칙적으로 명령을 실제로 실행해 만들지만, 시나리오 K의 두 번째 템플릿은 예외로 초기 데이터 추가로 만든다.
 */
export function scenarioKFixture(): { table: TableName; row: Row }[] {
  const t0 = simTimestamp(0);
  const props = { position: { x: 40, y: 40 }, size: { width: 200, height: 80 } };
  return [
    { table: 'template', row: { id: 'T002', workspace_id: 'W001', name: '경력 템플릿', current_version_id: 'TV101', created_by: 'U001', created_at: t0 } },
    { table: 'template_version', row: { id: 'TV101', template_id: 'T002', version: 1, created_by: 'U001', created_at: t0, restored_from_version_id: null } },
    { table: 'template_element', row: { id: 'E101', template_id: 'T002', block_id: 'B001', created_at: t0, deleted_at: null } },
    {
      table: 'template_version_element',
      row: { id: 'TVE101', template_version_id: 'TV101', template_element_id: 'E101', block_version_id: 'BV001', sequence: 1, render_zone: 'main', props },
    },
    { table: 'template_live_state', row: { template_id: 'T002', revision: 0, persisted_revision: 0, updated_by: null, updated_at: t0, persisted_at: t0 } },
    {
      table: 'template_live_element',
      row: { template_id: 'T002', template_element_id: 'E101', block_id: 'B001', sequence: 1, render_zone: 'main', props: structuredClone(props), updated_at: t0 },
    },
  ];
}

export type FixtureName = 'K';
/** Fixture 생성 주체: 실행 중 Console 버튼 또는 시나리오 실행기 초기화 (Phase 6) */
export type FixtureSource = 'SimulationConsole' | 'ScenarioRunner';

const FIXTURES: Record<FixtureName, { description: string; rows: () => { table: TableName; row: Row }[]; templates: string[] }> = {
  K: { description: '시나리오 K: T002(경력 템플릿) · TV101 · E101(B001 공유) · TVE101', rows: scenarioKFixture, templates: ['T002'] },
};

const pkValue = (row: Row) => String(row.id ?? `${String(row.template_id)}/${String(row.template_element_id ?? '')}`);

/**
 * Fixture 생성 (두 경로가 같은 로직을 사용한다): 하나의 트랜잭션으로 MockDatabase에 INSERT하고
 * Redis live:template을 만들고 FIXTURE 이벤트를 기록한다. 사용자 편집 이벤트와 구분된다 (actor 없음, category system).
 * - bootstrapLive=false: 엔진 초기화 중 (이후 전체 live 부트스트랩이 처리)
 */
export function applyFixture(
  deps: { db: MockDatabase; redis: MockRedis; logger: EventLogger },
  name: FixtureName,
  source: FixtureSource,
  opts: { bootstrapLive: boolean },
): { ok: boolean; reason?: string } {
  const def = FIXTURES[name];
  const rows = def.rows();
  const targets = rows.map((r) => ({ table: r.table, id: pkValue(r.row) }));
  const exists = def.templates.some((t) => deps.db.get('template', { id: t }));
  const tx = exists
    ? null
    : deps.db.transaction({ label: `FIXTURE ${name} (${source})`, kind: 'fixture' }, (t) => {
        for (const r of rows) t.insert(r.table, r.row);
      });
  const ok = !!tx?.ok;
  if (ok && opts.bootstrapLive) for (const t of def.templates) bootstrapTemplateLive(deps.db, deps.redis, t);
  deps.logger.log({
    name: 'FIXTURE',
    category: 'system',
    from: 'PG',
    to: ['REDIS'],
    target: def.templates.map((t) => `template:${t}`).join(','),
    payload: {
      fixture: name,
      createdBy: source,
      dataKind: 'scenario-fixture',
      description: def.description,
      targets,
      txId: tx?.txId ?? null,
      ...(exists ? { reason: 'ALREADY_EXISTS' } : tx && !tx.ok ? { error: tx.error } : {}),
    },
    result: ok ? 'OK' : exists ? 'INFO' : 'FAILED',
    resultDetail: ok ? `${def.description} · ${source}` : exists ? '이미 존재 · 생성 안 함' : `ROLLBACK · ${tx!.ok ? '' : tx!.error}`,
  });
  return ok ? { ok } : { ok, reason: exists ? 'ALREADY_EXISTS' : 'DB_WRITE_FAILED' };
}
