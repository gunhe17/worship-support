import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { restoredUnchangedVersionId } from '../../src/engine/versionState';

/** v1.2.9 복원 직전 자동 저장 (DB_SCHEMA §7.8): 바뀐 것이 있으면 지금 상태를 먼저 버전으로 남기고 복원한다 */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => {
  const r = port.dispatch(actor, intent);
  run();
  return r;
};
const versions = () => world().tables.template_version.filter((v) => v.template_id === 'T001').sort((a, b) => (a.version as number) - (b.version as number));
const restore = (versionId: string) => dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId });
const moveTo = (y: number) => dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': y } });
const liveY = () => (world().tables.template_live_element.find((r) => r.template_element_id === 'E001')!.props as { position: { y: number } }).position.y;

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
  moveTo(300);
  dispatch('U001', { type: 'save', templateId: 'T001' }); // v2 (y=300)
});

describe('복원 직전 자동 저장', () => {
  it('저장하지 않은 변경이 있으면 그 상태를 먼저 버전으로 만들고(v3) 복원한다(v4)', () => {
    moveTo(700); // 아직 버전 없음
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '복원 전 글' });
    restore('TV001');
    expect(versions().map((v) => [v.version, v.restored_from_version_id])).toEqual([
      [1, null],
      [2, null],
      [3, null], // 복원 직전 자동 저장
      [4, 'TV001'],
    ]);
    // v3에는 복원 직전의 배치와 글이 그대로 남는다
    const v3 = versions()[2];
    const tve = world().tables.template_version_element.find((r) => r.template_version_id === v3.id)!;
    expect(tve.props).toMatchObject({ position: { y: 700 } });
    const bv = world().tables.block_text.find((r) => r.id === tve.block_version_id)!;
    expect(bv.body).toBe('복원 전 글');
    // 복원 결과: 배치는 v1, 요청자에게 자동 저장 버전도 알린다
    expect(liveY()).toBe(100);
    expect(world().clients.U001.lastVersion).toMatchObject({ kind: 'restore', ok: true, restoredFromVersionId: 'TV001', preservedTemplateVersionId: v3.id, preservedVersion: 3 });
  });

  it('바뀐 것이 없으면 자동 저장 없이 복원 버전 하나만 만든다', () => {
    restore('TV001');
    expect(versions().map((v) => [v.version, v.restored_from_version_id])).toEqual([
      [1, null],
      [2, null],
      [3, 'TV001'],
    ]);
    expect(world().clients.U001.lastVersion).toMatchObject({ kind: 'restore', ok: true });
    expect(world().clients.U001.lastVersion?.preservedVersion).toBeUndefined();
  });

  it('자동 저장한 버전으로 다시 복원하면 복원 직전 배치로 돌아온다', () => {
    moveTo(700);
    restore('TV001');
    const preserved = world().clients.U001.lastVersion!.preservedTemplateVersionId!;
    restore(preserved);
    expect(liveY()).toBe(700);
  });

  it('복원 직후에는 그 버전의 복원 버튼이 비활성이다 (자동 저장이 끼어도 유지)', () => {
    moveTo(700);
    restore('TV001');
    expect(restoredUnchangedVersionId(world(), 'T001')).toBe('TV001');
  });

  it('다른 사용자에게도 자동 저장(TEMPLATE_SAVED)과 복원(STRUCTURE_UPDATED)이 순서대로 전파된다', () => {
    moveTo(700);
    restore('TV001');
    const restoreReq = world().events.find((e) => e.name === 'TEMPLATE_RESTORE')!;
    const after = world().events.filter((e) => e.sequence > restoreReq.sequence);
    expect(after.filter((e) => e.name === 'VERSION_SAVE')).toHaveLength(2);
    expect(after.filter((e) => e.category === 'broadcast').map((e) => e.name)).toEqual(['TEMPLATE_SAVED', 'STRUCTURE_UPDATED']);
    for (const u of ['U002', 'U003', 'U004']) {
      expect(world().clients[u].replica.documentView.elements.E001.props.position.y).toBe(100);
    }
  });
});
