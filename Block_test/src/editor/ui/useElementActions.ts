import type { BlockKind, JsonObject, UserId } from '../../engine/types';
import { useEditorStore, useEditorStoreApi, useForeignLocks, useIntent, useLocalState, useViewerDocument, useViewerReplica } from '../editorContext';
import { elementsOf } from '../model/documentModel';
import { PAGE_SIZE } from '../model/elementRegistry';
import { elementLockOwner } from '../model/lockKeys';
import { pushToast, setMultiSelection } from '../store/editorState';

/**
 * 요소 묶음 동작: 복사 · 붙여넣기 · 복제 · 삭제 · 겹침 순서.
 * 모두 intent → Simulation Engine을 거친다. 클립보드는 편집기 안(사용자별)에만 있다.
 */

interface ClipItem {
  kind: BlockKind;
  content: JsonObject;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/** 사용자별 클립보드와 연속 붙여넣기 횟수 (같은 내용을 여러 번 붙이면 조금씩 비켜 놓는다) */
const clipboards = new Map<UserId, { items: ClipItem[]; pasted: number }>();
const OFFSET = 24;

let seq = 0;
const newGesture = (kind: string) => `${kind}-${Date.now().toString(36)}-${++seq}`;

export function hasClipboard(userId: UserId): boolean {
  return (clipboards.get(userId)?.items.length ?? 0) > 0;
}

export function useElementActions() {
  const intent = useIntent();
  const local = useLocalState();
  const store = useEditorStoreApi();
  const doc = useViewerDocument();
  const replica = useViewerReplica();
  const viewerId = useEditorStore((s) => s.viewerId);
  const users = useEditorStore((s) => s.users);
  const foreignLocks = useForeignLocks();
  const templateId = replica.viewingTemplateId;
  const nameOf = (id: string) => users.find((u) => u.userId === id)?.name ?? id;

  const snapshot = (ids: string[]): ClipItem[] =>
    ids
      .map((id) => doc.elements[id])
      .filter((el) => el && doc.blocks[el.blockId])
      .sort((a, b) => a.sequence - b.sequence)
      .map((el) => ({
        kind: doc.blocks[el.blockId].kind,
        content: structuredClone(doc.blocks[el.blockId].content),
        position: { ...el.props.position },
        size: { ...el.props.size },
      }));

  /** 요소들을 추가하고 모두 선택한다. 한 gesture라 Undo 한 번에 모두 사라진다 */
  const place = (items: ClipItem[], shift: { dx: number; dy: number }) => {
    const gestureId = newGesture('paste');
    const created: string[] = [];
    for (const it of items) {
      const x = Math.max(0, Math.min(PAGE_SIZE.width - it.size.width, it.position.x + shift.dx));
      const y = Math.max(0, Math.min(PAGE_SIZE.height - it.size.height, it.position.y + shift.dy));
      const r = intent({ type: 'addElement', templateId, kind: it.kind, content: it.content, size: it.size, position: { x, y }, gestureId });
      if (r.ok && r.createdElementId) created.push(r.createdElementId);
    }
    if (!created.length) return [];
    select(created);
    return created;
  };

  /** 선택 지정: 첫 요소가 대표 선택(Presence), 나머지는 함께 선택 */
  const select = (ids: string[]) => {
    const primary = ids[ids.length - 1] ?? null;
    local({ selectedElementId: primary, selectedPropertyPath: null, localSelection: { editingElementId: null } });
    setMultiSelection(store, viewerId, primary, ids);
  };

  return {
    select,

    copy(ids: string[]) {
      if (!ids.length) return;
      clipboards.set(viewerId, { items: snapshot(ids), pasted: 0 });
      pushToast(store, { tone: 'info', title: ids.length > 1 ? `${ids.length}개 요소를 복사했어요` : '복사했어요' });
    },

    /** at: 그 위치(페이지 좌표)에 붙여넣기. 없으면 원래 자리에서 조금씩 비켜 놓는다 */
    paste(at?: { x: number; y: number }) {
      const clip = clipboards.get(viewerId);
      if (!clip?.items.length) return [];
      clip.pasted += 1;
      if (at) {
        const left = Math.min(...clip.items.map((i) => i.position.x));
        const top = Math.min(...clip.items.map((i) => i.position.y));
        return place(clip.items, { dx: at.x - left, dy: at.y - top });
      }
      return place(clip.items, { dx: OFFSET * clip.pasted, dy: OFFSET * clip.pasted });
    },

    duplicate(ids: string[]) {
      return place(snapshot(ids), { dx: OFFSET, dy: OFFSET });
    },

    /** 다른 사용자가 편집 중인 요소는 건너뛴다 (최종 판정은 서버 ELEMENT_LOCKED) */
    remove(ids: string[]) {
      const blocked: string[] = [];
      for (const id of ids) {
        const el = doc.elements[id];
        if (!el) continue;
        const owner = elementLockOwner(foreignLocks, el);
        if (owner) {
          blocked.push(owner);
          continue;
        }
        intent({ type: 'deleteElement', templateId, elementId: id });
      }
      if (blocked.length)
        pushToast(store, {
          tone: 'warning',
          title: `${nameOf(blocked[0])}이(가) 편집 중이에요`,
          detail: ids.length > 1 ? `편집 중인 ${blocked.length}개는 삭제하지 않았어요` : '끝날 때까지 삭제할 수 없어요',
        });
    },

    reorder(id: string, where: 'front' | 'forward' | 'backward' | 'back') {
      const ordered = elementsOf(doc, templateId);
      const index = ordered.findIndex((e) => e.elementId === id);
      const last = ordered.length - 1;
      const to = { front: last, forward: Math.min(last, index + 1), backward: Math.max(0, index - 1), back: 0 }[where];
      if (index < 0 || to === index) return;
      intent({ type: 'reorderElement', templateId, elementId: id, toIndex: to });
    },
  };
}
