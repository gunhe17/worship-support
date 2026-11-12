import { describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import { kindDef } from '../../src/editor/model/elementRegistry';
import { addColumn, addRow, setCell, TABLE_COL_WIDTH, TABLE_ROW_HEIGHT, tableData, tableSize } from '../../src/editor/model/tableLayout';
import { createSimulationEngine } from '../../src/engine/engine';

describe('표 레이아웃: 크기 = 행·열 수', () => {
  it('기본 표의 크기는 기본 데이터로 계산한 크기와 같다', () => {
    const def = kindDef('table');
    expect(tableSize(def.defaultContent().data as string[][])).toEqual(def.defaultSize);
  });

  it('행·열 추가와 셀 편집', () => {
    const data = [['a', 'b'], ['c', 'd']];
    expect(addRow(data)).toEqual([['a', 'b'], ['c', 'd'], ['', '']]);
    expect(addColumn(data)).toEqual([['a', 'b', ''], ['c', 'd', '']]);
    expect(setCell(data, 1, 0, 'x')).toEqual([['a', 'b'], ['x', 'd']]);
    expect(tableSize(addColumn(addRow(data)))).toEqual({ width: 3 * TABLE_COL_WIDTH, height: 3 * TABLE_ROW_HEIGHT });
  });

  it('들쭉날쭉하거나 비어 있는 데이터를 직사각형으로 정규화한다', () => {
    const block = (data: unknown) => ({ blockId: 'B', kind: 'table', content: { data }, revision: 1, properties: {} }) as never;
    expect(tableData(block([['a'], ['b', 'c']]))).toEqual([['a', ''], ['b', 'c']]);
    expect(tableData(block(undefined))).toEqual([['']]);
  });
});

describe('표 행 추가: 데이터와 크기를 같은 gesture로 보낸다', () => {
  it('Undo 한 번에 data와 size가 함께 되돌아가고, 서버 Live 값도 맞춰진다', () => {
    const engine = createSimulationEngine();
    const port = createEngineAdapter(engine);
    const r = port.dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'table', position: { x: 40, y: 400 } });
    engine.advanceBy(200);
    const view = () => engine.store.getState().clients.U001.replica.documentView;
    const el = Object.values(view().elements).find((e) => view().blocks[e.blockId]?.kind === 'table')!;
    expect(r.ok).toBe(true);
    const next = addRow(tableData(view().blocks[el.blockId]));
    // useEditTable과 같은 순서: data → size, 같은 gestureId
    port.dispatch('U001', { type: 'editProperty', blockId: el.blockId, propertyPath: 'data', value: next, gestureId: 'g1' });
    port.dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: el.elementId, changes: tableSizeChanges(next), gestureId: 'g1' });
    engine.advanceBy(200);
    expect(view().elements[el.elementId].props.size).toEqual(tableSize(next));
    expect(engine.store.getState().clients.U002.replica.documentView.elements[el.elementId].props.size).toEqual(tableSize(next));

    port.dispatch('U001', { type: 'undo' });
    engine.advanceBy(200);
    expect(tableData(view().blocks[el.blockId])).toHaveLength(3);
    expect(view().elements[el.elementId].props.size).toEqual(kindDef('table').defaultSize);
  });
});

const tableSizeChanges = (data: string[][]) => {
  const s = tableSize(data);
  return { 'size.width': s.width, 'size.height': s.height };
};
