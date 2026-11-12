import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter, type AdapterNotice } from '../../src/editor/adapters/engineAdapter';
import { elementsOf } from '../../src/editor/model/documentModel';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { renderView } from '../../src/editor/model/replica';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { createSeedTables } from '../../src/engine/seed';
import { simTimestamp } from '../../src/engine/simTime';

/** Phase 5: 시나리오 I(명시적 저장), J(복원), K(공유 블록) */

let engine: SimulationEngine;
let port: EditorPort;
let notices: AdapterNotice[];

const world = () => engine.store.getState();
const pg = () => world().tables;
const client = (id: string) => world().clients[id];
const view = (id: string) => renderView(client(id).replica);
const events = (name: string) => world().events.filter((e) => e.name === name);
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => port.dispatch(actor, intent);
const editText = (actor: string, propertyPath: string, value: string | number) =>
  dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath, value });
const save = (actor = 'U001', templateId = 'T001') => {
  dispatch(actor, { type: 'save', templateId });
  run();
  return client(actor).lastVersion!;
};
const restore = (versionId: string, actor = 'U001', templateId = 'T001') => {
  dispatch(actor, { type: 'restoreVersion', templateId, versionId });
  run();
  return client(actor).lastVersion!;
};

/** precondition I: B + E + F 적용 (명령을 실제로 실행, DB 직접 조작 없음 — §1.1) */
function preconditionI() {
  editText('U001', 'content', '안녕하세요! 반갑습니다.');
  editText('U001', 'style.fontSize', 24);
  dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
  dispatch('U001', { type: 'endEdit' });
  run();
}

function setup(opts: Parameters<typeof createSimulationEngine>[0] = {}) {
  engine = createSimulationEngine(opts);
  notices = [];
  port = createEngineAdapter(engine, (n) => notices.push(n));
}

beforeEach(() => setup());

