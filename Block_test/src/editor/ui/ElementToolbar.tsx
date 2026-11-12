import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Json } from '../../engine/types';
import { useDevInfo, useEditorStore, useForeignLocks, useIntent, useLocalState, useViewerDocument } from '../editorContext';
import { elementsOf, type BlockView, type ElementView } from '../model/documentModel';
import { kindDef, PAGE_SIZE, type ControlType, type PropertyDef } from '../model/elementRegistry';
import { blockLockKey, elementLockOwner } from '../model/lockKeys';
import { readBlockProperty } from '../model/ops';
import type { Rect } from '../model/snapping';
import { isTableBlock } from '../model/tableLayout';
import { ColorField } from './controls';
import { Icon, type IconName } from './icons';
import { takeFieldFocus } from './LeftPanel';
import { BlockPropertyField, PlacementInput, useFieldFocus, useLockOwner } from './PropertyField';
import { userStyle } from './PresenceBar';
import styles from './toolbar.module.css';
import { isAutoHeightKind } from './textMeasure';
import { useElementActions } from './useElementActions';
import { useEditBlockProperty } from './useEditText';

/**
 * 선택한 요소 위에 뜨는 툴바 (노션·문서 편집기처럼).
 *  - 서식(글자 크기·색상·굵게·기울임·밑줄·취소선·정렬·제목 레벨)은 툴바 버튼으로 바로 켜고 끈다
 *  - 그 밖의 속성(이미지·음악·링크 정보 등)은 "편집" 카드에서 고친다
 *  - ⋯ 메뉴: 겹침 순서 (개발자 정보를 켜면 좌표·ID)
 * 모든 변경은 intent → Simulation Engine을 거친다.
 */

/** 툴바에서 바로 다루는 서식 */
const QUICK: ControlType[] = ['fontSize', 'color', 'toggle', 'align', 'level'];
/** 캔버스에서 직접 편집하므로 카드에 두지 않는 속성 */
const ON_CANVAS = new Set(['content', 'items', 'data']);

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96];

const DECORATION_LOOK: Record<string, { label: string; style: CSSProperties; key: string }> = {
  'style.bold': { label: 'B', style: { fontWeight: 800 }, key: '⌘B' },
  'style.italic': { label: 'I', style: { fontStyle: 'italic', fontFamily: 'Georgia, serif' }, key: '⌘I' },
  'style.underline': { label: 'U', style: { textDecoration: 'underline' }, key: '⌘U' },
  'style.strikethrough': { label: 'S', style: { textDecoration: 'line-through' }, key: '⌘⇧X' },
};

const ALIGNS: { value: string; icon: IconName; label: string }[] = [
  { value: 'left', icon: 'alignLeft', label: '왼쪽 정렬' },
  { value: 'center', icon: 'alignCenter', label: '가운데 정렬' },
  { value: 'right', icon: 'alignRight', label: '오른쪽 정렬' },
];

/** 블록 속성 값 (없으면 레지스트리 기본값) */
export function propertyValue(block: BlockView, def: PropertyDef): Json {
  const raw = readBlockProperty(block, def.path);
  return ((raw === undefined ? def.fallback : raw) ?? null) as Json;
}

type Panel = 'color' | 'card' | 'more' | null;

