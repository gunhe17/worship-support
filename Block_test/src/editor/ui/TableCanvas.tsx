import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { BlockView } from '../model/documentModel';
import { setCell, TABLE_ROW_HEIGHT, tableData, type TableData } from '../model/tableLayout';
import { Icon } from './icons';
import styles from './stage.module.css';
import { newTableGesture } from './useEditTable';

export type CellPos = { r: number; c: number };

/**
 * 캔버스 위의 표. 셀을 그 자리에서 편집하고(노션처럼), 마우스를 올리면 오른쪽(열 추가)·아래쪽(행 추가) 버튼이 보인다.
 * 표 크기는 행·열 수로 정해지므로 크기 조절 핸들은 없다.
 */
export function TableCanvas({
  block,
  editingCell,
  onEditCell,
  onExit,
  onChange,
  addControls,
  onAddRow,
  onAddColumn,
}: {
  block: BlockView;
  /** 편집 중인 셀 (편집 중이 아니면 null) */
  editingCell: CellPos | null;
  onEditCell: (cell: CellPos) => void;
  onExit: () => void;
  onChange: (data: TableData, gestureId: string) => void;
  /** 행·열 추가 버튼 표시 상태 */
  addControls: { visible: boolean; canAddRow: boolean; canAddColumn: boolean; disabledReason?: string };
  onAddRow: () => void;
  onAddColumn: () => void;
}) {
  const data = tableData(block);
  const rows = data.length;
  const cols = data[0].length;

  // 셀 하나를 편집하는 동안의 입력은 한 gesture(Undo 한 번)로 묶는다
  const gesture = useRef<{ key: string; id: string } | null>(null);
  const gestureFor = (cell: CellPos) => {
    const key = `${cell.r},${cell.c}`;
    if (gesture.current?.key !== key) gesture.current = { key, id: newTableGesture() };
    return gesture.current.id;
  };
  useEffect(() => {
    if (!editingCell) gesture.current = null;
  }, [editingCell]);
  // 셀 이동 중 이전 입력창이 사라지며 생기는 blur는 편집 종료가 아니다
  const switching = useRef(false);
  const goTo = (cell: CellPos) => {
    switching.current = true;
    onEditCell(cell);
    setTimeout(() => (switching.current = false), 0);
  };

  const move = (cell: CellPos, dr: number, dc: number) => {
    let r = cell.r + dr;
    let c = cell.c + dc;
    if (c >= cols) (c = 0), (r += 1);
    if (c < 0) (c = cols - 1), (r -= 1);
    if (r < 0 || r >= rows) return onExit();
    goTo({ r, c });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, cell: CellPos) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 무시
    if (e.key === 'Escape') {
      e.preventDefault();
      onExit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      move(cell, 1, 0);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      move(cell, 0, e.shiftKey ? -1 : 1);
    } else if (e.key === 'ArrowUp' && cell.r > 0) {
      e.preventDefault();
      move(cell, -1, 0);
    } else if (e.key === 'ArrowDown' && cell.r < rows - 1) {
      e.preventDefault();
      move(cell, 1, 0);
    }
  };

  const stop = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    e.stopPropagation();
    e.preventDefault();
  };

  return (
    <div className={styles.tableWrap} data-editing={!!editingCell}>
      {/* 요소 영역 = 열 수 × TABLE_COL_WIDTH, 행 수 × TABLE_ROW_HEIGHT. 셀은 균등 분할 */}
      <div className={styles.tableFrame}>
      <table className={styles.tableGrid}>
        <tbody>
          {data.map((row, r) => (
            <tr key={r} style={{ height: TABLE_ROW_HEIGHT }}>
              {row.map((cell, c) => {
                const Cell = r === 0 ? 'th' : 'td';
                const active = editingCell?.r === r && editingCell.c === c;
                return (
                  <Cell
                    key={c}
                    data-cell={`${r},${c}`}
                    data-active={active || undefined}
                    // 편집 중에는 다른 셀을 누르면 그 셀로 이동한다 (포커스 유지, 요소 드래그 없음)
                    onMouseDown={editingCell ? (e) => !active && e.preventDefault() : undefined}
                    onPointerDown={
                      editingCell
                        ? (e) => {
                            e.stopPropagation();
                            if (!active) goTo({ r, c });
                          }
                        : undefined
                    }
                  >
                    {active ? (
                      <input
                        className={styles.cellInput}
                        autoFocus
                        // 셀에 들어가면 내용을 전체 선택한다: 바로 입력하면 교체, 방향키로 이어 쓰기
                        onFocus={(e) => e.currentTarget.select()}
                        value={cell}
                        aria-label={`셀 ${r + 1}행 ${c + 1}열`}
                        onChange={(e) => onChange(setCell(data, r, c, e.target.value), gestureFor({ r, c }))}
                        onKeyDown={(e) => onKeyDown(e, { r, c })}
                        onBlur={() => !switching.current && onExit()}
                      />
                    ) : (
                      cell || <span className={styles.cellPlaceholder}>{r === 0 ? '머리글' : ''}</span>
                    )}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {addControls.visible && (
        <>
          <button
            type="button"
            className={styles.tableAddColumn}
            disabled={!addControls.canAddColumn}
            title={addControls.disabledReason ?? (addControls.canAddColumn ? '열 추가' : '페이지 너비를 넘어 열을 추가할 수 없습니다')}
            aria-label="열 추가"
            onPointerDown={stop}
            onMouseDown={stop}
            onDoubleClick={stop}
            onClick={onAddColumn}
          >
            <Icon name="plus" size={12} />
          </button>
          <button
            type="button"
            className={styles.tableAddRow}
            disabled={!addControls.canAddRow}
            title={addControls.disabledReason ?? (addControls.canAddRow ? '행 추가' : '페이지 높이를 넘어 행을 추가할 수 없습니다')}
            aria-label="행 추가"
            onPointerDown={stop}
            onMouseDown={stop}
            onDoubleClick={stop}
            onClick={onAddRow}
          >
            <Icon name="plus" size={12} />
          </button>
        </>
      )}
    </div>
  );
}