describe('시나리오 I: 명시적 저장', () => {
  it('변경된 블록만 block_version을 만들고 template_version과 전체 구성을 INSERT한다', () => {
    preconditionI();
    const seed = createSeedTables();
    const outcome = save();
    expect(outcome).toMatchObject({ ok: true, templateVersionId: 'TV002', version: 2, createdBlockVersions: [{ blockId: 'B001', blockVersionId: 'BV002' }], reusedBlockVersions: [] });
    expect(pg().block_version).toEqual([seed.block_version[0], expect.objectContaining({ id: 'BV002', block_id: 'B001', version: 2, changed_by: 'U001' })]);
    expect(pg().block_text).toEqual([seed.block_text[0], { id: 'BV002', body: '안녕하세요! 반갑습니다.', style: { fontSize: 24, color: '#000000' } }]);
    expect(pg().block[0].current_version_id).toBe('BV002');
    expect(pg().block_live_state[0].base_block_version_id).toBe('BV002');
    expect(pg().template_version).toEqual([seed.template_version[0], expect.objectContaining({ id: 'TV002', version: 2, restored_from_version_id: null })]);
    expect(pg().template_version_element).toEqual([
      seed.template_version_element[0],
      expect.objectContaining({ id: 'TVE002', template_version_id: 'TV002', template_element_id: 'E001', block_version_id: 'BV002', props: { position: { x: 100, y: 300 }, size: { width: 300, height: 100 } } }),
    ]);
    expect(pg().template[0].current_version_id).toBe('TV002');
    expect(engine.internals.db.integrityErrors()).toEqual([]);
    // 저장 완료 알림 (Stream 미기록)
    const savedNotice = world().broadcasts.find((b) => b.name === 'TEMPLATE_SAVED')!;
    expect(savedNotice).toMatchObject({ kind: 'notice', recipients: ['U001', 'U002', 'U003', 'U004'], status: 'COMPLETE' });
    expect(notices.at(-1)).toMatchObject({ tone: 'success' });
  });

  it('같은 상태로 다시 저장하면 NO_CHANGES로 버전을 만들지 않는다', () => {
    preconditionI();
    save();
    const before = { tv: pg().template_version.length, bv: pg().block_version.length, tx: world().dbTransactions.length };
    expect(save()).toMatchObject({ ok: true, code: 'NO_CHANGES' });
    expect(pg().template_version).toHaveLength(before.tv);
    expect(pg().block_version).toHaveLength(before.bv);
    expect(world().dbTransactions).toHaveLength(before.tx); // flush할 것도 없으면 트랜잭션 없음
  });

  it('배치만 바뀌면 블록 버전은 재사용하고 새 TVE가 기존 BV002를 참조한다', () => {
    preconditionI();
    save();
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 160 } });
    run();
    const outcome = save();
    expect(outcome).toMatchObject({ templateVersionId: 'TV003', createdBlockVersions: [], reusedBlockVersions: [{ blockId: 'B001', blockVersionId: 'BV002' }] });
    expect(pg().block_version).toHaveLength(2);
    expect(pg().template_version_element.at(-1)).toMatchObject({ id: 'TVE003', block_version_id: 'BV002', props: { position: { x: 160, y: 300 } } });
  });

  it('대기 중 Debounce는 저장 트랜잭션 앞단에서 함께 flush된다', () => {
    editText('U001', 'content', '바로 저장');
    engine.advanceBy(100); // 승인됨, Debounce 대기 (1030)
    expect(engine.internals.redis.keys('debounce:*')).toHaveLength(1);
    dispatch('U001', { type: 'save', templateId: 'T001' });
    engine.advanceBy(20); // 저장 처리 (Debounce 만료 전)
    expect(engine.internals.redis.keys('debounce:*')).toEqual([]);
    const tx = world().dbTransactions.at(-1)!;
    expect(world().dbChanges.filter((c) => c.txId === tx.txId).map((c) => `${c.op} ${c.table}`)).toEqual([
      'UPDATE block_live_state',
      'INSERT block_property_state',
      'INSERT block_version',
      'INSERT block_text',
      'UPDATE block',
      'UPDATE block_live_state',
      'INSERT template_version',
      'INSERT template_version_element',
      'UPDATE template',
    ]);
    expect(pg().block_live_state[0]).toMatchObject({ revision: 1, persisted_revision: 1, base_block_version_id: 'BV002', content: { body: '바로 저장' } });
    run();
    expect(events('DEBOUNCE_SAVE')).toHaveLength(0); // 별도 flush 없음
    expect(world().broadcasts.filter((b) => b.name === 'PROPERTY_PERSISTED')).toHaveLength(1);
  });

  it('current_version_id = NULL인 신규 블록은 첫 저장에서 최초 block_version을 만든다', () => {
    dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'image' });
    run();
    expect(pg().block.find((b) => b.id === 'B002')!.current_version_id).toBeNull();
    const outcome = save();
    expect(outcome.createdBlockVersions).toEqual([{ blockId: 'B002', blockVersionId: 'BV002' }]);
    expect(outcome.reusedBlockVersions).toEqual([{ blockId: 'B001', blockVersionId: 'BV001' }]);
    expect(pg().block_image).toEqual([{ id: 'BV002', file_url: null, alt_text: '', width: 300, height: 200 }]);
    expect(pg().block_version.find((v) => v.id === 'BV002')).toMatchObject({ block_id: 'B002', version: 1 });
  });

  it('저장 트랜잭션이 실패하면 전체 롤백되고 Debounce 대기는 유지된다', () => {
    editText('U001', 'content', '실패');
    engine.advanceBy(100);
    engine.internals.db.failNextWrites(1);
    dispatch('U001', { type: 'save', templateId: 'T001' });
    engine.advanceBy(20);
    expect(client('U001').lastVersion).toMatchObject({ ok: false, code: 'DB_WRITE_FAILED' });
    expect(pg().block_version).toHaveLength(1);
    expect(engine.internals.redis.keys('debounce:*')).toHaveLength(1);
    run(); // 1030에 일반 flush
    expect(pg().block_live_state[0]).toMatchObject({ revision: 1, persisted_revision: 1 });
  });
});

