import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { createEditorStore, switchViewer } from '../../src/editor/store/editorState';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';

/**
 * Lock 해제 시점 (DB_SCHEMA §8.10.5, v1.2.5):
 * 편집 중인 사용자가 그 요소에서 나갈 때(다른 요소 선택, 빈 곳 클릭·선택 해제, 템플릿 전환) 해제한다.
 * 입력 포커스 해제·인라인 편집 종료·드래그 종료·시점 전환은 해제 사유가 아니다. TTL 만료(§7.5)는 그대로다.
 */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const events = (name: string) => world().events.filter((e) => e.name === name);
const locks = () => engine.internals.redis.keys('lock:*');
const run = () => engine.advanceBy(200);
const dispatch = (actor: string, intent: EditorIntent) => port.dispatch(actor, intent);
const editContent = (actor: string, value: string) => dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value });

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
  port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' }); // 다른 요소 E002
  run();
});

/** 화면 조작 흐름: 요소 선택 → 인라인 편집 시작 → 입력 → 편집 종료(blur/Esc, 선택은 유지) */
function editAndExit(actor: string, value: string) {
  port.updateLocal(actor, { selectedElementId: 'E001', selectedPropertyPath: 'content', localSelection: { editingElementId: 'E001' } });
  editContent(actor, value);
  run();
  port.updateLocal(actor, { selectedPropertyPath: null, localSelection: { editingElementId: null } });
  run();
}

describe('요소에 머무는 동안 Lock 유지', () => {
  it('인라인 편집을 끝내도(포커스 해제) 요소를 선택하고 있으면 Lock을 유지하고, 다른 사용자의 같은 속성 편집은 거부된다', () => {
    editAndExit('U001', 'U001 편집');
    expect(events('PROPERTY_LOCK_RELEASE')).toHaveLength(0);
    expect(locks()).toContain('lock:block:B001:content');
    editContent('U002', 'U002 편집');
    run();
    expect(events('PROPERTY_LOCK_DENIED')).toEqual([expect.objectContaining({ actorUserId: 'U002' })]);
    expect(world().clients.U002.replica.documentView.blocks.B001.content.body).toBe('U001 편집');
  });

  // v1.2.8 (§7.5.1): 요소를 선택한 사용자가 요소 전체 편집 권한을 가지므로, 같은 요소의 다른 속성도 다른 사용자는 바꿀 수 없다
  it('요소를 선택한 사용자가 편집 권한을 가지므로 같은 요소의 다른 속성도 다른 사용자는 편집할 수 없다', () => {
    editAndExit('U001', 'U001 편집');
    dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.color', value: '#ff0000' });
    run();
    expect(events('PROPERTY_LOCK_DENIED').map((e) => [e.actorUserId, e.target])).toEqual([['U002', 'lock:block:B001:style.color']]);
    expect(events('PROPERTY_LOCK_GRANTED').map((e) => [e.actorUserId, e.target])).toEqual([
      ['U001', 'lock:template:T001:element:E001:edit'],
      ['U001', 'lock:block:B001:content'],
    ]);
    expect(world().clients.U001.replica.documentView.blocks.B001.content.style).toMatchObject({ color: '#000000' });
  });

  it('드래그·리사이즈를 마쳐도 요소를 선택하고 있으면 배치 Lock을 유지한다', () => {
    port.updateLocal('U001', { selectedElementId: 'E001' });
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    run();
    expect(locks()).toContain('lock:template:T001:element:E001:position.y');
    dispatch('U002', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 500 } });
    run();
    expect(events('PROPERTY_LOCK_DENIED')).toEqual([expect.objectContaining({ actorUserId: 'U002', target: 'lock:template:T001:element:E001:position.y' })]);
  });
});

