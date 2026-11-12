import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import { hasVersionChanges } from '../../src/engine/versionState';

/** v1.2.7 템플릿 이름 변경 TEMPLATE_RENAME (DB_SCHEMA §8.8.1) + 복제·붙여넣기용 addElement(content·size) */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => {
  const r = port.dispatch(actor, intent);
  run();
  return r;
};
const pgName = () => world().tables.template.find((t) => t.id === 'T001')!.name;
const viewName = (u: string) => world().clients[u].replica.documentView.templates.T001.name;
const rename = (actor: string, name: string) => dispatch(actor, { type: 'renameTemplate', templateId: 'T001', name });

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
});

describe('템플릿 이름 변경', () => {
  it('template.name을 바로 저장하고 모든 접속자에게 전파한다', () => {
    expect(rename('U001', '  내 소개 페이지  ').ok).toBe(true);
    expect(pgName()).toBe('내 소개 페이지');
    for (const u of ['U001', 'U002', 'U003', 'U004']) expect(viewName(u)).toBe('내 소개 페이지');
    const events = world().events.map((e) => e.name);
    expect(events).toContain('TEMPLATE_RENAME');
    expect(events).toContain('STRUCTURE_UPDATE_ACK');
  });

  it('빈 이름·60자 초과는 보내지 않는다 (INVALID_NAME)', () => {
    expect(rename('U001', '   ')).toMatchObject({ ok: false, code: 'INVALID_NAME' });
    expect(rename('U001', 'a'.repeat(61))).toMatchObject({ ok: false, code: 'INVALID_NAME' });
    expect(pgName()).toBe('자기소개 템플릿');
  });

  it('서버도 길이를 검사해 거부하고 DB를 바꾸지 않는다', () => {
    engine.submitStructure('U001', { opId: 'op-x', actorUserId: 'U001', type: 'TEMPLATE_RENAME', templateId: 'T001', name: ' ', previousName: '자기소개 템플릿' });
    run();
    expect(pgName()).toBe('자기소개 템플릿');
    expect(world().events.some((e) => e.name === 'STRUCTURE_UPDATE_REJECTED' && JSON.stringify(e.payload).includes('INVALID_NAME'))).toBe(true);
  });

  it('Undo로 이전 이름으로 돌아간다', () => {
    rename('U001', '새 이름');
    dispatch('U001', { type: 'undo' });
    expect(pgName()).toBe('자기소개 템플릿');
    expect(viewName('U002')).toBe('자기소개 템플릿');
  });

  it('다른 사용자가 먼저 이름을 바꿨으면 Undo는 충돌한다', () => {
    rename('U001', '사용자1 이름');
    rename('U002', '사용자2 이름');
    expect(dispatch('U001', { type: 'undo' })).toMatchObject({ ok: false, code: 'UNDO_CONFLICT' });
    expect(pgName()).toBe('사용자2 이름');
  });

  it('이름은 버전과 무관하다: 이름만 바꾸면 버전 저장할 것이 없다', () => {
    rename('U001', '버전과 무관');
    expect(hasVersionChanges(world(), 'T001')).toBe(false);
  });
});

describe('붙여넣기·복제 (addElement content·size)', () => {
  it('원본 내용과 크기로 새 요소를 만들고, 같은 gesture면 Undo 한 번에 모두 사라진다', () => {
    const content = { body: '복제된 글', style: { fontSize: 20, color: '#2f6fed', bold: true } };
    const g = 'paste-test';
    dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'text', content, size: { width: 250, height: 40 }, position: { x: 50, y: 500 }, gestureId: g });
    dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'text', content, size: { width: 250, height: 40 }, position: { x: 50, y: 560 }, gestureId: g });
    const live = world().tables.template_live_element.filter((r) => r.template_id === 'T001');
    expect(live).toHaveLength(3);
    const created = live.find((r) => (r.props as { position: { y: number } }).position.y === 500)!;
    expect(created.props).toMatchObject({ size: { width: 250, height: 40 } });
    const blockState = world().tables.block_live_state.find((b) => b.block_id === live.find((r) => r === created)!.block_id)!;
    expect(blockState.content).toEqual(content);
    dispatch('U001', { type: 'undo' });
    expect(world().tables.template_live_element.filter((r) => r.template_id === 'T001')).toHaveLength(1);
  });
});