describe('시나리오 J: 과거 버전 복원', () => {
  it('새 TV003(restored_from TV001)을 만들고 구성만 복원하며, 블록 콘텐츠는 바꾸지 않고 CONTENT_MISMATCH를 경고한다', () => {
    preconditionI();
    save(); // TV002
    const before = { bv: pg().block_version, bt: pg().block_text, bls: pg().block_live_state, tv: pg().template_version.slice(), tve: pg().template_version_element.slice() };
    const outcome = restore('TV001');
    expect(outcome).toMatchObject({ ok: true, templateVersionId: 'TV003', restoredFromVersionId: 'TV001' });
    expect(pg().template_version.slice(0, 2)).toEqual(before.tv);
    expect(pg().template_version.at(-1)).toMatchObject({ id: 'TV003', version: 3, restored_from_version_id: 'TV001' });
    expect(pg().template_version_element.slice(0, 2)).toEqual(before.tve);
    expect(pg().template_version_element.at(-1)).toMatchObject({ id: 'TVE003', template_version_id: 'TV003', block_version_id: 'BV001', props: { position: { y: 100 } } });
    expect(pg().template[0].current_version_id).toBe('TV003');
    expect(pg().template_live_element[0].props).toMatchObject({ position: { y: 100 } });
    // 변경 없음: block_version, block_text, block_live_state, block.current_version_id
    expect(pg().block_version).toBe(before.bv);
    expect(pg().block_text).toBe(before.bt);
    expect(pg().block_live_state).toBe(before.bls);
    expect(pg().block[0].current_version_id).toBe('BV002');
    expect(view('U003').blocks.B001.content.body).toBe('안녕하세요! 반갑습니다.');
    // CONTENT_MISMATCH
    expect(outcome.mismatches).toEqual([
      {
        blockId: 'B001',
        elementIds: ['E001'],
        blockVersionId: 'BV001',
        fields: [
          { path: 'body', versionValue: '안녕하세요', liveValue: '안녕하세요! 반갑습니다.' },
          { path: 'style.fontSize', versionValue: 16, liveValue: 24 },
        ],
      },
    ]);
    expect(events('CONTENT_MISMATCH')).toHaveLength(1);
    expect(notices.some((n) => n.title.startsWith('CONTENT_MISMATCH'))).toBe(true);
    // 구조 변경 전파 (§8.11: 복원 결과는 요청자를 포함한 접속자에게 STRUCTURE_UPDATED로 전파)
    const structure = world().broadcasts.find((b) => b.name === 'STRUCTURE_UPDATED')!;
    expect(structure).toMatchObject({ recipients: ['U001', 'U002', 'U003', 'U004'], status: 'COMPLETE' });
    expect(world().broadcasts.indexOf(structure)).toBeLessThan(world().broadcasts.findIndex((b) => b.name === 'CONTENT_MISMATCH'));
    for (const u of ['U001', 'U002', 'U004']) expect(view(u).elements.E001.props.position.y).toBe(100);
    const live = engine.internals.redis.get('live:template:T001') as { revision: number; structureRevision: number };
    expect(pg().template_live_state[0]).toMatchObject({ revision: live.revision, persisted_revision: live.revision });
  });

  it('변형: 삭제된 요소는 deleted_at = NULL로 되돌리고 template_live_element를 다시 INSERT한다 (I → H → J)', () => {
    preconditionI();
    save();
    dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    run();
    expect(pg().template_live_element).toEqual([]);
    restore('TV001');
    expect(pg().template_element[0].deleted_at).toBeNull();
    expect(pg().template_live_element).toEqual([expect.objectContaining({ template_element_id: 'E001', sequence: 1, props: { position: { x: 100, y: 100 }, size: { width: 300, height: 100 } } })]);
    expect(elementsOf(view('U002'), 'T001').map((e) => e.elementId)).toEqual(['E001']);
  });

  it('복원 구성에 없는 현재 요소는 live 행 DELETE와 deleted_at 설정', () => {
    dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' });
    run();
    restore('TV001');
    expect(pg().template_live_element.map((e) => e.template_element_id)).toEqual(['E001']);
    expect(pg().template_element.find((e) => e.id === 'E002')!.deleted_at).toBe(simTimestamp(world().events.find((e) => e.name === 'TEMPLATE_RESTORE')!.timestamp));
    expect(elementsOf(view('U004'), 'T001').map((e) => e.elementId)).toEqual(['E001']);
    // 블록은 유지
    expect(pg().block.map((b) => b.id)).toEqual(['B001', 'B002']);
  });

  it('복원 전 대기 중 Debounce를 같은 트랜잭션에서 flush한다', () => {
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 450 } });
    engine.advanceBy(100);
    dispatch('U001', { type: 'endEdit' });
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV001' });
    engine.advanceBy(30);
    expect(engine.internals.redis.keys('debounce:*')).toEqual([]);
    expect(pg().template_live_element[0].props).toMatchObject({ position: { y: 100 } });
    expect(pg().template_element_property_state[0]).toMatchObject({ property_path: 'position.y', revision: 1, persisted_revision: 1 });
  });
});

