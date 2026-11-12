import type { Json, JsonObject } from '../../engine/types';
import { useIntent, useViewerDocument, useViewerReplica } from '../editorContext';
import { elementsOf, type BlockView, type ElementView } from '../model/documentModel';
import { findPropertyDef } from '../model/elementRegistry';
import type { IntentResult } from '../model/intents';
import { isAutoHeightKind, measureTextHeight } from './textMeasure';

let seq = 0;
export const newTextGesture = () => `text-${Date.now().toString(36)}-${++seq}`;

/** content의 jsonPath(예: "style.fontSize")에 값을 넣은 새 블록 (표시 계산용 사본) */
function withProperty(block: BlockView, jsonPath: string, value: Json): BlockView {
  const content = structuredClone(block.content) as JsonObject;
  const keys = jsonPath.split('.');
  let node = content;
  for (const k of keys.slice(0, -1)) {
    const child = node[k];
    node[k] = child && typeof child === 'object' && !Array.isArray(child) ? child : {};
    node = node[k] as JsonObject;
  }
  node[keys[keys.length - 1]] = value;
  return { ...block, content };
}

/** 너비가 바뀔 때 텍스트 요소의 높이도 함께 바꾼 배치 변경 */
export function autoHeightChanges(block: BlockView | undefined, width: number): Record<string, number> {
  const h = block && isAutoHeightKind(block.kind) ? measureTextHeight(block, width) : null;
  return h === null ? { 'size.width': width } : { 'size.width': width, 'size.height': h };
}

/**
 * 블록 속성 편집. 텍스트·제목은 내용이나 글자 크기가 바뀌면 이 블록을 쓰는 요소(현재 템플릿)의 높이를 내용에 맞춘다.
 * 두 변경은 같은 gestureId로 보내 Undo 한 번에 함께 되돌린다. 모두 Simulation Engine(intent)을 거친다.
 */
export function useEditBlockProperty(): (block: BlockView, path: string, value: Json, gestureId?: string) => IntentResult {
  const intent = useIntent();
  const doc = useViewerDocument();
  const replica = useViewerReplica();
  return (block, path, value, gestureId) => {
    if (!isAutoHeightKind(block.kind)) return intent({ type: 'editProperty', blockId: block.blockId, propertyPath: path, value, gestureId });
    const gesture = gestureId ?? newTextGesture();
    const r = intent({ type: 'editProperty', blockId: block.blockId, propertyPath: path, value, gestureId: gesture });
    if (!r.ok) return r;
    const def = findPropertyDef(block.kind, path);
    const next = withProperty(block, def?.jsonPath ?? path, value);
    for (const el of elementsOf(doc, replica.viewingTemplateId)) {
      if (el.blockId !== block.blockId) continue;
      fitHeight(el, next, gesture);
    }
    return r;
  };

  function fitHeight(el: ElementView, block: BlockView, gestureId: string) {
    const h = measureTextHeight(block, el.props.size.width);
    if (h === null || h === el.props.size.height) return;
    intent({ type: 'editPlacement', templateId: el.templateId, elementId: el.elementId, changes: { 'size.height': h }, gestureId });
  }
}
