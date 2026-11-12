import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import { elementsOf } from '../../src/editor/model/documentModel';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { renderView } from '../../src/editor/model/replica';
import type { OpRejection } from '../../src/engine/client/clientRuntime';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { readLiveTemplate } from '../../src/engine/server/liveState';
import { createSeedTables } from '../../src/engine/seed';

/** 구조 변경 엔진 연결: 시나리오 G(추가), H(삭제), MU-10(삭제 Undo → ELEMENT_RESTORE), 순서 변경, 충돌, 임시 ID */

let engine: SimulationEngine;
let port: EditorPort;
let rejections: OpRejection[];

const world = () => engine.store.getState();
const replica = (id: string) => world().clients[id].replica;
const view = (id: string) => renderView(replica(id));
const pg = () => world().tables;
const at = (ms: number) => engine.advanceBy(ms - world().now);
const events = (name: string) => world().events.filter((e) => e.name === name);
const add = (actor: string, kind: 'image' | 'title' | 'text' = 'image') =>
  port.dispatch(actor, { type: 'addElement', templateId: 'T001', kind } as EditorIntent) as { ok: boolean; createdElementId: string };
const ids = (u: string) => elementsOf(view(u), 'T001').map((e) => e.elementId);

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
  rejections = [];
  engine.onRejection((r) => rejections.push(r));
});

describe('시나리오 G: 요소 추가', () => {
  it('임시 ID로 즉시 표시 → 서버가 B002/E002 발급, 하나의 트랜잭션으로 즉시 저장, current_version_id = NULL', () => {
    const r = add('U001');
    expect(r.createdElementId).toBe('local-E1');
    port.updateLocal('U001', { selectedElementId: r.createdElementId });
    expect(ids('U001')).toEqual(['E001', 'local-E1']); // Optimistic
    at(10); // 서버 처리
    const seed = createSeedTables();
    expect(pg().block.find((b) => b.id === 'B002')).toMatchObject({ kind: 'image', current_version_id: null, created_by: 'U001' });
    expect(pg().block_live_state.find((b) => b.block_id === 'B002')).toMatchObject({
      base_block_version_id: null,
      content: { file_url: null, alt_text: '', width: 300, height: 200 },
      revision: 0,
    });
    expect(pg().template_element.find((e) => e.id === 'E002')).toMatchObject({ template_id: 'T001', block_id: 'B002', deleted_at: null });
    expect(pg().template_live_element.find((e) => e.template_element_id === 'E002')).toMatchObject({ sequence: 2, block_id: 'B002' });
    expect(pg().template_live_state[0]).toMatchObject({ revision: 1, persisted_revision: 1 });
    for (const t of ['block_version', 'block_image', 'template_version', 'template_version_element'] as const) expect(pg()[t]).toEqual(seed[t]);
    // 하나의 트랜잭션
    const tx = world().dbTransactions.at(-1)!;
    expect(tx.status).toBe('COMMITTED');
    expect(world().dbChanges.filter((c) => c.txId === tx.txId).map((c) => `${c.op} ${c.table}`)).toEqual([
      'INSERT block',
      'INSERT block_live_state',
      'INSERT template_element',
      'INSERT template_live_element',
      'UPDATE template_live_state',
    ]);

    at(20); // 응답·Delivery 도착
    expect(ids('U001')).toEqual(['E001', 'E002']);
    expect(replica('U001').selectedElementId).toBe('E002'); // 선택도 서버 ID로 치환
    expect(replica('U001').pendingOps).toHaveLength(0);
    for (const u of ['U002', 'U003', 'U004']) expect(ids(u)).toEqual(['E001', 'E002']);
    expect(events('DEBOUNCE_SCHEDULED')).toHaveLength(0); // 구조 변경은 Debounce 없음
    expect(world().events.map((e) => e.name).filter((n) => !['DELIVERY'].includes(n))).toEqual([
      'ELEMENT_CREATE',
      'STRUCTURE_SAVE',
      'STREAM_XADD',
      'STRUCTURE_UPDATED',
      'STRUCTURE_UPDATE_ACK',
    ]);
    expect(engine.internals.db.integrityErrors()).toEqual([]);
  });

  it('생성 승인 전에 새 요소를 편집하면 서버 ID 발급 후 그 ID로 전송된다', () => {
    const { createdElementId: local } = add('U001', 'text');
    const localBlock = view('U001').elements[local].blockId;
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: local, changes: { 'position.y': 640 } });
    port.dispatch('U001', { type: 'editProperty', blockId: localBlock, propertyPath: 'content', value: '새 텍스트' });
    expect(view('U001').elements[local].props.position.y).toBe(640); // Optimistic
    engine.runUntilIdle();
    expect(rejections).toEqual([]);
    expect(view('U001').elements.E002.props.position.y).toBe(640);
    expect(view('U003').blocks.B002.content.body).toBe('새 텍스트');
    expect(pg().template_live_element.find((e) => e.template_element_id === 'E002')!.props).toMatchObject({ position: { y: 640 } });
    expect(pg().block_live_state.find((b) => b.block_id === 'B002')).toMatchObject({ revision: 1, persisted_revision: 1, content: { body: '새 텍스트' } });
    expect(engine.internals.redis.keys('lock:*').some((k) => k.includes('local-'))).toBe(false);
    // Undo 기록도 서버 ID로 치환
    expect(JSON.stringify(replica('U001').undoStack)).not.toContain('local-');
  });

  it('동시에 추가하면 나중 요청은 STRUCTURE_CONFLICT로 거부되고 그 작업만 사라진다', () => {
    add('U001');
    add('U002', 'title');
    engine.runUntilIdle();
    expect(rejections).toEqual([expect.objectContaining({ userId: 'U002', code: 'STRUCTURE_CONFLICT', rejectedBy: 'server' })]);
    for (const u of ['U001', 'U002', 'U003']) expect(ids(u)).toEqual(['E001', 'E002']);
    expect(replica('U002').undoStack).toHaveLength(0);
    // 최신 구조를 받은 뒤에는 다시 추가할 수 있다
    add('U002', 'title');
    engine.runUntilIdle();
    expect(ids('U001')).toEqual(['E001', 'E002', 'E003']);
  });
});