describe('시나리오 K: 공유 블록', () => {
  // precondition: 시나리오 실행기 경로로 FIXTURE 추가 (Console 버튼과 같은 applyFixture)
  beforeEach(() => setup({ fixtures: [{ name: 'K', source: 'ScenarioRunner' }], viewing: { U002: 'T002' } }));

  it('K precondition의 T002는 FIXTURE 이벤트로 기록된다 (ScenarioRunner 경로)', () => {
    expect(events('FIXTURE')).toEqual([
      expect.objectContaining({ actorUserId: null, category: 'system', result: 'OK', payload: expect.objectContaining({ fixture: 'K', createdBy: 'ScenarioRunner' }) }),
    ]);
    expect(pg().template.map((t) => t.id)).toEqual(['T001', 'T002']);
    expect(engine.internals.db.integrityErrors()).toEqual([]);
  });

  it('콘텐츠는 두 템플릿에 공유되고 block_live_state는 한 행만 갱신된다. 배치는 독립적이다', () => {
    editText('U001', 'content', '공유 블록 수정');
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 250 } });
    dispatch('U001', { type: 'endEdit' });
    engine.advanceBy(100);
    dispatch('U002', { type: 'editPlacement', templateId: 'T002', elementId: 'E101', changes: { 'size.width': 260 } });
    run();
    expect(view('U002').blocks.B001.content.body).toBe('공유 블록 수정');
    expect(pg().block_live_state).toHaveLength(1);
    expect(pg().block_live_state[0]).toMatchObject({ revision: 1, content: { body: '공유 블록 수정' } });
    const tle = (tid: string) => pg().template_live_element.find((e) => e.template_id === tid)!.props;
    expect(tle('T001')).toMatchObject({ position: { x: 250 }, size: { width: 300 } });
    expect(tle('T002')).toMatchObject({ position: { x: 40 }, size: { width: 260 } });
    expect(pg().template_live_state.map((s) => [s.template_id, s.revision])).toEqual([
      ['T001', 1],
      ['T002', 1],
    ]);
    const lockKeys = world().events.filter((e) => e.name === 'PROPERTY_LOCK_GRANTED').map((e) => e.target);
    expect(lockKeys).toEqual(['lock:block:B001:content', 'lock:template:T001:element:E001:position.x', 'lock:template:T002:element:E101:size.width']);
  });

  it('변형: A가 콘텐츠 Lock을 보유한 동안 T002의 B도 같은 Lock을 두고 경쟁해 PROPERTY_LOCK_DENIED', () => {
    editText('U001', 'content', 'A');
    engine.advanceBy(100);
    editText('U002', 'content', 'B');
    run();
    expect(events('PROPERTY_LOCK_DENIED')).toEqual([expect.objectContaining({ actorUserId: 'U002' })]);
  });

  it('T001 저장은 B001의 새 버전을 만들지만 T002의 기존 버전 구성(BV001 참조)은 그대로다. T002 저장은 BV002를 재사용한다', () => {
    editText('U001', 'content', '공유 블록 수정');
    run();
    save('U001', 'T001');
    expect(pg().block[0].current_version_id).toBe('BV002');
    expect(pg().template_version_element.find((r) => r.id === 'TVE101')!.block_version_id).toBe('BV001');
    const outcome = save('U002', 'T002');
    expect(outcome).toMatchObject({ templateVersionId: 'TV003', createdBlockVersions: [], reusedBlockVersions: [{ blockId: 'B001', blockVersionId: 'BV002' }] });
    expect(pg().template_version_element.at(-1)).toMatchObject({ template_version_id: 'TV003', template_element_id: 'E101', block_version_id: 'BV002' });
  });
});