describe('요소에서 나가면 Lock 해제', () => {
  it.each([
    ['빈 곳 클릭 (선택 해제)', { selectedElementId: null }],
    ['다른 요소 선택', { selectedElementId: 'E002' }],
  ])('%s → PROPERTY_LOCK_RELEASE, 이후 다른 사용자가 획득', (_label, patch) => {
    editAndExit('U001', 'U001 편집');
    port.updateLocal('U001', patch);
    run();
    // 콘텐츠 Lock과 요소 편집 권한(v1.2.8)을 함께 해제한다
    expect(events('PROPERTY_LOCK_RELEASE').map((e) => [e.actorUserId, e.result, e.target]).sort()).toEqual([
      ['U001', 'OK', 'lock:block:B001:content'],
      ['U001', 'OK', 'lock:template:T001:element:E001:edit'],
    ]);
    expect(locks().filter((k) => !k.startsWith('lock:template:T001:element:E002:'))).toEqual([]);
    editContent('U002', 'U002 편집');
    run();
    expect(events('PROPERTY_LOCK_DENIED')).toHaveLength(0);
    expect(world().clients.U001.replica.documentView.blocks.B001.content.body).toBe('U002 편집');
  });

  it('요소의 콘텐츠·배치 Lock을 함께 해제한다', () => {
    port.updateLocal('U001', { selectedElementId: 'E001' });
    editContent('U001', 'x');
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 150, 'size.width': 320 } });
    run();
    // 콘텐츠 1 + 배치 2 + 요소 편집 권한 1 (v1.2.8)
    expect(locks()).toHaveLength(4);
    expect(locks()).toContain('lock:template:T001:element:E001:edit');
    port.updateLocal('U001', { selectedElementId: null });
    run();
    expect(events('PROPERTY_LOCK_RELEASE')).toHaveLength(4);
    expect(locks()).toEqual([]);
  });

  it('선택 상태가 바뀌지 않는 로컬 변경(커서 이동, 속성 포커스)은 해제 사유가 아니다', () => {
    editAndExit('U001', 'x');
    port.updateLocal('U001', { cursorPosition: { x: 10, y: 10 } });
    port.updateLocal('U001', { selectedPropertyPath: 'style.fontSize' });
    port.updateLocal('U001', { selectedPropertyPath: null });
    run();
    expect(events('PROPERTY_LOCK_RELEASE')).toHaveLength(0);
  });
});

describe('편집 중인 요소의 삭제 차단 (ELEMENT_LOCKED)', () => {
  const del = (actor: string) => dispatch(actor, { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
  const alive = () => !!world().clients.U002.replica.documentView.elements.E001;

  it('다른 사용자가 content Lock을 보유하면 삭제는 서버에서 거부되고 요소는 남는다', () => {
    editAndExit('U001', 'U001 편집');
    del('U002');
    run();
    expect(events('STRUCTURE_UPDATE_REJECTED')).toEqual([expect.objectContaining({ actorUserId: 'U002', resultDetail: 'ELEMENT_LOCKED' })]);
    expect(engine.internals.db.get('template_element', { id: 'E001' })?.deleted_at).toBeNull();
    expect(alive()).toBe(true);
    expect(world().clients.U001.replica.documentView.elements.E001).toBeDefined();
  });

  it('다른 사용자가 배치 Lock을 보유해도 삭제는 거부된다', () => {
    port.updateLocal('U001', { selectedElementId: 'E001' });
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    run();
    del('U002');
    run();
    expect(events('STRUCTURE_UPDATE_REJECTED').map((e) => e.resultDetail)).toEqual(['ELEMENT_LOCKED']);
    expect(alive()).toBe(true);
  });

  it('편집 중인 사용자가 요소에서 나간 뒤에는 삭제할 수 있다', () => {
    editAndExit('U001', 'x');
    port.updateLocal('U001', { selectedElementId: null });
    run();
    del('U002');
    run();
    expect(events('STRUCTURE_UPDATE_REJECTED')).toHaveLength(0);
    expect(alive()).toBe(false);
  });

  it('자신이 보유한 Lock은 삭제를 막지 않는다', () => {
    editAndExit('U001', 'x');
    del('U001');
    run();
    expect(events('STRUCTURE_UPDATE_REJECTED')).toHaveLength(0);
    expect(alive()).toBe(false);
  });
});

describe('시점 전환과 TTL', () => {
  it('시점 전환은 Lock을 해제하지 않고 네트워크 이벤트를 만들지 않는다', () => {
    const store = createEditorStore(engine);
    editAndExit('U001', 'U001 편집');
    const before = { events: world().events.length, presence: world().presenceEvents.length };
    switchViewer(store, 'U002');
    switchViewer(store, 'U001');
    run();
    expect(world().events).toHaveLength(before.events);
    expect(world().presenceEvents).toHaveLength(before.presence);
    expect(locks()).toContain('lock:block:B001:content');
    expect(world().clients.U001.replica.selectedElementId).toBe('E001');
  });

  it('요소를 선택한 채 10초 동안 수정이 없으면 속성 Lock은 TTL 만료로 해제된다 (§7.5 유지). 요소 편집 권한은 선택하는 동안 유지된다 (v1.2.8)', () => {
    editAndExit('U001', 'x');
    engine.advanceBy(10_000);
    expect(events('LOCK_EXPIRED').map((e) => e.target)).toEqual(['lock:block:B001:content']);
    expect(locks()).toEqual(['lock:template:T001:element:E001:edit']);
  });
});
