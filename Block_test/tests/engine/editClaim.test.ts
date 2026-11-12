import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { claimLockKey } from '../../src/editor/model/lockKeys';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';

/**
 * v1.2.8 요소 편집 권한 (DB_SCHEMA §7.5.1)
 * - 요소를 선택하면 그 요소 전체 편집 권한을 받는다. 다른 사용자는 선택만 가능
 * - 앞사람이 나가면 그 요소를 선택하고 기다리던 사용자에게 순서대로 넘어간다
 */

let engine: SimulationEngine;
let port: EditorPort;
const CLAIM = claimLockKey('T001', 'E001');
const world = () => engine.store.getState();
const step = () => engine.advanceBy(300);
const holder = () => (world().redis[CLAIM] as unknown as { value?: { userId?: string } } | undefined)?.value?.userId ?? null;
const body = () => (world().redis['live:block:B001'] as unknown as { value: { content: { body: string } } }).value.content.body;
const select = (u: string, id: string | null) => {
  port.updateLocal(u, { selectedElementId: id });
  step();
};
const dispatch = (u: string, intent: EditorIntent) => {
  const r = port.dispatch(u, intent);
  step();
  return r;
};
const type = (u: string, text: string) => dispatch(u, { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: text });
const events = (name: string) => world().events.filter((e) => e.name === name);

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
});

describe('선택하면 요소 편집 권한', () => {
  it('선택만 해도 권한을 받고, 입력하지 않아도 유지된다 (TTL 없음)', () => {
    select('U001', 'E001');
    expect(holder()).toBe('U001');
    engine.advanceBy(30_000);
    expect(holder()).toBe('U001');
  });

  it('다른 사용자는 선택만 된다: 내용·서식·위치·순서·삭제 모두 거부', () => {
    select('U001', 'E001');
    select('U002', 'E001');
    expect(holder()).toBe('U001');
    type('U002', 'U002 입력');
    dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.bold', value: true });
    dispatch('U002', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 300 } });
    dispatch('U002', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    expect(body()).toBe('안녕하세요');
    expect(world().tables.template_live_element.find((r) => r.template_element_id === 'E001')).toMatchObject({ props: { position: { x: 100 } } });
    expect(events('PROPERTY_LOCK_DENIED').filter((e) => e.actorUserId === 'U002').length).toBeGreaterThanOrEqual(3);
    expect(events('STRUCTURE_UPDATE_REJECTED').map((e) => (e.payload as { code: string }).code)).toEqual(['ELEMENT_LOCKED']);
  });
});

describe('나가면 기다리던 사용자에게 넘김 (요청하신 시나리오)', () => {
  it('U1 편집 중 U2 선택 → U1 빈 곳 클릭 → U2가 바로 권한을 받고, U1이 다시 선택해도 편집할 수 없다', () => {
    select('U001', 'E001');
    type('U001', 'U1 편집');
    select('U002', 'E001');
    expect(type('U002', 'U2 시도')).toMatchObject({ ok: true }); // 화면에는 낙관적으로 보였다가
    expect(body()).toBe('U1 편집'); // 서버는 거부
    select('U001', null);
    expect(holder()).toBe('U002');
    expect(events('LOCK_HANDOFF').map((e) => e.actorUserId)).toEqual(['U002']);
    select('U001', 'E001');
    expect(holder()).toBe('U002');
    type('U001', 'U1 재시도');
    expect(body()).toBe('U1 편집');
    type('U002', 'U2 편집');
    expect(body()).toBe('U2 편집');
  });

  it('먼저 선택한 순서대로 넘기고, 그 사이 다른 곳으로 간 대기자는 건너뛴다', () => {
    select('U001', 'E001');
    select('U002', 'E001');
    select('U003', 'E001');
    select('U004', 'E001');
    select('U002', null); // U002는 떠남
    select('U001', null);
    expect(holder()).toBe('U003');
    select('U003', null);
    expect(holder()).toBe('U004');
  });

  it('권한 보유자의 연결이 끊기면 서버가 해제하고 기다리던 사용자에게 넘긴다', () => {
    select('U001', 'E001');
    select('U002', 'E001');
    engine.disconnect('U001');
    step();
    expect(holder()).toBe('U002');
  });

  it('기다리던 사람이 없으면 권한은 비고, 처음 선택한 사람이 다시 받는다', () => {
    select('U001', 'E001');
    select('U001', null);
    expect(holder()).toBeNull();
    select('U002', 'E001');
    expect(holder()).toBe('U002');
  });
});

describe('서로 막히는 상태가 생기지 않는다 (회귀)', () => {
  it('새로 추가하고 바로 입력하는 요소도 서버 ID를 받으면 편집 권한을 받는다 → 다른 사용자는 선택만 된다', () => {
    const r = port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'text' });
    const tempId = r.ok ? r.createdElementId! : '';
    // 화면의 afterCreateSelection과 같은 상태: 선택 + 바로 편집
    port.updateLocal('U001', { selectedElementId: tempId, selectedPropertyPath: 'content', localSelection: { editingElementId: tempId } });
    step();
    const realId = world().clients.U001.replica.selectedElementId!;
    const blockId = world().clients.U001.replica.documentView.elements[realId].blockId;
    port.dispatch('U001', { type: 'editProperty', blockId, propertyPath: 'content', value: '새 글', gestureId: 'g' });
    step();
    const claim = claimLockKey('T001', realId);
    const owner = () => (world().redis[claim] as unknown as { value?: { userId?: string } } | undefined)?.value?.userId ?? null;
    expect(owner()).toBe('U001');
    select('U002', realId);
    expect(owner()).toBe('U001');
    port.dispatch('U001', { type: 'editProperty', blockId, propertyPath: 'content', value: '새 글 계속', gestureId: 'g' });
    step();
    expect((world().redis['live:block:' + blockId] as unknown as { value: { content: { body: string } } }).value.content.body).toBe('새 글 계속');
  });

  it('다른 사용자가 속성 Lock을 가지고 있으면 비어 있는 편집 권한도 주지 않고 기다리게 한다. 그 Lock이 풀리면 넘긴다', () => {
    // 선택 없이 편집 (속성 Lock만 보유)
    type('U001', 'U1 입력');
    select('U002', 'E001');
    expect(holder()).toBeNull();
    expect(events('PROPERTY_LOCK_DENIED').map((e) => [e.actorUserId, e.target])).toEqual([['U002', CLAIM]]);
    // U1의 content Lock이 TTL로 풀리면 기다리던 U2가 받는다
    engine.advanceBy(10_000);
    expect(holder()).toBe('U002');
    expect(events('LOCK_HANDOFF').map((e) => e.actorUserId)).toEqual(['U002']);
  });
});

describe('선택 없이 보내는 명령 (시나리오 C 수준)', () => {
  it('아무도 선택하지 않은 요소는 속성 단위 Lock 규칙 그대로 서로 다른 속성을 동시에 편집할 수 있다', () => {
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.fontSize', value: 24 });
    port.dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.color', value: '#ff0000' });
    step();
    expect(events('PROPERTY_LOCK_DENIED')).toHaveLength(0);
    expect((world().redis['live:block:B001'] as unknown as { value: { content: { style: object } } }).value.content.style).toMatchObject({ fontSize: 24, color: '#ff0000' });
  });
});
