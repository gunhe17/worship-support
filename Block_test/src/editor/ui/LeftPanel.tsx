import type { DragEvent } from 'react';
import type { BlockKind } from '../../engine/types';
import { useDevInfo, useIntent, useLocalState, useViewerReplica } from '../editorContext';
import { kindDef } from '../model/elementRegistry';
import type { LocalStatePatch } from '../model/intents';
import { Icon } from './icons';
import styles from './leftPanel.module.css';

export const ELEMENT_DRAG_MIME = 'application/x-template-element-kind';

/**
 * 요소 추가 직후의 선택 상태: 추가하자마자 키보드로 바로 입력할 수 있게 포커스를 옮긴다.
 *  - 텍스트·제목: 캔버스에서 바로 입력
 *  - 표: 첫 셀을 캔버스에서 바로 입력
 *  - 목록: 첫 항목을 캔버스에서 바로 입력
 *  - 그 밖의 요소: 선택 후 오른쪽 패널의 첫 입력칸에 포커스 (requestFieldFocus)
 */
export function afterCreateSelection(kind: BlockKind, elementId: string): LocalStatePatch {
  if (kind === 'table') return { selectedElementId: elementId, selectedPropertyPath: 'data', localSelection: { editingElementId: elementId } };
  if (kind === 'list') return { selectedElementId: elementId, selectedPropertyPath: 'items', localSelection: { editingElementId: elementId } };
  if (kind === 'text' || kind === 'title')
    return { selectedElementId: elementId, selectedPropertyPath: 'content', localSelection: { editingElementId: elementId } };
  requestFieldFocus(elementId);
  return { selectedElementId: elementId, selectedPropertyPath: null };
}

/** 방금 추가한 요소: Inspector가 처음 그려질 때 첫 입력칸에 포커스한다 (한 번만) */
let pendingFieldFocus: string | null = null;
export function requestFieldFocus(elementId: string): void {
  pendingFieldFocus = elementId;
}
export function takeFieldFocus(elementId: string): boolean {
  if (pendingFieldFocus !== elementId) return false;
  pendingFieldFocus = null;
  return true;
}

/** 요소 추가 목록: 구분 없이 한 줄씩 쌓아 모두 한눈에 보이게 한다 */
const TOOL_KINDS: BlockKind[] = ['title', 'text', 'list', 'table', 'image', 'video', 'song', 'file', 'link', 'embed'];

function ToolsTab() {
  const intent = useIntent();
  const devInfo = useDevInfo();
  const local = useLocalState();
  const replica = useViewerReplica();

  const add = (kind: BlockKind) => {
    const r = intent({ type: 'addElement', templateId: replica.viewingTemplateId, kind });
    if (r.ok && r.createdElementId) local(afterCreateSelection(kind, r.createdElementId));
  };

  const onDragStart = (e: DragEvent, kind: BlockKind) => {
    e.dataTransfer.setData(ELEMENT_DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <>
      <div className={styles.drawerHeader}>
        <span className={styles.drawerTitle}>요소 추가</span>
        <span className={styles.drawerHint}>클릭 또는 드래그</span>
      </div>
      <div className={styles.drawerBody}>
        <div className={styles.toolList}>
          {TOOL_KINDS.map((kind) => {
            const def = kindDef(kind);
            return (
              <button
                key={kind}
                type="button"
                className={styles.tool}
                draggable
                onDragStart={(e) => onDragStart(e, kind)}
                onClick={() => add(kind)}
                title={devInfo ? `${def.label} 추가 → ELEMENT_CREATE (즉시 저장)` : '클릭하면 추가, 끌어서 원하는 위치에 놓기'}
              >
                <span className={styles.toolPreview}>
                  <Icon name={kind} size={16} />
                </span>
                <span className={styles.toolLabel}>{def.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** 왼쪽: 요소 추가만 (레이어는 오른쪽 패널) */
export function LeftPanel() {
  return (
    <aside className={styles.panel}>
      <div className={styles.drawer}>
        <ToolsTab />
      </div>
    </aside>
  );
}
