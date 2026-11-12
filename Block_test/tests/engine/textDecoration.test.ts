import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { decorationShortcut } from '../../src/editor/model/textDecoration';
import { findPropertyDef } from '../../src/editor/model/elementRegistry';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';

/** v1.2.6 글자 꾸밈 (DB_SCHEMA §8.6): style.bold·italic·underline·strikethrough */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => {
  const r = port.dispatch(actor, intent);
  run();
  return r;
};
const edit = (actor: string, path: string, value: boolean) =>
  dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath: path, value });
const pgStyle = () => (world().tables.block_live_state.find((r) => r.block_id === 'B001')!.content as { style: Record<string, unknown> }).style;

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
});

describe('글자 꾸밈 속성', () => {
  it('레지스트리: text·title 모두 네 가지 꾸밈을 style.* 경로로 가진다. 제목만 기본 굵게', () => {
    for (const path of ['style.bold', 'style.italic', 'style.underline', 'style.strikethrough']) {
      expect(findPropertyDef('text', path)).toMatchObject({ jsonPath: path, control: 'toggle', fallback: false });
      expect(findPropertyDef('title', path)?.jsonPath).toBe(path);
    }
    expect(findPropertyDef('title', 'style.bold')?.fallback).toBe(true);
  });

  it('켜면 block_live_state.content.style에 저장되고, 버전 저장 시 block_text.style에 남는다', () => {
    edit('U001', 'style.bold', true);
    edit('U001', 'style.underline', true);
    expect(pgStyle()).toMatchObject({ bold: true, underline: true });
    dispatch('U001', { type: 'save', templateId: 'T001' });
    const current = world().tables.block.find((b) => b.id === 'B001')!.current_version_id;
    const row = world().tables.block_text.find((r) => r.id === current)!;
    expect(row.style).toMatchObject({ bold: true, underline: true, fontSize: 16, color: '#000000' });
  });

  it('항목마다 Lock이 따로라서 두 사용자가 굵게·기울임을 동시에 바꿀 수 있다', () => {
    port.dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.bold', value: true });
    port.dispatch('U002', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.italic', value: true });
    run();
    expect(pgStyle()).toMatchObject({ bold: true, italic: true });
  });

  it('끄면 false로 저장된다 (Undo로도 되돌릴 수 있다)', () => {
    edit('U001', 'style.italic', true);
    edit('U001', 'style.italic', false);
    expect(pgStyle().italic).toBe(false);
    edit('U001', 'style.strikethrough', true);
    dispatch('U001', { type: 'undo' });
    expect(pgStyle().strikethrough ?? false).toBe(false);
  });

  it('단축키 판정: ⌘B·⌘I·⌘U·⌘⇧X', () => {
    const k = (key: string, shiftKey = false) => decorationShortcut({ key, metaKey: true, ctrlKey: false, shiftKey, altKey: false });
    expect([k('b'), k('i'), k('u'), k('x', true)]).toEqual(['style.bold', 'style.italic', 'style.underline', 'style.strikethrough']);
    expect(k('x')).toBeNull();
    expect(decorationShortcut({ key: 'b', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBeNull();
  });
});
