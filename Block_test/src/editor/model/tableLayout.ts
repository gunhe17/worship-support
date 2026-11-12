import type { BlockView, ElementView } from './documentModel';

/**
 * 표 레이아웃: 표의 크기는 사용자가 조절하지 않고 행·열 수로 정해진다.
 * 요소 크기(size.width/height) = 열 수 × 열 너비, 행 수 × 행 높이 → 선택 영역이 곧 표 영역이다.
 */
export const TABLE_COL_WIDTH = 180;
export const TABLE_ROW_HEIGHT = 44;

export type TableData = string[][];

export const isTableBlock = (block: BlockView | undefined): boolean => block?.kind === 'table';

/** 블록 콘텐츠의 data를 직사각형 문자열 배열로 정규화 */
export function tableData(block: BlockView | undefined): TableData {
  const raw = (block?.content as { data?: unknown } | undefined)?.data;
  const rows = Array.isArray(raw) ? raw.map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c : c == null ? '' : String(c))) : [])) : [];
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const filled = rows.length ? rows : [['']];
  return filled.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ''));
}

export function tableSize(data: TableData): { width: number; height: number } {
  const cols = Math.max(1, ...data.map((r) => r.length));
  return { width: cols * TABLE_COL_WIDTH, height: Math.max(1, data.length) * TABLE_ROW_HEIGHT };
}

/** 화면에 쓰는 요소 크기: 표는 데이터로 계산한 크기, 그 외는 저장된 size */
export function elementSize(el: ElementView, block: BlockView | undefined): { width: number; height: number } {
  return isTableBlock(block) ? tableSize(tableData(block)) : el.props.size;
}

export const setCell = (data: TableData, r: number, c: number, text: string): TableData =>
  data.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? text : cell)) : row));

export const addRow = (data: TableData): TableData => [...data, Array(Math.max(1, data[0]?.length ?? 1)).fill('')];

export const addColumn = (data: TableData): TableData => data.map((r) => [...r, '']);
