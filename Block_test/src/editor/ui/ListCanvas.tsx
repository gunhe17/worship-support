import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { BlockView } from '../model/documentModel';
import styles from './stage.module.css';

let seq = 0;
const newListGesture = () => `list-${Date.now().toString(36)}-${++seq}`;

export const LIST_ITEM_PLACEHOLDER = '목록 항목';

export function listItems(block: BlockView): string[] {
  const items = (block.content as { items?: unknown }).items;
  const list = Array.isArray(items) ? items.map((v) => (typeof v === 'string' ? v : '')) : [];
  return list.length ? list : [''];
}

/** pointer 이벤트 대상의 목록 항목 번호 */
export const itemOf = (target: EventTarget | null): number | null => {
  const at = (target as HTMLElement | null)?.closest?.('[data-item]')?.getAttribute('data-item');
  return at === null || at === undefined ? null : Number(at);
};

/**
 * 캔버스 위의 목록. 항목을 그 자리에서 편집한다.
 * Enter: 아래에 새 항목 · 빈 항목에서 Backspace: 항목 삭제 · ↑↓: 항목 이동 · Esc: 편집 끝
 */
export function ListCanvas({
  block,
  editingIndex,
  onEditIndex,
  onExit,
  onChange,
}: {
  block: BlockView;
  editingIndex: number | null;
  onEditIndex: (index: number) => void;
  onExit: () => void;
  onChange: (items: string[], gestureId: string) => void;
}) {
  const items = listItems(block);

  // 항목 하나를 편집하는 동안의 입력은 한 gesture(Undo 한 번)로 묶는다
  const gesture = useRef<{ index: number; id: string } | null>(null);
  const gestureFor = (index: number) => {
    if (gesture.current?.index !== index) gesture.current = { index, id: newListGesture() };
    return gesture.current.id;
  };
  useEffect(() => {
    if (editingIndex === null) gesture.current = null;
  }, [editingIndex]);

  // 항목 이동 중 이전 입력창이 사라지며 생기는 blur는 편집 종료가 아니다
  const switching = useRef(false);
  // 이동한 항목에서 커서를 둘 위치 (삭제 후 이전 항목 끝 등)
  const caretEnd = useRef(true);
  const goTo = (index: number) => {
    switching.current = true;
    caretEnd.current = true;
    onEditIndex(index);
    setTimeout(() => (switching.current = false), 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter·Backspace 무시
    const input = e.currentTarget;
    if (e.key === 'Escape') {
      e.preventDefault();
      onExit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 커서 뒤 글자는 새 항목으로 넘긴다
      const at = input.selectionStart ?? input.value.length;
      const next = [...items];
      next.splice(i, 1, input.value.slice(0, at), input.value.slice(at));
      gesture.current = null;
      onChange(next, newListGesture());
      switching.current = true;
      caretEnd.current = false;
      onEditIndex(i + 1);
      setTimeout(() => (switching.current = false), 0);
    } else if (e.key === 'Backspace' && input.selectionStart === 0 && input.selectionEnd === 0 && i > 0) {
      // 맨 앞에서 Backspace: 이전 항목과 합친다 (빈 항목이면 삭제)
      e.preventDefault();
      const next = [...items];
      const prevLen = next[i - 1].length;
      next.splice(i - 1, 2, next[i - 1] + input.value);
      gesture.current = null;
      onChange(next, newListGesture());
      pendingCaret.current = prevLen;
      goTo(i - 1);
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault();
      goTo(i - 1);
    } else if (e.key === 'ArrowDown' && i < items.length - 1) {
      e.preventDefault();
      goTo(i + 1);
    }
  };

  const pendingCaret = useRef<number | null>(null);

  return (
    <ul className={styles.list} data-editing={editingIndex !== null}>
      {items.map((item, i) => {
        const active = editingIndex === i;
        return (
          <li
            key={i}
            data-item={i}
            // 편집 중에는 다른 항목을 누르면 그 항목으로 이동한다 (포커스 유지, 요소 드래그 없음)
            onMouseDown={editingIndex !== null ? (e) => !active && e.preventDefault() : undefined}
            onPointerDown={
              editingIndex !== null
                ? (e) => {
                    e.stopPropagation();
                    if (!active) goTo(i);
                  }
                : undefined
            }
          >
            {active ? (
              <input
                className={styles.itemInput}
                autoFocus
                value={item}
                placeholder={LIST_ITEM_PLACEHOLDER}
                aria-label={`목록 ${i + 1}번째 항목`}
                onFocus={(e) => {
                  const el = e.currentTarget;
                  const pos = pendingCaret.current ?? (caretEnd.current ? el.value.length : 0);
                  pendingCaret.current = null;
                  el.setSelectionRange(pos, pos);
                }}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  onChange(next, gestureFor(i));
                }}
                onKeyDown={(e) => onKeyDown(e, i)}
                onBlur={() => !switching.current && onExit()}
              />
            ) : (
              item || <span className={styles.placeholder}>{LIST_ITEM_PLACEHOLDER}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
