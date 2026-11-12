import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { restoredUnchangedVersionId } from '../../src/engine/versionState';

/** 방금 복원한 버전의 복원 버튼: 수정 전까지 비활성, 수정하면 다시 활성 */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => port.dispatch(actor, intent);
const blocked = () => restoredUnchangedVersionId(world(), 'T001');
const versionId = (n: number) => world().tables.template_version.find((v) => v.template_id === 'T001' && v.version === n)!.id as string;
const save = () => {
  dispatch('U001', { type: 'save', templateId: 'T001' });
  run();
};
const restore = (n: number) => {
  dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: versionId(n) });
  run();
};
const edit = (value: string) => {
  dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value });
  run();
};

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
  // seed v1 + 저장 3번 → v1~v4, 현재 v4
  for (const [i, y] of [200, 300, 400].entries()) {
    edit(`버전 ${i + 2}`);
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': y } });
    run();
    save();
  }
  expect(world().tables.template_version.filter((v) => v.template_id === 'T001')).toHaveLength(4);
});

describe('복원 버튼 비활성화', () => {
  it('v4에서 v2를 복원해 v5가 되면 v2 복원 버튼만 비활성화된다', () => {
    expect(blocked()).toBeNull();
    restore(2);
    const current = world().tables.template.find((t) => t.id === 'T001')!.current_version_id;
    expect(world().tables.template_version.find((v) => v.id === current)).toMatchObject({ version: 5, restored_from_version_id: versionId(2) });
    expect(blocked()).toBe(versionId(2));
  });

  it.each([
    ['텍스트 수정', () => edit('복원 후 수정')],
    ['배치 수정', () => (dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 150 } }), run())],
    ['요소 추가', () => (dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' }), run())],
  ])('%s 하면 다시 활성화된다', (_label, change) => {
    restore(2);
    expect(blocked()).toBe(versionId(2));
    change();
    expect(blocked()).toBeNull();
  });

  it('다른 사용자의 수정도 활성화 사유다', () => {
    restore(2);
    dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.color', value: '#ff0000' });
    run();
    expect(blocked()).toBeNull();
  });

  it('일반 저장으로 만든 현재 버전에는 비활성화가 없다', () => {
    restore(2);
    edit('수정');
    save(); // v6 (restored_from 없음)
    expect(blocked()).toBeNull();
  });
});