describe('시나리오 H: 요소 삭제', () => {
  it('대기 중 Debounce 취소(대체 완료), 요소 Lock 해제, live 행 DELETE와 deleted_at 설정, 블록·과거 버전 유지', () => {
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    at(40); // 승인, Debounce 대기 (1030)
    expect(engine.internals.redis.keys('debounce:*')).toHaveLength(1);
    // v1.2.5: 다른 사용자가 Lock을 보유한 요소는 삭제할 수 없으므로(ELEMENT_LOCKED, lockRelease.test) Lock 보유자 본인이 삭제한다
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    engine.runUntilIdle();
    expect(engine.internals.redis.keys('debounce:*')).toEqual([]);
    expect(events('DEBOUNCE_SAVE')).toHaveLength(0);
    expect(engine.internals.redis.keys('lock:template:*')).toEqual([]);
    expect(events('STRUCTURE_UPDATE_ACK')[0].payload).toMatchObject({
      cancelledDebounce: ['debounce:template:T001:element:E001:position.y'],
      releasedLocks: ['lock:template:T001:element:E001:position.y'],
    });
    expect(pg().template_live_element).toEqual([]);
    expect(pg().template_element[0].deleted_at).toBe('2026-01-01 14:00:00.050');
    // 취소된 revision은 대체 완료 → 연속 저장 계산이 막히지 않음
    const live = readLiveTemplate(engine.internals.redis, 'T001')!;
    expect(live).toMatchObject({ revision: 2, unpersisted: [] });
    expect(pg().template_live_state[0]).toMatchObject({ revision: 2, persisted_revision: 2 });
    expect(pg().block).toHaveLength(1);
    expect(pg().block_live_state).toHaveLength(1);
    expect(pg().template_version_element).toEqual(createSeedTables().template_version_element);
    for (const u of ['U002', 'U003']) expect(ids(u)).toEqual([]);
    // 삭제된 요소의 배치 편집은 서버가 거부한다
    expect(engine.internals.db.integrityErrors()).toEqual([]);
  });

  it('삭제된 요소의 property_state 이력 행은 유지된다', () => {
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    engine.runUntilIdle(); // flush 완료
    expect(pg().template_element_property_state).toHaveLength(1);
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    engine.runUntilIdle();
    expect(pg().template_element_property_state).toHaveLength(1);
  });
});

