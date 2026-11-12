import type { UserId } from '../../engine/types';
import type { DocumentView } from '../model/documentModel';
import { applyOp, type EditorOp } from '../model/ops';

/**
 * Phase 1 전용: 서버 승인 결과를 로컬에서 흉내 내는 함수.
 * revision과 속성별 lastActor를 갱신한다. Lock, Fencing, Debounce는 Phase 3에서 엔진이 담당한다.
 */
export function applyAuthoritative(view: DocumentView, op: EditorOp, actor: UserId): DocumentView {
  const next = applyOp(view, op);
  if (next === view) return view;

  if (op.type === 'PROPERTY_UPDATE') {
    if (op.target.scope === 'block') {
      const block = next.blocks[op.target.blockId];
      const revision = block.revision + 1;
      const prevMeta = block.properties[op.propertyPath];
      return {
        ...next,
        blocks: {
          ...next.blocks,
          [block.blockId]: {
            ...block,
            revision,
            properties: {
              ...block.properties,
              [op.propertyPath]: { revision: (prevMeta?.revision ?? 0) + 1, lastActorUserId: actor },
            },
          },
        },
      };
    }
    const el = next.elements[op.target.elementId];
    const prevMeta = el.properties[op.propertyPath];
    const template = next.templates[el.templateId];
    return {
      ...next,
      elements: {
        ...next.elements,
        [el.elementId]: {
          ...el,
          properties: {
            ...el.properties,
            [op.propertyPath]: { revision: (prevMeta?.revision ?? 0) + 1, lastActorUserId: actor },
          },
        },
      },
      templates: { ...next.templates, [template.templateId]: { ...template, revision: template.revision + 1 } },
    };
  }

  // 구조 변경: 템플릿 revision과 structureRevision 증가
  const template = next.templates[op.templateId];
  const elements = { ...next.elements };
  if (op.type === 'ELEMENT_CREATE' || op.type === 'ELEMENT_RESTORE') {
    const el = elements[op.elementId];
    if (el) elements[op.elementId] = { ...el, provisional: op.type === 'ELEMENT_CREATE' };
  }
  return {
    ...next,
    elements,
    templates: {
      ...next.templates,
      [template.templateId]: {
        ...template,
        revision: template.revision + 1,
        structureRevision: template.structureRevision + 1,
      },
    },
  };
}