describe('시나리오 K FIXTURE를 실행 중에 추가 (Console)', () => {
  it('FIXTURE로 T002를 추가하고, U002가 처음 보는 T002로 전환하면 SYNC 스냅샷으로 최초 로드한다', () => {
    const before = { tables: pg(), events: world().events.length };
    expect(engine.loadFixture('K')).toBe(true);
    expect(engine.loadFixture('K')).toBe(false); // 중복 추가는 하지 않고 결과만 기록
    expect(events('FIXTURE').map((e) => [e.result, (e.payload as { createdBy: string }).createdBy])).toEqual([
      ['OK', 'SimulationConsole'],
      ['INFO', 'SimulationConsole'],
    ]);
    // 사용자 편집 이벤트와 구분: actor 없음, system 카테고리, 생성 대상 ID 포함
    expect(events('FIXTURE')[0]).toMatchObject({
      actorUserId: null,
      category: 'system',
      timestamp: world().now,
      payload: { fixture: 'K', dataKind: 'scenario-fixture', targets: expect.arrayContaining([{ table: 'template', id: 'T002' }, { table: 'template_element', id: 'E101' }]) },
    });
    // DB Explorer가 읽는 MockDatabase에 반영 (6개 테이블 INSERT, 하나의 트랜잭션)
    expect(pg().template.map((t) => t.id)).toEqual(['T001', 'T002']);
    expect(before.tables.template).toHaveLength(1);
    const tx = world().dbTransactions.at(-1)!;
    expect(world().dbChanges.filter((c) => c.txId === tx.txId).map((c) => `${c.op} ${c.table}`)).toEqual([
      'INSERT template',
      'INSERT template_version',
      'INSERT template_element',
      'INSERT template_version_element',
      'INSERT template_live_state',
      'INSERT template_live_element',
    ]);
    expect(engine.internals.redis.exists('live:template:T002')).toBe(true);
    expect(engine.internals.db.integrityErrors()).toEqual([]);
    expect(view('U002').templates.T002).toBeUndefined();
    port.updateLocal('U002', { viewingTemplateId: 'T002' });
    run();
    const sync = world().events.filter((e) => e.name === 'SYNC').at(-1)!;
    expect(sync.target).toBe('template:T002');
    expect(view('U002').templates.T002).toMatchObject({ name: '경력 템플릿', revision: 0 });
    expect(view('U002').elements.E101).toMatchObject({ blockId: 'B001', props: { position: { x: 40, y: 40 } } });
    // 공유 블록 콘텐츠 전파: T001의 U001 편집이 T002의 U002에게 Delivery
    editText('U001', 'content', '공유');
    run();
    expect(view('U002').blocks.B001.content.body).toBe('공유');
    const b = world().broadcasts.find((x) => x.name === 'PROPERTY_UPDATED')!;
    expect(b.recipients).toEqual(['U002', 'U003', 'U004']);
  });
});