describe('MU-10: 삭제 Undo → ELEMENT_RESTORE', () => {
  it('deleted_at = NULL, template_live_element 재생성, 같은 위치·순서·배치 값', () => {
    add('U001', 'title');
    engine.runUntilIdle();
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    engine.runUntilIdle();
    expect(ids('U002')).toEqual(['E002']);
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true);
    engine.runUntilIdle();
    expect(events('ELEMENT_RESTORE')).toHaveLength(1);
    expect(pg().template_element.find((e) => e.id === 'E001')!.deleted_at).toBeNull();
    expect(pg().template_live_element.find((e) => e.template_element_id === 'E001')).toMatchObject({
      sequence: 1,
      props: { position: { x: 100, y: 100 }, size: { width: 300, height: 100 } },
    });
    expect(ids('U002')).toEqual(['E001', 'E002']);
    // 블록 테이블은 변경하지 않는다 (§8.5)
    const restoreTx = world().dbChanges.filter((c) => c.txId === world().dbTransactions.at(-1)!.txId).map((c) => c.table);
    expect(restoreTx.some((t) => t.startsWith('block'))).toBe(false);
  });

  it('추가 Undo는 ELEMENT_DELETE, Redo는 같은 ID로 ELEMENT_RESTORE', () => {
    add('U001');
    engine.runUntilIdle();
    port.dispatch('U001', { type: 'undo' });
    engine.runUntilIdle();
    expect(ids('U003')).toEqual(['E001']);
    expect(pg().template_element.find((e) => e.id === 'E002')!.deleted_at).not.toBeNull();
    port.dispatch('U001', { type: 'redo' });
    engine.runUntilIdle();
    expect(ids('U003')).toEqual(['E001', 'E002']);
    expect(events('ELEMENT_RESTORE')[0].payload).toMatchObject({ op: { elementId: 'E002', blockId: 'B002' } });
    expect(pg().block).toHaveLength(2); // 재생성 없음
  });

  it('이미 다른 사용자가 삭제한 요소의 Undo(삭제)는 UNDO_CONFLICT', () => {
    add('U001');
    engine.runUntilIdle();
    port.dispatch('U002', { type: 'deleteElement', templateId: 'T001', elementId: 'E002' });
    engine.runUntilIdle();
    expect(port.dispatch('U001', { type: 'undo' })).toMatchObject({ ok: false, code: 'UNDO_CONFLICT' });
  });
});

describe('순서 변경', () => {
  it('ELEMENT_REORDER는 sequence를 다시 매기고, Undo는 이전 위치로 되돌린다', () => {
    add('U001', 'title');
    engine.runUntilIdle();
    port.dispatch('U001', { type: 'reorderElement', templateId: 'T001', elementId: 'E002', toIndex: 0 });
    engine.runUntilIdle();
    expect(ids('U004')).toEqual(['E002', 'E001']);
    expect(Object.fromEntries(pg().template_live_element.map((e) => [e.template_element_id, e.sequence]))).toEqual({ E001: 2, E002: 1 });
    port.dispatch('U001', { type: 'undo' });
    engine.runUntilIdle();
    expect(ids('U004')).toEqual(['E001', 'E002']);
    expect(events('ELEMENT_REORDER').at(-1)!.payload).toMatchObject({ undo: { direction: 'undo', expectedIndex: 0 } });
  });
});

describe('연결 단절과 구조 변경 (§8.10.6)', () => {
  it('생성 승인 직후 응답 전에 끊겨도 재연결 SYNC에서 승인으로 복구되고 서버 ID가 반영된다', () => {
    add('U001');
    at(15); // 서버 승인 10, 응답 도착 20 전
    engine.disconnect('U001');
    expect(world().clients.U001.unconfirmed).toEqual([expect.objectContaining({ propertyPath: 'ELEMENT_CREATE' })]);
    engine.connect('U001');
    engine.runUntilIdle();
    expect(rejections).toEqual([]);
    expect(ids('U001')).toEqual(['E001', 'E002']);
    expect(JSON.stringify(replica('U001').undoStack)).toContain('E002');
    port.dispatch('U001', { type: 'undo' });
    engine.runUntilIdle();
    expect(ids('U002')).toEqual(['E001']);
  });

  it('연결이 없으면 구조 변경도 DISCONNECTED로 즉시 거부된다', () => {
    engine.disconnect('U001');
    add('U001');
    expect(rejections).toEqual([expect.objectContaining({ code: 'DISCONNECTED', rejectedBy: 'client' })]);
    expect(events('STRUCTURE_UPDATE_REJECTED')[0]).toMatchObject({ from: 'U001', to: [], payload: { rejectedBy: 'client' } });
    expect(ids('U001')).toEqual(['E001']);
  });
});