export function ElementToolbar({ el, block, rect, zoom }: { el: ElementView; block: BlockView; rect: Rect; zoom: number }) {
  const intent = useIntent();
  const devInfo = useDevInfo();
  const users = useEditorStore((s) => s.users);
  const foreignLocks = useForeignLocks();
  const editBlockProperty = useEditBlockProperty();
  const def = kindDef(block.kind);
  const props = def.groups.flatMap((g) => g.properties);
  const quick = props.filter((p) => QUICK.includes(p.control));
  const detail = props.filter((p) => !QUICK.includes(p.control) && !ON_CANVAS.has(p.path));

  // 방금 추가한 요소(텍스트·목록·표 제외)는 편집 카드를 열고 첫 칸에 포커스한다
  const [panel, setPanel] = useState<Panel>(() => (detail.length && takeFieldFocus(el.elementId) ? 'card' : null));
  const autoFocusCard = useRef(panel === 'card');
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  // 바깥을 누르면 펼친 창을 닫는다
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setPanel(null);
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [panel]);

  // 위치: 요소 위쪽(공간이 없으면 아래쪽), 페이지 밖으로 나가지 않게 좌우를 맞춘다
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => setWidth(root.current?.offsetWidth ?? 0));
  const above = rect.y * zoom - 44;
  const top = above >= 0 ? above : (rect.y + rect.height) * zoom + 34;
  const left = Math.max(0, Math.min(rect.x * zoom, PAGE_SIZE.width * zoom - width));

  // 이 요소를 편집 중인 다른 사용자 (요소 편집 권한 또는 속성 Lock 보유)
  const editorId = elementLockOwner(foreignLocks, el);
  const editor = users.find((u) => u.userId === editorId) ?? null;

  return (
    <div
      ref={root}
      className={styles.toolbar}
      style={{ left, top }}
      role="toolbar"
      aria-label={`${def.label} 서식`}
      onPointerDown={(e) => e.stopPropagation()}
      // 버튼을 눌러도 캔버스의 입력 커서(텍스트 편집)가 유지되도록 포커스를 옮기지 않는다
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest('input, select, textarea, [data-allow-focus]')) e.preventDefault();
      }}
    >
      <div className={styles.bar}>
        <span className={styles.kind} title={devInfo ? `${def.label} · ${el.elementId} · ${block.blockId}` : def.label} aria-label={def.label}>
          <Icon name={block.kind} size={15} />
        </span>
        {editor && (
          <span className={styles.lock} style={userStyle(editor)} title={`${editor.name}이(가) 편집 중이라 지금은 바꿀 수 없어요`}>
            <Icon name="lock" size={10} />
            {editor.name} 편집 중
          </span>
        )}
        {!editor && (
          <>

        {quick.length > 0 && <span className={styles.sep} />}
        {quick.map((p) => (
          <QuickControl key={p.path} block={block} def={p} open={panel === 'color'} onToggleColor={() => toggle('color')} edit={editBlockProperty} />
        ))}

        {detail.length > 0 && (
          <>
            <span className={styles.sep} />
            <button type="button" className={styles.textButton} aria-expanded={panel === 'card'} onClick={() => toggle('card')}>
              <Icon name="pencil" size={13} />
              편집
            </button>
          </>
        )}

        <span className={styles.sep} />
        <button type="button" className={styles.iconButton} aria-label="더 보기" aria-expanded={panel === 'more'} title="겹침 순서" onClick={() => toggle('more')}>
          <Icon name="more" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          data-danger="true"
          aria-label="요소 삭제"
          title="삭제 (Delete)"
          onClick={() => intent({ type: 'deleteElement', templateId: el.templateId, elementId: el.elementId })}
        >
          <Icon name="trash" size={14} />
        </button>
          </>
        )}
      </div>

      {!editor && panel === 'card' && <DetailCard el={el} block={block} props={detail} autoFocus={autoFocusCard.current} />}
      {!editor && panel === 'more' && <MoreMenu el={el} block={block} />}
    </div>
  );
}

/** 툴바에서 바로 바꾸는 서식 하나 */
function QuickControl({
  block,
  def,
  open,
  onToggleColor,
  edit,
}: {
  block: BlockView;
  def: PropertyDef;
  open: boolean;
  onToggleColor: () => void;
  edit: ReturnType<typeof useEditBlockProperty>;
}) {
  const local = useLocalState();
  const owner = useLockOwner(blockLockKey(block.blockId, def.path));
  const value = propertyValue(block, def);
  const set = (v: Json, gestureId?: string) => edit(block, def.path, v, gestureId);
  const locked = owner ? `${owner.name}이(가) 편집 중` : undefined;

  switch (def.control) {
    case 'fontSize': {
      const n = Number(value ?? 16);
      const sizes = FONT_SIZES.includes(n) ? FONT_SIZES : [...FONT_SIZES, n].sort((a, b) => a - b);
      return (
        <select
          className={styles.select}
          value={n}
          disabled={!!owner}
          title={locked ?? def.label}
          aria-label={def.label}
          onFocus={() => local({ selectedPropertyPath: def.path })}
          onBlur={() => local({ selectedPropertyPath: null })}
          onChange={(e) => set(Number(e.target.value))}
        >
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      );
    }
    case 'color':
      return (
        <span className={styles.colorAnchor}>
          <button type="button" className={styles.iconButton} aria-label={def.label} aria-expanded={open} disabled={!!owner} title={locked ?? def.label} onClick={onToggleColor}>
            <span className={styles.colorChip} style={{ background: String(value ?? '#000000') }} />
          </button>
          {open && (
            <div className={styles.colorPop} data-allow-focus>
              <ColorField
                value={String(value ?? '#000000')}
                onChange={set}
                onFocus={() => local({ selectedPropertyPath: def.path })}
                onBlur={() => local({ selectedPropertyPath: null })}
              />
            </div>
          )}
        </span>
      );
    case 'toggle': {
      const look = DECORATION_LOOK[def.path];
      const on = value === true;
      return (
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={on}
          aria-label={def.label}
          disabled={!!owner}
          title={locked ?? `${def.label} (${look?.key ?? ''})`}
          onClick={() => set(!on)}
        >
          <span className={styles.glyph} style={look?.style}>
            {look?.label ?? def.label}
          </span>
        </button>
      );
    }
    case 'align':
      return (
        <span className={styles.group} role="group" aria-label={def.label}>
          {ALIGNS.map((a) => (
            <button
              key={a.value}
              type="button"
              className={styles.iconButton}
              aria-pressed={value === a.value}
              aria-label={a.label}
              disabled={!!owner}
              title={locked ?? a.label}
              onClick={() => set(a.value)}
            >
              <Icon name={a.icon} size={14} />
            </button>
          ))}
        </span>
      );
    case 'level':
      return (
        <span className={styles.group} role="group" aria-label={def.label}>
          {[1, 2, 3].map((l) => (
            <button
              key={l}
              type="button"
              className={styles.iconButton}
              aria-pressed={value === l}
              aria-label={`제목 ${l}`}
              disabled={!!owner}
              title={locked ?? `제목 ${l}`}
              onClick={() => set(l)}
            >
              <span className={styles.glyph}>H{l}</span>
            </button>
          ))}
        </span>
      );
    default:
      return null;
  }
}

