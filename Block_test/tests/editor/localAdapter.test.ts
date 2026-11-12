import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalAdapter } from '../../src/editor/adapters/localAdapter';
import { elementsOf } from '../../src/editor/model/documentModel';
import type { EditorPort } from '../../src/editor/model/intents';
import { renderView } from '../../src/editor/model/replica';
import type { Store } from '../../src/editor/store/createStore';
import { createEditorStore, switchViewer, type EditorState } from '../../src/editor/store/editorState';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { createSeedTables } from '../../src/engine/seed';
import { BLOCK_KINDS } from '../../src/engine/types';

let engine: SimulationEngine;
let store: Store<EditorState>;
let port: EditorPort;
const replica = (id: string) => engine.store.getState().clients[id].replica;
const viewOf = (id: string) => renderView(replica(id));

beforeEach(() => {
  engine = createSimulationEngine();
  store = createEditorStore(engine);
  port = createLocalAdapter(store, engine);
});

describe('다중 사용자 시점 (Phase 1, Local Adapter)', () => {
  it('4명 모두 T001에 접속한 상태로 시작한다', () => {
    const replicas = Object.values(engine.store.getState().clients).map((c) => c.replica);
    expect(replicas).toHaveLength(4);
    expect(replicas.every((r) => r.viewingTemplateId === 'T001' && r.connectionStatus === 'connected')).toBe(true);
  });

  it('MU-4: U003과 U004의 선택 상태는 서로 간섭하지 않는다', () => {
    const created = port.dispatch('U004', { type: 'addElement', templateId: 'T001', kind: 'image' });
    expect(created.ok).toBe(true);
    port.updateLocal('U003', { selectedElementId: 'E001', selectedPropertyPath: 'content' });
    port.updateLocal('U004', { selectedElementId: (created as { createdElementId: string }).createdElementId });
    expect(replica('U003').selectedElementId).toBe('E001');
    expect(replica('U003').selectedPropertyPath).toBe('content');
    expect(replica('U004').selectedElementId).toMatch(/^local-E/);
    expect(replica('U004').selectedPropertyPath).toBeNull();
  });

  it('MU-5: 시점 전환 후에도 이전 사용자의 편집 상태가 보존된다', () => {
    port.updateLocal('U001', { selectedElementId: 'E001', selectedPropertyPath: 'style.fontSize', cursorPosition: { x: 10, y: 20 } });
    const before = replica('U001');
    switchViewer(store, 'U002');
    port.updateLocal('U002', { selectedElementId: null });
    switchViewer(store, 'U001');
    expect(store.getState().viewerId).toBe('U001');
    expect(replica('U001').selectedElementId).toBe(before.selectedElementId);
    expect(replica('U001').selectedPropertyPath).toBe('style.fontSize');
    expect(replica('U001').cursorPosition).toEqual({ x: 10, y: 20 });
  });

  it('시점 전환은 공유 상태를 변경하지 않는다', () => {
    const live = store.getState().live;
    switchViewer(store, 'U003');
    expect(store.getState().live).toBe(live);
  });

  it('한 사용자의 편집이 공유 상태를 통해 다른 replica에 반영된다 (선택은 공유하지 않음)', () => {
    port.updateLocal('U001', { selectedElementId: 'E001' });
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '안녕하세요!' });
    for (const id of ['U002', 'U003', 'U004']) {
      expect(viewOf(id).blocks.B001.content.body).toBe('안녕하세요!');
      expect(replica(id).lastReceivedRevision['block:B001']).toBe(1);
      expect(replica(id).selectedElementId).toBeNull();
    }
  });

  it('DB(tables)와 Redis live:*는 Local Adapter 편집으로 변경되지 않는다', () => {
    const redisBefore = engine.store.getState().redis;
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    engine.runUntilIdle();
    expect(engine.store.getState().tables).toEqual(createSeedTables());
    expect(engine.store.getState().redis['live:block:B001']).toBe(redisBefore['live:block:B001']);
    expect(engine.store.getState().dbChanges).toHaveLength(0);
  });
});

