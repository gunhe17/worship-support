import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { hasVersionChanges } from '../../src/engine/versionState';

/** "버전 저장" 버튼 활성화: 마지막 버전 이후 바뀐 것이 있을 때만 (서버 NO_CHANGES 판정과 같은 기준) */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => {
  const r = port.dispatch(actor, intent);
  run();
  return r;
};
const changed = () => hasVersionChanges(world(), 'T001');
const versionCount = () => world().tables.template_version.filter((v) => v.template_id === 'T001').length;
const save = () => dispatch('U001', { type: 'save', templateId: 'T001' });

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
});

describe('버전 저장 버튼 활성화', () => {
  it('시드 직후에는 바뀐 것이 없다 (저장해도 NO_CHANGES)', () => {
    expect(changed()).toBe(false);
    save();
    expect(versionCount()).toBe(1);
  });

  it.each([
    ['텍스트 수정', () => dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '바뀜' })],
    ['배치 수정', () => dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 150 } })],
    ['요소 추가', () => dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' })],
  ])('%s 하면 활성화되고, 저장하면 다시 비활성화된다', (_label, change) => {
    change();
    expect(changed()).toBe(true);
    save();
    expect(versionCount()).toBe(2);
    expect(changed()).toBe(false);
  });

  it('수정했다가 원래 값으로 되돌리면 다시 비활성화된다', () => {
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '바뀜' });
    expect(changed()).toBe(true);
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '안녕하세요' });
    expect(changed()).toBe(false);
    save();
    expect(versionCount()).toBe(1);
  });

  it('판정과 서버 결과가 일치한다: 비활성일 때 저장하면 버전이 생기지 않는다', () => {
    dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
    save();
    const before = versionCount();
    expect(changed()).toBe(false);
    save();
    expect(versionCount()).toBe(before);
  });
});