/** 이미지·음악·링크 등 나머지 속성을 고치는 카드 */
function DetailCard({ el, block, props, autoFocus }: { el: ElementView; block: BlockView; props: PropertyDef[]; autoFocus: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFieldFocus(ref, el, autoFocus);
  return (
    <div ref={ref} className={styles.card} data-allow-focus>
      {props.map((p) => (
        <BlockPropertyField key={p.path} block={block} def={p} />
      ))}
    </div>
  );
}

/** ⋯ 메뉴: 겹침 순서 (개발자 정보를 켜면 좌표·ID) */
function MoreMenu({ el, block }: { el: ElementView; block: BlockView }) {
  const intent = useIntent();
  const actions = useElementActions();
  const doc = useViewerDocument();
  const devInfo = useDevInfo();
  const ordered = elementsOf(doc, el.templateId);
  const index = ordered.findIndex((e) => e.elementId === el.elementId);
  const last = ordered.length - 1;
  const reorder = (toIndex: number) => intent({ type: 'reorderElement', templateId: el.templateId, elementId: el.elementId, toIndex });
  const item = (icon: IconName, label: string, disabled: boolean, to: number): ReactNode => (
    <button type="button" className={styles.menuItem} disabled={disabled} onClick={() => reorder(to)}>
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
  return (
    <div className={styles.menu} data-allow-focus>
      <button type="button" className={styles.menuItem} onClick={() => actions.duplicate([el.elementId])}>
        <Icon name="plus" size={14} />
        <span className={styles.menuLabel}>복제</span>
        <kbd className={styles.menuKey}>⌘D</kbd>
      </button>
      <button type="button" className={styles.menuItem} onClick={() => actions.copy([el.elementId])}>
        <Icon name="page" size={14} />
        <span className={styles.menuLabel}>복사</span>
        <kbd className={styles.menuKey}>⌘C</kbd>
      </button>
      <div className={styles.menuSep} />
      {item('bringFront', '맨 앞으로 가져오기', index === last, last)}
      {item('arrowUp', '앞으로 가져오기', index === last, index + 1)}
      {item('arrowDown', '뒤로 보내기', index === 0, index - 1)}
      {item('sendBack', '맨 뒤로 보내기', index === 0, 0)}
      {devInfo && (
        <div className={styles.devBox}>
          <div className={styles.devIds}>
            {el.elementId} · {block.blockId} · #{el.sequence}
          </div>
          <div className={styles.devGrid}>
            <PlacementInput el={el} block={block} path="position.x" label="X" />
            <PlacementInput el={el} block={block} path="position.y" label="Y" />
            <PlacementInput el={el} block={block} path="size.width" label="W" readOnly={isTableBlock(block)} />
            <PlacementInput el={el} block={block} path="size.height" label="H" readOnly={isTableBlock(block) || isAutoHeightKind(block.kind)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** 여러 요소를 함께 선택했을 때의 툴바: 개수 · 복제 · 삭제 */
export function GroupToolbar({
  rect,
  zoom,
  count,
  onDuplicate,
  onDelete,
}: {
  rect: Rect;
  zoom: number;
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const above = rect.y * zoom - 44;
  const top = above >= 0 ? above : (rect.y + rect.height) * zoom + 12;
  return (
    <div
      className={styles.toolbar}
      style={{ left: Math.max(0, rect.x * zoom), top }}
      role="toolbar"
      aria-label="선택한 요소들"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className={styles.bar}>
        <span className={styles.count}>{count}개 선택</span>
        <span className={styles.sep} />
        <button type="button" className={styles.textButton} onClick={onDuplicate} title="복제 (⌘D)">
          <Icon name="plus" size={13} />
          복제
        </button>
        <button type="button" className={styles.iconButton} data-danger="true" aria-label="선택한 요소 삭제" title="삭제 (Delete)" onClick={onDelete}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}
