import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { BlockKind } from '../../engine/types';
import {
  useDevInfo,
  useEditorStore,
  useEditorStoreApi,
  useForeignLocks,
  useIntent,
  useLocalState,
  useRemotePresence,
  useSelectionIds,
  useViewer,
  useViewerDocument,
  useViewerReplica,
} from '../editorContext';
import { elementsOf, type ElementView } from '../model/documentModel';
import { findPropertyDef, kindDef, PAGE_SIZE, PLACEMENT_PATHS } from '../model/elementRegistry';
import { blockLockKey, claimLockKey, elementLockKey } from '../model/lockKeys';
import { pushToast } from '../store/editorState';
import { HANDLES, resizeRect, snapRect, type Guide, type HandleDir, type Rect } from '../model/snapping';
import { addColumn, addRow, elementSize, isTableBlock, tableData, tableSize } from '../model/tableLayout';
import { ElementContent, InlineTextEditor } from './ElementContent';
import { decorationShortcut } from '../model/textDecoration';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { ElementToolbar, GroupToolbar, propertyValue } from './ElementToolbar';
import { hasClipboard, useElementActions } from './useElementActions';
import { Icon } from './icons';
import { afterCreateSelection, ELEMENT_DRAG_MIME } from './LeftPanel';
import { userStyle } from './PresenceBar';
import styles from './stage.module.css';
import { itemOf, ListCanvas, listItems } from './ListCanvas';
import { TableCanvas, type CellPos } from './TableCanvas';
import { isAutoHeightKind, measureTextHeight } from './textMeasure';
import { autoHeightChanges, useEditBlockProperty } from './useEditText';
import { useEditTable } from './useEditTable';

/** 텍스트·제목은 높이가 내용으로 정해지므로 좌우 핸들만 둔다 */
const WIDTH_HANDLES: HandleDir[] = ['e', 'w'];

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2];

/** 인라인 편집 대상 콘텐츠 속성 (Lock 키 판정용) */
const contentPathOf = (kind: string | undefined) => (kind === 'table' ? 'data' : kind === 'list' ? 'items' : 'content');

/** pointer 이벤트 대상의 표 셀 위치 */
const cellOf = (target: EventTarget | null): CellPos | null => {
  const at = (target as HTMLElement | null)?.closest?.('[data-cell]')?.getAttribute('data-cell');
  if (!at) return null;
  const [r, c] = at.split(',').map(Number);
  return { r, c };
};

/** 받침이 있으면 "을", 없으면 "를" */
const objectParticle = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? "을" : "를";
};

let gestureSeq = 0;
const newGestureId = (kind: string) => `${kind}-${Date.now().toString(36)}-${++gestureSeq}`;

interface ActiveGesture {
  kind: 'move' | 'resize';
  elementId: string;
  gestureId: string;
  dir?: HandleDir;
  startClient: { x: number; y: number };
  startRect: Rect;
  others: Rect[];
  moved: boolean;
  /** 함께 선택한 요소를 같이 옮길 때: 각 요소의 시작 위치 */
  group: { id: string; x: number; y: number }[] | null;
}

