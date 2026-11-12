import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';
import styles from './toolbar.module.css';

export interface MenuItem {
  label: string;
  icon?: IconName;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

/** 오른쪽 클릭 메뉴. null은 구분선. 바깥을 누르거나 Esc·스크롤하면 닫힌다 */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: (MenuItem | null)[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // 화면 밖으로 나가면 안쪽으로 당긴다
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: Math.min(x, window.innerWidth - r.width - 8), top: Math.min(y, window.innerHeight - r.height - 8) });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={styles.contextMenu}
      style={pos}
      role="menu"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={`sep-${i}`} className={styles.menuSep} />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={styles.menuItem}
            data-danger={item.danger || undefined}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.icon ? <Icon name={item.icon} size={14} /> : <span style={{ width: 14 }} />}
            <span className={styles.menuLabel}>{item.label}</span>
            {item.shortcut && <kbd className={styles.menuKey}>{item.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
