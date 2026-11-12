import type { WorldState } from '../engine/engine';
import type { Json, Row, TableName } from '../engine/types';
import type { ScenarioCheck, ScenarioDef, ScenarioStep } from './types';

/**
 * 시나리오 A~L (SIMULATION_SCENARIOS.md). 기대값은 문서의 "예상 결과"를 그대로 옮긴 것이다.
 * 시각(at)은 본 단계 시작 기준이며, 승인 시각은 네트워크 지연(10ms × 왕복)만큼 늦다.
 */

const T = 'T001';
const rows = (w: WorldState, t: TableName, where: Partial<Row> = {}) =>
  w.tables[t].filter((r) => Object.entries(where).every(([k, v]) => JSON.stringify(r[k]) === JSON.stringify(v)));
const one = (w: WorldState, t: TableName, where: Partial<Row> = {}) => rows(w, t, where)[0] ?? null;
const pick = (r: Row | null, keys: string[]): Json => (r ? Object.fromEntries(keys.map((k) => [k, r[k] ?? null])) : null);
const count = (w: WorldState, name: string) => w.events.filter((e) => e.name === name && e.section !== 'PRECONDITION').length;
const mainEvents = (w: WorldState, name: string) => w.events.filter((e) => e.name === name && e.section !== 'PRECONDITION');
const check = (label: string, expected: Json, actual: (w: WorldState) => Json): ScenarioCheck => ({ label, expected, actual });

const edit = (at: number, actor: string, propertyPath: string, value: Json, label: string, gestureId?: string): ScenarioStep => ({
  at,
  label,
  action: { kind: 'intent', actor, intent: { type: 'editProperty', blockId: 'B001', propertyPath, value, gestureId } },
});
const move = (at: number, actor: string, templateId: string, elementId: string, changes: Record<string, number>, label: string): ScenarioStep => ({
  at,
  label,
  action: { kind: 'intent', actor, intent: { type: 'editPlacement', templateId, elementId, changes } },
});
const endEdit = (at: number, actor: string): ScenarioStep => ({ at, label: `${actor} 편집 종료 (Lock 해제)`, action: { kind: 'intent', actor, intent: { type: 'endEdit' } } });
const save = (at: number, actor: string, label = `${actor} 저장 버튼`): ScenarioStep => ({ at, label, action: { kind: 'intent', actor, intent: { type: 'save', templateId: T } } });

/** precondition I: B + E + F (텍스트 "안녕하세요! 반갑습니다.", fontSize 24, y=300) */
const PRE_I: ScenarioStep[] = [
  edit(0, 'U001', 'content', '안녕하세요!', 'B: 입력 1', 'pre-b'),
  edit(300, 'U001', 'content', '안녕하세요! 반갑습니다.', 'B: 입력 2', 'pre-b'),
  edit(600, 'U001', 'style.fontSize', 24, 'E: fontSize 24'),
  move(900, 'U001', T, 'E001', { 'position.y': 300 }, 'F: E001 y 300'),
  endEdit(1000, 'U001'),
];
/** precondition J: I + 저장 (TV002) */
const PRE_J: ScenarioStep[] = [...PRE_I, save(1200, 'U001', 'I: 저장 → TV002')];