export function Stage() {
  const doc = useViewerDocument();
  const replica = useViewerReplica();
  const viewer = useViewer();
  const users = useEditorStore((s) => s.users);
  // 다른 사용자의 선택·커서는 이 클라이언트가 Presence(Pub/Sub)로 수신한 값만 사용한다
  const presence = useRemotePresence();
  const intent = useIntent();
  const local = useLocalState();
  const devInfo = useDevInfo();

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [activeGesture, setActiveGesture] = useState<ActiveGesture['kind'] | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const editSession = useRef<string | null>(null);
  const lastCursorSent = useRef(0);

  const templateId = replica.viewingTemplateId;
  const template = doc.templates[templateId];
  const elements = elementsOf(doc, templateId);
  const selected = replica.selectedElementId ? doc.elements[replica.selectedElementId] : undefined;
  const editingId = replica.localSelection.editingElementId;
  // 다중 선택: 대표 선택(replica, Presence 전파) + 함께 선택한 요소(화면 전용)
  const selectionIds = useSelectionIds();
  const multi = selectionIds.length > 1;
  const actions = useElementActions();
  const [menu, setMenu] = useState<{ x: number; y: number; at: { x: number; y: number }; ids: string[] } | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  /* ---------- 요소 영역 (표는 행·열 수, 텍스트·제목은 내용으로 정해진 높이) ---------- */
  const sizeOf = (el: ElementView) => {
    const block = doc.blocks[el.blockId];
    const size = elementSize(el, block);
    const h = block && isAutoHeightKind(block.kind) ? measureTextHeight(block, size.width) : null;
    return h === null ? size : { width: size.width, height: h };
  };
  const isText = (el: ElementView) => isAutoHeightKind(doc.blocks[el.blockId]?.kind);
  const rectOf = (el: ElementView): Rect => ({ x: el.props.position.x, y: el.props.position.y, ...sizeOf(el) });
  const rectStyle = (el: ElementView): CSSProperties => {
    const r = rectOf(el);
    return { left: r.x, top: r.y, width: r.width, height: r.height };
  };
  const isTable = (el: ElementView) => isTableBlock(doc.blocks[el.blockId]);

  /* ---------- 표 셀 편집 ---------- */
  const editTable = useEditTable();
  const editBlockProperty = useEditBlockProperty();
  // 텍스트를 클릭해 편집을 시작한 위치 (그 자리에 커서를 둔다)
  const [caretAt, setCaretAt] = useState<{ x: number; y: number } | null>(null);
  const [editingCell, setEditingCell] = useState<CellPos | null>(null);
  // 표 편집이 시작됐는데 셀이 정해지지 않았으면 첫 셀부터 (예: 표를 추가하자마자 편집)
  const editingTable = editingId && doc.elements[editingId] && isTable(doc.elements[editingId]) ? editingId : null;
  useEffect(() => {
    if (!editingTable) setEditingCell(null);
    else setEditingCell((c) => c ?? { r: 0, c: 0 });
  }, [editingTable]);

  /* ---------- 목록 항목 편집 ---------- */
  const isList = (el: ElementView) => doc.blocks[el.blockId]?.kind === 'list';
  const [editingItem, setEditingItem] = useState<number | null>(null);
  // 목록 편집이 시작됐는데 항목이 정해지지 않았으면 첫 항목부터 (예: 목록을 추가하자마자 편집)
  const editingList = editingId && doc.elements[editingId] && isList(doc.elements[editingId]) ? editingId : null;
  useEffect(() => {
    if (!editingList) setEditingItem(null);
    else setEditingItem((i) => i ?? 0);
  }, [editingList]);

  /* ---------- 다른 사용자의 Lock ---------- */
  const store = useEditorStoreApi();
  const foreignLocks = useForeignLocks();
  // 요소 편집 권한 (v1.2.8): 다른 사용자가 그 요소를 선택해 편집 중이면 선택만 된다 (내용·서식·이동 모두 막힘)
  const claimOwner = (el: ElementView) => foreignLocks[claimLockKey(el.templateId, el.elementId)] ?? null;
  const contentLockOwner = (el: ElementView) =>
    claimOwner(el) ?? foreignLocks[blockLockKey(el.blockId, contentPathOf(doc.blocks[el.blockId]?.kind))] ?? null;
  const placementLockOwner = (el: ElementView) =>
    claimOwner(el) ?? PLACEMENT_PATHS.map((p) => foreignLocks[elementLockKey(el.templateId, el.elementId, p)]).find(Boolean) ?? null;
  const lockedBy = (el: ElementView) => contentLockOwner(el) ?? placementLockOwner(el);
  const userName = (id: string) => users.find((u) => u.userId === id)?.name ?? id;
  const warnLocked = (owner: string, what: string) =>
    pushToast(
      store,
      devInfo
        ? { tone: 'warning', title: 'Lock 거부', detail: `${userName(owner)}(${owner})이(가) ${what} Lock을 보유 중입니다` }
        : { tone: 'warning', title: `${userName(owner)}이(가) 편집 중이에요`, detail: `끝날 때까지 ${what}${objectParticle(what)} 바꿀 수 없어요` },
    );

  // 편집 중에 다른 사용자가 Lock을 가져가면(동시 진입 등) 인라인 편집을 끝내 화면을 확정값으로 되돌린다
  const editingEl = editingId ? doc.elements[editingId] : undefined;
  const editingLockedBy = editingEl ? contentLockOwner(editingEl) : null;
  useEffect(() => {
    if (editingLockedBy) {
      editSession.current = null;
      local({ selectedPropertyPath: null, localSelection: { editingElementId: null } });
    }
  }, [editingLockedBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // 요소를 추가하자마자 편집이 시작된 경우(afterCreateSelection) 입력 세션을 연다: 이어지는 입력은 Undo 한 번에 되돌린다
  useEffect(() => {
    if (editingId && !editSession.current) {
      editSession.current = newGestureId('type');
      setCaretAt(null);
    }
  }, [editingId]);

  /* ---------- scroll guard ---------- */
  // transform: scale 캔버스에서 Chrome이 caret/selection 위치를 잘못 계산해 스테이지를 스크롤하는 문제가 있다
  // (인라인 편집 종료 직후 애니메이션 스크롤 포함). 스테이지는 사용자의 스크롤 의도(휠, 스크롤바, 터치, 스크롤 키)가
  // 있을 때만 스크롤되도록 하고, 그 밖의 스크롤은 직전 위치로 되돌린다.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    let intentUntil = 0;
    let last = { top: node.scrollTop, left: node.scrollLeft };
    const markIntent = () => {
      intentUntil = performance.now() + 500;
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return;
      if (['PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) markIntent();
    };
    const onScroll = () => {
      if (performance.now() <= intentUntil) {
        last = { top: node.scrollTop, left: node.scrollLeft };
        return;
      }
      if (node.scrollTop !== last.top || node.scrollLeft !== last.left) {
        node.scrollTop = last.top;
        node.scrollLeft = last.left;
        last = { top: node.scrollTop, left: node.scrollLeft };
      }
    };
    node.addEventListener('wheel', markIntent, { passive: true });
    node.addEventListener('touchstart', markIntent, { passive: true });
    // 스크롤바 드래그만 의도로 본다 (요소 클릭·더블클릭은 스크롤 의도가 아님)
    const onPointerDown = (e: PointerEvent) => {
      if (e.target === node && (e.offsetX >= node.clientWidth || e.offsetY >= node.clientHeight)) markIntent();
    };
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('scroll', onScroll);
    window.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('wheel', markIntent);
      node.removeEventListener('touchstart', markIntent);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  /* ---------- zoom ---------- */
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !fit) return;
    const update = () => {
      // 너비 기준 맞춤 (세로는 스크롤)
      const w = node.clientWidth - 72;
      setZoom(Math.max(0.25, Math.min(1.1, w / PAGE_SIZE.width)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [fit]);

  const stepZoom = (dir: 1 | -1) => {
    setFit(false);
    setZoom((z) => {
      const idx = ZOOM_STEPS.findIndex((s) => s >= z - 0.001);
      const next = dir > 0 ? ZOOM_STEPS.find((s) => s > z + 0.001) : [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001);
      return next ?? ZOOM_STEPS[Math.max(0, idx)];
    });
  };

  const toPage = useCallback(
    (clientX: number, clientY: number) => {
      const rect = pageRef.current!.getBoundingClientRect();
      return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
    },
    [zoom],
  );

  /** 끌기 시작할 때 한 번만 알린다 (그냥 눌러 선택하는 것은 조용히) */
  const warnOnDrag = (e: ReactPointerEvent, owner: string, wantsToType: boolean) => {
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 4) return;
      warnLocked(owner, '위치');
      cleanup();
    };
    // 끌지 않고 떼었는데 입력하려던 클릭이면 내용을 바꿀 수 없다고 알린다
    const up = () => {
      cleanup();
      if (wantsToType) warnLocked(owner, '내용');
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---------- gestures (move / resize) ---------- */
  const beginGesture = (e: ReactPointerEvent, el: ElementView, kind: ActiveGesture['kind'], dir?: HandleDir) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // Shift+클릭: 선택에 더하거나 뺀다 (끌기 없음)
    if (kind === 'move' && e.shiftKey) {
      const ids = selectionIds.includes(el.elementId) ? selectionIds.filter((id) => id !== el.elementId) : [...selectionIds, el.elementId];
      if (ids.length) actions.select(ids);
      else local({ selectedElementId: null, selectedPropertyPath: null, localSelection: { editingElementId: null } });
      return;
    }
    // 함께 선택한 요소 중 하나를 누르면 묶음 그대로 끌어 옮긴다 (끌지 않고 떼면 그 요소만 선택)
    const inGroup = kind === 'move' && multi && selectionIds.includes(el.elementId);
    // 표의 셀을 (끌지 않고) 클릭하면 선택 여부와 상관없이 바로 그 셀을 편집한다. 끌면 표 이동
    const clickedCell = kind === 'move' && !inGroup && isTable(el) ? cellOf(e.target) : null;
    // 목록 항목도 (끌지 않고) 클릭하면 바로 그 항목을 편집한다
    const clickedItem = kind === 'move' && !inGroup && isList(el) ? itemOf(e.target) : null;
    // 이미 선택된 텍스트·제목을 (끌지 않고) 클릭하면 그 자리에서 바로 입력한다. 처음 클릭은 선택(끌어서 이동 가능)
    const clickToType = kind === 'move' && !inGroup && isText(el) && replica.selectedElementId === el.elementId && !editingId;
    const point = { x: e.clientX, y: e.clientY };
    if (!inGroup && (replica.selectedElementId !== el.elementId || editingId))
      local({ selectedElementId: el.elementId, selectedPropertyPath: null, localSelection: { editingElementId: null } });
    // 다른 사용자가 배치 Lock을 보유 중이면 선택만 하고 이동·크기 조절은 시작하지 않는다 (내용 입력은 가능)
    const members = inGroup ? selectionIds.map((id) => doc.elements[id]).filter(Boolean) : [el];
    const placementOwner = members.map(placementLockOwner).find(Boolean) ?? null;
    if (placementOwner) {
      // 편집 권한이 다른 사용자에게 있으면 선택만 한다. 눌러서 입력하려 하거나 끌어서 옮기려 할 때만 알린다
      if (claimOwner(el)) {
        warnOnDrag(e, placementOwner, clickedItem !== null || !!clickedCell || clickToType);
        return;
      }
      if (clickedItem !== null) startEditing(el, null, null, clickedItem);
      else if (clickToType) startEditing(el, null, point);
      else warnLocked(placementOwner, '위치·크기');
      return;
    }

    const g: ActiveGesture = {
      kind,
      dir,
      elementId: el.elementId,
      gestureId: newGestureId(kind),
      startClient: { x: e.clientX, y: e.clientY },
      startRect: rectOf(el),
      others: elements.filter((o) => !members.some((m) => m.elementId === o.elementId)).map(rectOf),
      moved: false,
      group: inGroup ? members.map((m) => ({ id: m.elementId, x: m.props.position.x, y: m.props.position.y })) : null,
    };
    const currentZoom = zoom;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - g.startClient.x) / currentZoom;
      const dy = (ev.clientY - g.startClient.y) / currentZoom;
      if (!g.moved && Math.hypot(dx * currentZoom, dy * currentZoom) < 3) return;
      if (!g.moved) {
        g.moved = true;
        setActiveGesture(kind);
      }
      if (g.kind === 'move') {
        const raw = { ...g.startRect, x: g.startRect.x + dx, y: g.startRect.y + dy };
        const snap = ev.altKey ? { x: raw.x, y: raw.y, guides: [] } : snapRect(raw, g.others, PAGE_SIZE, 6 / currentZoom);
        setGuides(snap.guides);
        if (g.group) {
          // 묶음 이동: 누른 요소의 이동량(맞춤선 반영)을 모든 요소에 같게 적용. 같은 gesture라 Undo 한 번
          const ddx = snap.x - g.startRect.x;
          const ddy = snap.y - g.startRect.y;
          for (const m of g.group)
            intent({ type: 'editPlacement', templateId, elementId: m.id, changes: { 'position.x': m.x + ddx, 'position.y': m.y + ddy }, gestureId: g.gestureId });
        } else
          intent({
            type: 'editPlacement',
            templateId,
            elementId: g.elementId,
            changes: { 'position.x': snap.x, 'position.y': snap.y },
            gestureId: g.gestureId,
          });
      } else {
        const r = resizeRect(g.startRect, g.dir!, dx, dy);
        const block = doc.blocks[el.blockId];
        intent({
          type: 'editPlacement',
          templateId,
          elementId: g.elementId,
          // 텍스트·제목·목록: 너비만 바꾸고 높이는 그 너비에서 내용에 맞춘다
          changes: isText(el)
            ? { 'position.x': r.x, ...autoHeightChanges(block, r.width) }
            : { 'position.x': r.x, 'position.y': r.y, 'size.width': r.width, 'size.height': r.height },
          gestureId: g.gestureId,
        });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setGuides([]);
      setActiveGesture(null);
      if (!g.moved && inGroup) actions.select([el.elementId]);
      else if (!g.moved && clickedCell) startEditing(el, clickedCell);
      else if (!g.moved && clickedItem !== null) startEditing(el, null, null, clickedItem);
      else if (!g.moved && clickToType) startEditing(el, null, point);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ---------- inline text editing ---------- */
  const startEditing = (el: ElementView, cell?: CellPos | null, at: { x: number; y: number } | null = null, item?: number | null) => {
    const kind = doc.blocks[el.blockId]?.kind;
    if (kind !== 'text' && kind !== 'title' && kind !== 'table' && kind !== 'list') return;
    // 다른 사용자가 콘텐츠 Lock을 보유 중이면 편집 모드로 들어가지 않는다 (선택은 유지)
    const owner = contentLockOwner(el);
    if (owner) {
      warnLocked(owner, kind === 'table' ? '표' : kind === 'list' ? '목록' : '텍스트');
      local({ selectedElementId: el.elementId });
      return;
    }
    editSession.current = newGestureId('type');
    if (kind === 'table') setEditingCell(cell ?? { r: 0, c: 0 });
    // 목록: 누른 항목, 항목 밖을 눌렀으면 마지막 항목
    if (kind === 'list') setEditingItem(item ?? listItems(doc.blocks[el.blockId]).length - 1);
    setCaretAt(at);
    local({ selectedElementId: el.elementId, selectedPropertyPath: contentPathOf(kind), localSelection: { editingElementId: el.elementId } });
  };

  const stopEditing = () => {
    editSession.current = null;
    setEditingCell(null);
    setEditingItem(null);
    setCaretAt(null);
    // 인라인 편집 종료는 Lock 해제 사유가 아니다 (요소에서 나갈 때 해제, §8.10.5)
    local({ selectedPropertyPath: null, localSelection: { editingElementId: null } });
  };

  /* ---------- 글자 꾸밈 단축키 (⌘B·⌘I·⌘U·⌘⇧X) ---------- */
  const toggleDecoration = (el: ElementView, path: string) => {
    const block = doc.blocks[el.blockId];
    const def = block && findPropertyDef(block.kind, path);
    if (!block || !def) return;
    const owner = foreignLocks[blockLockKey(el.blockId, path)];
    if (owner) return warnLocked(owner, def.label);
    editBlockProperty(block, path, propertyValue(block, def) !== true);
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        intent({ type: e.shiftKey ? 'redo' : 'undo' });
        return;
      }
      const key = e.key.toLowerCase();
      // 붙여넣기·전체 선택은 선택이 없어도 된다
      if (mod && !e.shiftKey && key === 'v') {
        e.preventDefault();
        actions.paste();
        return;
      }
      if (mod && !e.shiftKey && key === 'a') {
        e.preventDefault();
        if (elements.length) actions.select(elements.map((x) => x.elementId));
        return;
      }
      if (!selected) return;
      if (mod && !e.shiftKey && (key === 'c' || key === 'd')) {
        e.preventDefault();
        if (key === 'c') actions.copy(selectionIds);
        else actions.duplicate(selectionIds);
        return;
      }
      const decoration = multi ? null : decorationShortcut(e);
      if (decoration) {
        e.preventDefault();
        toggleDecoration(selected, decoration);
        return;
      }
      if (e.key === 'Escape') local({ selectedElementId: null, selectedPropertyPath: null });
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        actions.remove(selectionIds);
        return;
      }
      if (e.key === 'Enter' && !multi) {
        e.preventDefault();
        startEditing(selected);
      }
      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (nudge[e.key]) {
        e.preventDefault();
        const [dx, dy] = nudge[e.key];
        // 선택한 요소 모두 같이 움직인다
        for (const id of selectionIds) {
          const el = doc.elements[id];
          if (!el) continue;
          intent({
            type: 'editPlacement',
            templateId,
            elementId: id,
            changes: { 'position.x': el.props.position.x + dx, 'position.y': el.props.position.y + dy },
            gestureId: `nudge-${selected.elementId}`,
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---------- cursor presence ---------- */
  const onPagePointerMove = (e: ReactPointerEvent) => {
    // 로컬 렌더링 빈도 제한(프레임 단위). 네트워크 전송 throttle(50ms, 시뮬레이션 시간)은 엔진 클라이언트가 담당한다.
    const now = performance.now();
    if (now - lastCursorSent.current < 16) return;
    lastCursorSent.current = now;
    const p = toPage(e.clientX, e.clientY);
    local({ cursorPosition: { x: Math.round(p.x), y: Math.round(p.y) } });
  };

  /* ---------- drop from tool panel ---------- */
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(ELEMENT_DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (e: DragEvent) => {
    const kind = e.dataTransfer.getData(ELEMENT_DRAG_MIME) as BlockKind;
    if (!kind) return;
    e.preventDefault();
    const p = toPage(e.clientX, e.clientY);
    const { width, height } = kindDef(kind).defaultSize;
    const r = intent({ type: 'addElement', templateId, kind, position: { x: p.x - width / 2, y: p.y - height / 2 } });
    if (r.ok && r.createdElementId) local(afterCreateSelection(kind, r.createdElementId));
  };

  // 툴바 key: 요소가 바뀌면 새로 그리지만, 서버 승인으로 임시 ID가 진짜 ID로 바뀐 경우는 같은 요소이므로
  // 그대로 유지한다 (편집 카드·입력 포커스가 끊기지 않게)
  const toolbarKey = useRef<{ id: string; key: string; provisional: boolean } | null>(null);
  if (selected) {
    const prev = toolbarKey.current;
    if (!prev || prev.id !== selected.elementId) {
      const remapped = !!prev && prev.provisional && !selected.provisional && !doc.elements[prev.id];
      toolbarKey.current = { id: selected.elementId, key: remapped ? prev!.key : selected.elementId, provisional: !!selected.provisional };
    } else toolbarKey.current = { ...prev, provisional: !!selected.provisional };
  }

  /* ---------- 다중 선택 영역 · 드래그 영역 선택 ---------- */
  const boundsOf = (ids: string[]): Rect => {
    const rs = ids.map((id) => doc.elements[id]).filter(Boolean).map(rectOf);
    const x = Math.min(...rs.map((r) => r.x));
    const y = Math.min(...rs.map((r) => r.y));
    return { x, y, width: Math.max(...rs.map((r) => r.x + r.width)) - x, height: Math.max(...rs.map((r) => r.y + r.height)) - y };
  };

  /** 빈 곳에서 끌면 영역 안의 요소를 선택한다 (Shift: 기존 선택에 더하기). 끌지 않고 누르면 선택 해제 */
  const startMarquee = (e: ReactPointerEvent) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    // 요소 단위로만 선택한다: 끄는 동안 브라우저가 글자를 선택하지 않게 한다
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    const start = toPage(e.clientX, e.clientY);
    const base = e.shiftKey ? selectionIds : [];
    let box: Rect | null = null;
    const move = (ev: PointerEvent) => {
      const p = toPage(ev.clientX, ev.clientY);
      if (!box && Math.hypot(p.x - start.x, p.y - start.y) * zoom < 4) return;
      box = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) };
      setMarquee(box);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      const hit = box
        ? elements
            .filter((el) => {
              const r = rectOf(el);
              return r.x < box!.x + box!.width && r.x + r.width > box!.x && r.y < box!.y + box!.height && r.y + r.height > box!.y;
            })
            .map((el) => el.elementId)
        : [];
      const ids = [...new Set([...base, ...hit])];
      if (ids.length) actions.select(ids);
      else local({ selectedElementId: null, selectedPropertyPath: null, localSelection: { editingElementId: null } });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /* ---------- 오른쪽 클릭 메뉴 ---------- */
  const openMenu = (e: ReactMouseEvent, el: ElementView | null) => {
    e.preventDefault();
    e.stopPropagation();
    let ids: string[] = [];
    if (el) {
      ids = selectionIds.includes(el.elementId) ? selectionIds : [el.elementId];
      if (!selectionIds.includes(el.elementId)) actions.select([el.elementId]);
    }
    setMenu({ x: e.clientX, y: e.clientY, at: toPage(e.clientX, e.clientY), ids });
  };
  const closeMenu = useCallback(() => setMenu(null), []);
  const menuItems = (m: NonNullable<typeof menu>): (MenuItem | null)[] => {
    const canPaste = hasClipboard(viewer.userId);
    if (!m.ids.length) return [{ label: '여기에 붙여넣기', icon: 'page', shortcut: '⌘V', disabled: !canPaste, onSelect: () => actions.paste(m.at) }];
    const single = m.ids.length === 1 ? m.ids[0] : null;
    const lockedOwner = m.ids.map((id) => doc.elements[id] && claimOwner(doc.elements[id])).find(Boolean);
    if (lockedOwner)
      return [
        { label: `${userName(lockedOwner)} 편집 중`, icon: 'lock', disabled: true, onSelect: () => undefined },
        null,
        { label: '복사', icon: 'page', shortcut: '⌘C', onSelect: () => actions.copy(m.ids) },
        { label: '복제', icon: 'plus', shortcut: '⌘D', onSelect: () => actions.duplicate(m.ids) },
      ];
    const ordered = elementsOf(doc, templateId);
    const index = single ? ordered.findIndex((x) => x.elementId === single) : -1;
    const last = ordered.length - 1;
    return [
      { label: '복사', icon: 'page', shortcut: '⌘C', onSelect: () => actions.copy(m.ids) },
      { label: '붙여넣기', icon: 'page', shortcut: '⌘V', disabled: !canPaste, onSelect: () => actions.paste() },
      { label: '복제', icon: 'plus', shortcut: '⌘D', onSelect: () => actions.duplicate(m.ids) },
      ...(single
        ? [
            null,
            { label: '맨 앞으로 가져오기', icon: 'bringFront' as const, disabled: index === last, onSelect: () => actions.reorder(single, 'front') },
            { label: '앞으로 가져오기', icon: 'arrowUp' as const, disabled: index === last, onSelect: () => actions.reorder(single, 'forward') },
            { label: '뒤로 보내기', icon: 'arrowDown' as const, disabled: index === 0, onSelect: () => actions.reorder(single, 'backward') },
            { label: '맨 뒤로 보내기', icon: 'sendBack' as const, disabled: index === 0, onSelect: () => actions.reorder(single, 'back') },
          ]
        : []),
      null,
      { label: m.ids.length > 1 ? `${m.ids.length}개 삭제` : '삭제', icon: 'trash', shortcut: 'Del', danger: true, onSelect: () => actions.remove(m.ids) },
    ];
  };

  const others = users.filter((u) => u.userId !== viewer.userId && presence[u.userId]?.status === 'connected');

  /** 다른 사용자의 선택을 요소별로 모은다. 편집 중인 사람 = 그 요소의 편집 권한(또는 Lock) 보유자 */
  const remoteGroups = (() => {
    const byElement = new Map<string, typeof others>();
    for (const u of others) {
      const id = presence[u.userId].selectedElementId;
      if (!id || !doc.elements[id]) continue;
      byElement.set(id, [...(byElement.get(id) ?? []), u]);
    }
    return [...byElement.entries()].map(([id, viewers]) => {
      const el = doc.elements[id];
      const editorId = lockedBy(el);
      return { el, viewers, editor: viewers.find((u) => u.userId === editorId) ?? null };
    });
  })();

  const deselect = (e: ReactPointerEvent) => {
    if (e.target === e.currentTarget) local({ selectedElementId: null, selectedPropertyPath: null, localSelection: { editingElementId: null } });
  };

  return (
    <div className={styles.frame}>
    <main
      className={styles.stage}
      ref={scrollRef}
      onPointerDown={deselect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={userStyle(viewer)}
      data-gesture={activeGesture ?? undefined}
    >
      <div className={styles.pageMeta} onPointerDown={deselect}>
        <Icon name="page" size={13} />
        <span>{template?.name}</span>
        <span className={styles.metaDim}>
          {PAGE_SIZE.width} × {PAGE_SIZE.height}
          {devInfo ? ' · render_zone main' : ''} · {elements.length}개 요소
        </span>
      </div>

      <div className={styles.pageWrap} style={{ width: PAGE_SIZE.width * zoom, height: PAGE_SIZE.height * zoom }}>
        <div
          ref={pageRef}
          className={styles.page}
          style={{ width: PAGE_SIZE.width, height: PAGE_SIZE.height, transform: `scale(${zoom})`, ['--inv' as string]: 1 / zoom } as CSSProperties}
          onPointerDown={startMarquee}
          onContextMenu={(e) => e.target === e.currentTarget && openMenu(e, null)}
          onPointerMove={onPagePointerMove}
          onPointerLeave={() => local({ cursorPosition: null })}
        >
          {elements.length === 0 && (
            <div className={styles.emptyPage}>
              <Icon name="shapes" size={28} />
              <strong>빈 페이지</strong>
              <span>왼쪽 패널에서 요소를 클릭하거나 끌어다 놓으세요</span>
            </div>
          )}

          {elements.map((el) => {
            const block = doc.blocks[el.blockId];
            if (!block) return null;
            const isSelected = selected?.elementId === el.elementId;
            const isEditing = editingId === el.elementId;
            const table = isTableBlock(block);
            return (
              <div
                key={el.elementId}
                className={styles.element}
                data-selected={isSelected || selectionIds.includes(el.elementId)}
                data-kind={block.kind}
                style={{ ...rectStyle(el), zIndex: el.sequence }}
                onPointerDown={(e) => !isEditing && beginGesture(e, el, 'move')}
                onDoubleClick={(e) => !isEditing && !multi && startEditing(el, cellOf(e.target), null, itemOf(e.target))}
                onContextMenu={(e) => !isEditing && openMenu(e, el)}
                onPointerEnter={() => setHoverId(el.elementId)}
                onPointerLeave={() => setHoverId((h) => (h === el.elementId ? null : h))}
              >
                {table ? (
                  (() => {
                    const data = tableData(block);
                    const owner = contentLockOwner(el);
                    const fits = (d: typeof data) => {
                      const s = tableSize(d);
                      return el.props.position.x + s.width <= PAGE_SIZE.width && el.props.position.y + s.height <= PAGE_SIZE.height;
                    };
                    const grow = (next: typeof data) => {
                      if (!isSelected) local({ selectedElementId: el.elementId });
                      editTable(block, next);
                    };
                    return (
                      <TableCanvas
                        block={block}
                        editingCell={isEditing ? editingCell : null}
                        onEditCell={setEditingCell}
                        onExit={stopEditing}
                        onChange={(next, gestureId) => editTable(block, next, gestureId)}
                        addControls={{
                          // 버튼은 항상 자리를 차지하되 투명하고, 그 위에 마우스를 올렸을 때만 보인다 (CSS :hover)
                          visible: !activeGesture,
                          canAddRow: !owner && fits(addRow(data)),
                          canAddColumn: !owner && fits(addColumn(data)),
                          disabledReason: owner ? `${userName(owner)}(${owner})이(가) 표를 편집 중입니다` : undefined,
                        }}
                        onAddRow={() => grow(addRow(data))}
                        onAddColumn={() => grow(addColumn(data))}
                      />
                    );
                  })()
                ) : block.kind === 'list' ? (
                  <ListCanvas
                    block={block}
                    editingIndex={isEditing ? editingItem : null}
                    onEditIndex={setEditingItem}
                    onExit={stopEditing}
                    // 항목 수·내용에 맞춰 높이도 같은 gesture로 갱신된다 (Undo 한 번에 함께)
                    onChange={(items, gestureId) => editBlockProperty(block, 'items', items, gestureId)}
                  />
                ) : isEditing ? (
                  <InlineTextEditor
                    block={block}
                    caretAt={caretAt}
                    onFormatKey={(path) => toggleDecoration(el, path)}
                    // 입력에 맞춰 높이도 같은 gesture로 갱신된다 (Undo 한 번에 함께)
                    onChange={(text) => editBlockProperty(block, 'content', text, editSession.current ?? undefined)}
                    onExit={stopEditing}
                  />
                ) : (
                  <ElementContent block={block} />
                )}
              </div>
            );
          })}

          {/* 다른 사용자의 선택 표시 */}
          {/* 요소마다 이름표 하나: 편집 권한을 가진 사람을 앞에 크게, 선택만 한 사람은 옆에 작게 (이름표가 겹치지 않게) */}
          {remoteGroups.map(({ el, editor, viewers }) => {
            const lead = editor ?? viewers[0];
            return (
              <div key={`sel-${el.elementId}`} className={styles.remoteSelection} style={{ ...userStyle(lead), ...rectStyle(el) }}>
                {/* 내가 선택한 요소는 툴바에 편집 중인 사람이 나오므로 이름표를 겹쳐 그리지 않는다 */}
                {selected?.elementId !== el.elementId && (
                  <span className={styles.remoteTags}>
                    <span className={styles.remoteTag} style={userStyle(lead)}>
                      {editor && <Icon name="lock" size={9} />}
                      {lead.name}
                      {editor ? ' · 편집 중' : ''}
                    </span>
                    {viewers
                      .filter((u) => u !== lead)
                      .map((u) => (
                        <span key={u.userId} className={styles.remoteTag} data-minor="true" style={userStyle(u)} title={`${u.name} 선택 중${editor ? ' (편집 대기)' : ''}`}>
                          {u.name}
                        </span>
                      ))}
                  </span>
                )}
              </div>
            );
          })}

          {hoverId && hoverId !== selected?.elementId && doc.elements[hoverId] && !activeGesture && (
            <div className={styles.hover} style={rectStyle(doc.elements[hoverId])} />
          )}

          {/* 함께 선택한 요소들: 테두리만 (핸들 없음) */}
          {multi &&
            selectionIds.map((id) => doc.elements[id] && <div key={`multi-${id}`} className={styles.selection} data-multi="true" style={rectStyle(doc.elements[id])} />)}

          {/* 드래그 영역 선택 */}
          {marquee && <div className={styles.marquee} style={{ left: marquee.x, top: marquee.y, width: marquee.width, height: marquee.height }} />}

          {/* 내 선택 + 핸들 */}
          {selected && !multi && (
            <div className={styles.selection} style={rectStyle(selected)} data-editing={editingId === selected.elementId}>
              {/* 표는 크기가 행·열 수로 정해지므로 크기 조절 핸들이 없다 */}
              {editingId !== selected.elementId &&
                !isTable(selected) &&
                !claimOwner(selected) &&
                (isText(selected) ? WIDTH_HANDLES : HANDLES).map((dir) => (
                  <span key={dir} className={styles.handle} data-dir={dir} onPointerDown={(e) => beginGesture(e, selected, 'resize', dir)} />
                ))}
              {/* 표는 아래쪽에 행 추가 막대가 있으므로 이동 중에만 좌표를 보여 준다 */}
              {(activeGesture === 'move' || !isTable(selected)) && !claimOwner(selected) && (
                <span className={styles.sizeBadge}>
                  {activeGesture === 'move'
                    ? `X ${selected.props.position.x} · Y ${selected.props.position.y}`
                    : `${sizeOf(selected).width} × ${sizeOf(selected).height}`}
                </span>
              )}
            </div>
          )}

          {guides.map((g, i) => (
            <div key={i} className={g.axis === 'x' ? styles.guideX : styles.guideY} style={g.axis === 'x' ? { left: g.at } : { top: g.at }} />
          ))}

          {/* 다른 사용자의 커서 */}
          {others.map((u) => {
            const c = presence[u.userId].cursor;
            if (!c) return null;
            return (
              <div key={`cur-${u.userId}`} className={styles.cursor} style={{ ...userStyle(u), left: c.x, top: c.y }}>
                <svg viewBox="0 0 16 16" className={styles.cursorArrow}>
                  <path d="M2 1.5 13.5 7 8 8.5 6 14 2 1.5Z" fill="var(--user-color)" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <span className={styles.cursorName}>{u.name}</span>
              </div>
            );
          })}
        </div>

        {/* 선택한 요소의 서식 툴바 (배율과 상관없이 같은 크기로 요소 위에 뜬다). 끄는 중에는 숨김 */}
        {selected && !multi && doc.blocks[selected.blockId] && !activeGesture && (
          <ElementToolbar key={toolbarKey.current?.key ?? selected.elementId} el={selected} block={doc.blocks[selected.blockId]} rect={rectOf(selected)} zoom={zoom} />
        )}
        {multi && !activeGesture && (
          <GroupToolbar
            rect={boundsOf(selectionIds)}
            zoom={zoom}
            count={selectionIds.length}
            onDuplicate={() => actions.duplicate(selectionIds)}
            onDelete={() => actions.remove(selectionIds)}
          />
        )}
      </div>
    </main>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu)} onClose={closeMenu} />}

      <div className={styles.zoomBar} onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => stepZoom(-1)} aria-label="축소">
          <Icon name="minus" size={14} />
        </button>
        <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => stepZoom(1)} aria-label="확대">
          <Icon name="plus" size={14} />
        </button>
        <span className={styles.zoomDivider} />
        <button type="button" onClick={() => setFit(true)} data-active={fit} aria-label="화면에 맞추기" title="화면에 맞추기">
          <Icon name="fit" size={14} />
        </button>
      </div>
    </div>
  );
}