describe('편집 intent', () => {
  it('텍스트, 스타일, 배치가 각각 block content / element props에 반영된다', () => {
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.fontSize', value: 24 });
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    const v = viewOf('U002');
    expect(v.blocks.B001.content.style).toEqual({ fontSize: 24, color: '#000000' });
    expect(v.elements.E001.props.position.y).toBe(300);
    expect(v.templates.T001.revision).toBe(1);
  });

  it('10종 요소를 모두 추가할 수 있다', () => {
    for (const kind of BLOCK_KINDS) {
      expect(port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind }).ok).toBe(true);
    }
    const els = elementsOf(viewOf('U001'), 'T001');
    expect(els).toHaveLength(11);
    expect(els.map((e) => e.sequence)).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
  });

  it('순서 변경은 sequence를 다시 매긴다', () => {
    const r = port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' });
    const id = (r as { createdElementId: string }).createdElementId;
    port.dispatch('U001', { type: 'reorderElement', templateId: 'T001', elementId: id, toIndex: 0 });
    expect(elementsOf(viewOf('U002'), 'T001').map((e) => e.elementId)).toEqual([id, 'E001']);
  });

  it('저장은 엔진 미연결 상태를 명시적으로 반환한다', () => {
    expect(port.dispatch('U001', { type: 'save', templateId: 'T001' })).toMatchObject({ ok: false, code: 'ENGINE_NOT_CONNECTED' });
  });

  it('삭제된 요소를 선택하던 다른 사용자의 선택은 해제된다', () => {
    port.updateLocal('U002', { selectedElementId: 'E001' });
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    expect(replica('U002').selectedElementId).toBeNull();
    // 블록은 삭제하지 않는다
    expect(viewOf('U002').blocks.B001).toBeDefined();
  });
});

describe('Undo/Redo (§8.4)', () => {
  it('같은 gesture의 연속 입력은 하나의 Undo 항목으로 묶인다', () => {
    for (const v of ['안', '안녕', '안녕!']) {
      port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: v, gestureId: 'g1' });
    }
    expect(replica('U001').undoStack).toHaveLength(1);
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true);
    expect(viewOf('U003').blocks.B001.content.body).toBe('안녕하세요');
    expect(port.dispatch('U001', { type: 'redo' }).ok).toBe(true);
    expect(viewOf('U003').blocks.B001.content.body).toBe('안녕!');
  });

  it('MU-9: 다른 사용자가 먼저 변경한 속성은 UNDO_CONFLICT로 처리되고 덮어쓰지 않는다', () => {
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'U001 값' });
    port.dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'U002 값' });
    const r = port.dispatch('U001', { type: 'undo' });
    expect(r).toMatchObject({ ok: false, code: 'UNDO_CONFLICT' });
    expect(viewOf('U001').blocks.B001.content.body).toBe('U002 값');
    expect(replica('U001').undoStack).toHaveLength(0);
  });

  it('다른 속성의 변경은 Undo 충돌을 일으키지 않는다', () => {
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.fontSize', value: 24 });
    port.dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.color', value: '#ff0000' });
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true);
    expect(viewOf('U002').blocks.B001.content.style).toEqual({ fontSize: 16, color: '#ff0000' });
  });

  it('MU-10 (로컬): 삭제 Undo는 ELEMENT_RESTORE로 같은 위치/순서에 복원된다', () => {
    const r = port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'list' });
    const id = (r as { createdElementId: string }).createdElementId;
    port.dispatch('U001', { type: 'deleteElement', templateId: 'T001', elementId: 'E001' });
    expect(viewOf('U002').elements.E001).toBeUndefined();
    expect(port.dispatch('U001', { type: 'undo' }).ok).toBe(true);
    const els = elementsOf(viewOf('U002'), 'T001');
    expect(els.map((e) => e.elementId)).toEqual(['E001', id]);
    expect(els[0].props.position).toEqual({ x: 100, y: 100 });
  });

  it('추가 Undo 후 Redo는 같은 요소 ID로 복원된다', () => {
    const r = port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'table' });
    const id = (r as { createdElementId: string }).createdElementId;
    port.dispatch('U001', { type: 'undo' });
    expect(viewOf('U001').elements[id]).toBeUndefined();
    port.dispatch('U001', { type: 'redo' });
    expect(viewOf('U001').elements[id]).toBeDefined();
    port.dispatch('U001', { type: 'undo' });
    expect(viewOf('U001').elements[id]).toBeUndefined();
  });

  it('Undo 스택은 사용자별로 독립적이다', () => {
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'a' });
    expect(port.dispatch('U002', { type: 'undo' })).toMatchObject({ ok: false, code: 'NOTHING_TO_UNDO' });
  });
});