const liveState = ['revision', 'persisted_revision'];

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'A',
    title: '텍스트 속성 편집',
    summary: 'U001이 "안녕하세요"를 "안녕하세요! 반갑습니다."로 변경 → Lock · UPDATE · 전파 · Debounce 1초 · PostgreSQL 저장',
    steps: [edit(0, 'U001', 'content', '안녕하세요! 반갑습니다.', 'U001 텍스트 입력'), endEdit(100, 'U001')],
    verifyAt: 1500,
    checks: [
      check('block_live_state.content.body', '안녕하세요! 반갑습니다.', (w) => (one(w, 'block_live_state')?.content as { body: string }).body),
      check('block_live_state revision / persisted_revision', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'block_live_state'), liveState)),
      check('block_live_state.updated_by', 'U001', (w) => one(w, 'block_live_state')?.updated_by ?? null),
      check('block_property_state (content)', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'block_property_state', { property_path: 'content' }), liveState)),
      check('block_version 생성 없음', 1, (w) => w.tables.block_version.length),
      check('PROPERTY_PERSISTED 1회', 1, (w) => count(w, 'PROPERTY_PERSISTED')),
    ],
  },
  {
    id: 'B',
    title: '연속 입력과 Debounce',
    summary: '0 / 300 / 600ms 연속 입력 → 예약 갱신, 마지막 입력 1초 뒤 한 번만 저장',
    steps: [
      edit(0, 'U001', 'content', '안녕하세요!', 'U001 입력 1', 'b'),
      edit(300, 'U001', 'content', '안녕하세요! 반갑', 'U001 입력 2', 'b'),
      edit(600, 'U001', 'content', '안녕하세요! 반갑습니다.', 'U001 입력 3', 'b'),
      endEdit(700, 'U001'),
    ],
    verifyAt: 2000,
    checks: [
      check('입력(승인) 횟수', 3, (w) => mainEvents(w, 'PROPERTY_UPDATE_ACK').length),
      check('Debounce 예약 갱신 횟수', 3, (w) => count(w, 'DEBOUNCE_SCHEDULED')),
      check('PostgreSQL 저장 횟수', 1, (w) => count(w, 'DEBOUNCE_SAVE')),
      // 시각은 승인 기준 (v1.1): 각 예약은 승인 + 1000ms로 갱신되고, 저장은 마지막 승인 + 1000ms에 1회
      check('예약 시각 = 승인 + 1000ms (매 입력 갱신)', [1000, 1000, 1000], (w) =>
        mainEvents(w, 'DEBOUNCE_SCHEDULED').map((e) => (e.payload as { dueAt: number }).dueAt - e.timestamp),
      ),
      check('저장 시각 = 마지막 승인 + 1000ms', 1000, (w) => {
        const acks = mainEvents(w, 'PROPERTY_UPDATE_ACK');
        const saveAt = mainEvents(w, 'DEBOUNCE_SAVE')[0]?.timestamp ?? NaN;
        return saveAt - acks[acks.length - 1].timestamp;
      }),
      check('block_live_state', { revision: 3, persisted_revision: 3 }, (w) => pick(one(w, 'block_live_state'), liveState)),
      check('block_property_state (content)', { revision: 3, persisted_revision: 3 }, (w) => pick(one(w, 'block_property_state', { property_path: 'content' }), liveState)),
      check('block_version 생성 없음', 1, (w) => w.tables.block_version.length),
    ],
  },
  {
    id: 'C',
    title: '서로 다른 속성 동시 편집',
    summary: 'U001 style.fontSize=24, U002 style.color=#ff0000 → 두 Lock 모두 획득, 속성별 flush',
    steps: [edit(0, 'U001', 'style.fontSize', 24, 'U001 fontSize 24'), edit(100, 'U002', 'style.color', '#ff0000', 'U002 color #ff0000'), endEdit(200, 'U001'), endEdit(200, 'U002')],
    verifyAt: 1500,
    checks: [
      check('Lock 획득', 2, (w) => count(w, 'PROPERTY_LOCK_GRANTED')),
      check('Lock 거부', 0, (w) => count(w, 'PROPERTY_LOCK_DENIED')),
      check('content.style', { fontSize: 24, color: '#ff0000' }, (w) => (one(w, 'block_live_state')?.content as { style: Json }).style),
      check('block_live_state', { revision: 2, persisted_revision: 2 }, (w) => pick(one(w, 'block_live_state'), liveState)),
      check('property_state 행 (fontSize, color)', ['style.color', 'style.fontSize'], (w) => w.tables.block_property_state.map((r) => r.property_path as string).sort()),
      check('fontSize flush 시점 persisted_revision', 1, (w) => (mainEvents(w, 'DEBOUNCE_SAVE')[0]?.payload as { persistedRevision: number } | undefined)?.persistedRevision ?? null),
    ],
  },
  {
    id: 'D',
    title: '동일 속성 Lock 충돌',
    summary: 'U001이 content Lock 보유 중 U002가 같은 속성 Lock 요청 → PROPERTY_LOCK_DENIED',
    steps: [edit(0, 'U001', 'content', 'A의 편집', 'U001 content 편집'), edit(100, 'U002', 'content', 'B의 편집', 'U002 content 편집 (같은 속성)')],
    verifyAt: 1500,
    checks: [
      check('PROPERTY_LOCK_DENIED (U002)', ['U002'], (w) => mainEvents(w, 'PROPERTY_LOCK_DENIED').map((e) => e.actorUserId)),
      check('거부 시 Lock 소유자', 'U001', (w) => ((mainEvents(w, 'PROPERTY_LOCK_DENIED')[0]?.payload as { owner?: { userId: string } } | undefined)?.owner?.userId ?? null)),
      check('B의 DB 변경 없음 (updated_by)', 'U001', (w) => one(w, 'block_live_state')?.updated_by ?? null),
      check('content.body', 'A의 편집', (w) => (one(w, 'block_live_state')?.content as { body: string }).body),
      check('U002 화면은 A의 값', 'A의 편집', (w) => w.clients.U002.replica.documentView.blocks.B001.content.body as string),
    ],
  },
  {
    id: 'E',
    title: '텍스트 크기 변경',
    summary: 'U001 style.fontSize 16 → 24',
    steps: [edit(0, 'U001', 'style.fontSize', 24, 'U001 fontSize 24'), endEdit(100, 'U001')],
    verifyAt: 1500,
    checks: [
      check(
        '네트워크 흐름',
        ['PROPERTY_LOCK_REQUEST', 'PROPERTY_LOCK_GRANTED', 'PROPERTY_UPDATE', 'PROPERTY_UPDATED', 'PROPERTY_UPDATE_ACK', 'DEBOUNCE_SCHEDULED', 'DEBOUNCE_SAVE', 'PROPERTY_PERSISTED'],
        (w) =>
          w.events
            .filter((e) => e.section !== 'PRECONDITION' && e.actorUserId === 'U001' && e.category !== 'delivery' && e.name !== 'STREAM_XADD' && e.name !== 'PROPERTY_LOCK_RELEASE')
            .map((e) => e.name),
      ),
      check('content.style.fontSize', 24, (w) => (one(w, 'block_live_state')?.content as { style: { fontSize: number } }).style.fontSize),
      check('block_property_state (style.fontSize)', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'block_property_state', { property_path: 'style.fontSize' }), liveState)),
      check('block_version 생성 없음', 1, (w) => w.tables.block_version.length),
    ],
  },
  {
    id: 'F',
    title: '요소 위치 변경',
    summary: 'E001 position.y 100 → 300',
    steps: [move(0, 'U001', T, 'E001', { 'position.y': 300 }, 'U001 E001 y 300'), endEdit(100, 'U001')],
    verifyAt: 1500,
    checks: [
      check('template_live_element.props.position', { x: 100, y: 300 }, (w) => (one(w, 'template_live_element')?.props as { position: Json }).position),
      check('template_live_state', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'template_live_state', { template_id: T }), liveState)),
      check('template_element_property_state (position.y)', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'template_element_property_state', { property_path: 'position.y' }), liveState)),
      check('블록 콘텐츠 변경 없음 (revision)', 0, (w) => one(w, 'block_live_state')?.revision ?? null),
    ],
  },
  {
    id: 'G',
    title: '요소 추가',
    summary: '이미지 요소 추가 → B002(current_version_id NULL), E002, 즉시 트랜잭션',
    steps: [{ at: 0, label: 'U001 이미지 추가', action: { kind: 'intent', actor: 'U001', intent: { type: 'addElement', templateId: T, kind: 'image' } } }],
    verifyAt: 500,
    checks: [
      check('block B002', { kind: 'image', current_version_id: null }, (w) => pick(one(w, 'block', { id: 'B002' }), ['kind', 'current_version_id'])),
      check('block_live_state B002', { base_block_version_id: null, revision: 0 }, (w) => pick(one(w, 'block_live_state', { block_id: 'B002' }), ['base_block_version_id', 'revision'])),
      check('template_element E002', 'B002', (w) => one(w, 'template_element', { id: 'E002' })?.block_id ?? null),
      check('template_live_element (T001, E002)', 2, (w) => one(w, 'template_live_element', { template_element_id: 'E002' })?.sequence ?? null),
      check('template_live_state', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'template_live_state', { template_id: T }), liveState)),
      check('block_version · block_image · template_version 변경 없음', [1, 0, 1], (w) => [w.tables.block_version.length, w.tables.block_image.length, w.tables.template_version.length]),
      check('Debounce 예약 없음', 0, (w) => count(w, 'DEBOUNCE_SCHEDULED')),
    ],
  },
  {
    id: 'H',
    title: '요소 삭제',
    summary: 'E001 삭제 → live 행 DELETE, deleted_at 설정, 블록·과거 버전 유지',
    steps: [{ at: 0, label: 'U001 E001 삭제', action: { kind: 'intent', actor: 'U001', intent: { type: 'deleteElement', templateId: T, elementId: 'E001' } } }],
    verifyAt: 500,
    checks: [
      check('template_live_element', 0, (w) => w.tables.template_live_element.length),
      check('template_element.deleted_at 설정', true, (w) => one(w, 'template_element', { id: 'E001' })?.deleted_at !== null),
      check('template_live_state revision', 1, (w) => one(w, 'template_live_state', { template_id: T })?.revision ?? null),
      check('block · block_live_state 유지', [1, 1], (w) => [w.tables.block.length, w.tables.block_live_state.length]),
      check('과거 template_version_element 유지', 1, (w) => w.tables.template_version_element.length),
    ],
  },
  {
    id: 'I',
    title: '명시적 저장',
    summary: 'precondition B + E + F 후 저장 → 변경된 블록만 block_version, template_version + 전체 구성',
    precondition: PRE_I,
    steps: [save(0, 'U001')],
    verifyAt: 500,
    checks: [
      check('이벤트 흐름', ['TEMPLATE_SAVE', 'TEMPLATE_SAVE_ACK', 'VERSION_SAVE', 'TEMPLATE_SAVED'], (w) =>
        w.events.filter((e) => e.section !== 'PRECONDITION' && /^(TEMPLATE_SAVE|VERSION_SAVE|TEMPLATE_SAVED)/.test(e.name)).map((e) => e.name),
      ),
      check('block_version BV002', { block_id: 'B001', version: 2 }, (w) => pick(one(w, 'block_version', { id: 'BV002' }), ['block_id', 'version'])),
      check('block_text BV002', { body: '안녕하세요! 반갑습니다.', style: { fontSize: 24, color: '#000000' } }, (w) => pick(one(w, 'block_text', { id: 'BV002' }), ['body', 'style'])),
      check('template_version TV002', 2, (w) => one(w, 'template_version', { id: 'TV002' })?.version ?? null),
      check('TVE002 (BV002, y 300)', { block_version_id: 'BV002', y: 300 }, (w) => {
        const r = one(w, 'template_version_element', { id: 'TVE002' });
        return r ? { block_version_id: r.block_version_id, y: (r.props as { position: { y: number } }).position.y } : null;
      }),
      check('current_version_id (block, template)', ['BV002', 'TV002'], (w) => [one(w, 'block')?.current_version_id ?? null, one(w, 'template', { id: T })?.current_version_id ?? null]),
      check('기존 버전 유지 (BV001, TV001)', [true, true], (w) => [!!one(w, 'block_version', { id: 'BV001' }), !!one(w, 'template_version', { id: 'TV001' })]),
    ],
  },
  {
    id: 'J',
    title: '과거 버전 복원',
    summary: 'precondition I(TV002) 후 TV001 복원 → TV003, 구성만 복원, CONTENT_MISMATCH',
    precondition: PRE_J,
    steps: [{ at: 0, label: 'U001 TV001 복원', action: { kind: 'intent', actor: 'U001', intent: { type: 'restoreVersion', templateId: T, versionId: 'TV001' } } }],
    verifyAt: 500,
    checks: [
      check('template_version TV003', { restored_from_version_id: 'TV001', version: 3 }, (w) => pick(one(w, 'template_version', { id: 'TV003' }), ['restored_from_version_id', 'version'])),
      check('TVE003 block_version_id', 'BV001', (w) => one(w, 'template_version_element', { id: 'TVE003' })?.block_version_id ?? null),
      check('template.current_version_id', 'TV003', (w) => one(w, 'template', { id: T })?.current_version_id ?? null),
      check('E001 position.y (Live)', 100, (w) => (one(w, 'template_live_element')?.props as { position: { y: number } }).position.y),
      check('block_live_state 유지', '안녕하세요! 반갑습니다.', (w) => (one(w, 'block_live_state')?.content as { body: string }).body),
      check('block.current_version_id 유지', 'BV002', (w) => one(w, 'block')?.current_version_id ?? null),
      check('block_version · block_text 변경 없음', [2, 2], (w) => [w.tables.block_version.length, w.tables.block_text.length]),
      check('STRUCTURE_UPDATED 명령', 'REPLACE_TEMPLATE_STRUCTURE', (w) => {
        const e = mainEvents(w, 'STRUCTURE_UPDATED')[0];
        return ((e?.payload as { op?: { type: string } } | undefined)?.op?.type ?? null) as Json;
      }),
      check('CONTENT_MISMATCH 필드', ['body', 'style.fontSize'], (w) => {
        const e = mainEvents(w, 'CONTENT_MISMATCH')[0];
        return (e?.payload as { mismatches?: { fields: { path: string }[] }[] } | undefined)?.mismatches?.[0]?.fields.map((f) => f.path) ?? null;
      }),
    ],
  },
  {
    id: 'K',
    title: '공유 블록',
    summary: 'FIXTURE T002(E101 → B001), U002는 T002 → 콘텐츠 공유, 배치 독립',
    reset: { fixtures: [{ name: 'K', source: 'ScenarioRunner' }], viewing: { U002: 'T002' } },
    steps: [
      edit(0, 'U001', 'content', '공유 블록 수정', '1. U001 T001에서 B001 content 변경'),
      endEdit(100, 'U001'),
      move(200, 'U001', T, 'E001', { 'position.x': 250 }, '3. U001 E001 x 250'),
      endEdit(300, 'U001'),
      move(400, 'U002', 'T002', 'E101', { 'size.width': 260 }, '4. U002 E101 width 260'),
      endEdit(500, 'U002'),
    ],
    verifyAt: 2000,
    checks: [
      check('FIXTURE 이벤트 (ScenarioRunner)', 'ScenarioRunner', (w) => ((w.events.find((e) => e.name === 'FIXTURE')?.payload as { createdBy?: string } | undefined)?.createdBy ?? null)),
      check('콘텐츠 전파 대상 (T002의 U002 포함)', ['U002', 'U003', 'U004'], (w) => w.broadcasts.find((b) => b.name === 'PROPERTY_UPDATED' && b.target === 'block:B001')?.recipients ?? null),
      check('U002 화면 (T002)', '공유 블록 수정', (w) => w.clients.U002.replica.documentView.blocks.B001.content.body as string),
      check('block_live_state 행 수', 1, (w) => w.tables.block_live_state.length),
      check('T001/E001 props', { x: 250, width: 300 }, (w) => {
        const p = one(w, 'template_live_element', { template_id: 'T001' })?.props as { position: { x: number }; size: { width: number } };
        return { x: p.position.x, width: p.size.width };
      }),
      check('T002/E101 props', { x: 40, width: 260 }, (w) => {
        const p = one(w, 'template_live_element', { template_id: 'T002' })?.props as { position: { x: number }; size: { width: number } };
        return { x: p.position.x, width: p.size.width };
      }),
      check('template_live_state revision (T001, T002)', [1, 1], (w) => [one(w, 'template_live_state', { template_id: 'T001' })?.revision ?? null, one(w, 'template_live_state', { template_id: 'T002' })?.revision ?? null]),
      check('Lock 키', ['lock:block:B001:content', 'lock:template:T001:element:E001:position.x', 'lock:template:T002:element:E101:size.width'], (w) =>
        mainEvents(w, 'PROPERTY_LOCK_GRANTED').map((e) => e.target as string),
      ),
    ],
  },
  {
    id: 'L',
    title: '저장 실패와 재시도',
    summary: '실패 주입 2회 → t+1000 실패, t+2000 실패, t+4000 성공',
    failures: { count: 2, scope: 'debounce' },
    steps: [edit(0, 'U001', 'content', '재시도 테스트', 'U001 content 변경'), endEdit(100, 'U001')],
    verifyAt: 5000,
    checks: [
      check('flush 시도 결과', ['FAILED', 'FAILED', 'OK'], (w) => mainEvents(w, 'DEBOUNCE_SAVE').map((e) => e.result)),
      check('attempt / retryCount', [[1, 0], [2, 1], [3, 2]], (w) => mainEvents(w, 'DEBOUNCE_SAVE').map((e) => [(e.payload as { attempt: number }).attempt, (e.payload as { retryCount: number }).retryCount])),
      check('승인 기준 시도 시각 (t+)', [1000, 2000, 4000], (w) => {
        const t = mainEvents(w, 'PROPERTY_UPDATE_ACK')[0]?.timestamp ?? 0;
        return mainEvents(w, 'DEBOUNCE_SAVE').map((e) => e.timestamp - t);
      }),
      check('PROPERTY_PERSIST_FAILED', 2, (w) => mainEvents(w, 'PROPERTY_PERSIST_FAILED').length),
      check('최종 block_live_state', { revision: 1, persisted_revision: 1 }, (w) => pick(one(w, 'block_live_state'), liveState)),
      check('실패 주입 횟수 = 실제 실패 트랜잭션 수', [2, 2], (w) => [w.injection.triggered, w.dbTransactions.filter((t) => t.injected).length]),
      check('Redis Live 유지', '재시도 테스트', (w) => {
        const v = w.redis['live:block:B001'];
        return v?.type === 'string' ? ((v.value as { content: { body: string } }).content.body as Json) : null;
      }),
    ],
  },
  {
    id: 'L-DEAD',
    title: '저장 실패 → DEAD (L 변형 1)',
    summary: '실패 주입 4회 → 최초 1회 + 재시도 3회 모두 실패 → DEAD, 자동 재시도 중단',
    failures: { count: 4, scope: 'debounce' },
    steps: [edit(0, 'U001', 'content', 'DEAD 테스트', 'U001 content 변경'), endEdit(100, 'U001')],
    verifyAt: 12_000,
    checks: [
      check('flush 시도', ['FAILED', 'FAILED', 'FAILED', 'FAILED'], (w) => mainEvents(w, 'DEBOUNCE_SAVE').map((e) => e.result)),
      check('승인 기준 시도 시각 (t+)', [1000, 2000, 4000, 8000], (w) => {
        const t = mainEvents(w, 'PROPERTY_UPDATE_ACK')[0]?.timestamp ?? 0;
        return mainEvents(w, 'DEBOUNCE_SAVE').map((e) => e.timestamp - t);
      }),
      check('Debounce 상태', { status: 'DEAD', attempt: 4, retryCount: 3, nextRetryAt: null }, (w) => {
        const v = w.redis['debounce:block:B001:content'];
        return v?.type === 'string' ? pick(v.value as Row, ['status', 'attempt', 'retryCount', 'nextRetryAt']) : null;
      }),
      check('자동 재시도 예약 없음', 0, (w) => w.timers.filter((t) => t.label.startsWith('debounce retry')).length),
      check('PostgreSQL 미반영 (revision 0)', 0, (w) => one(w, 'block_live_state')?.revision ?? null),
      check('실패 주입 횟수 = 실제 실패 트랜잭션 수', [4, 4], (w) => [w.injection.triggered, w.dbTransactions.filter((t) => t.injected).length]),
    ],
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
