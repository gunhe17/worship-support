import type { DocumentView } from '../../editor/model/documentModel';
import { applyOp } from '../../editor/model/ops';
import type { ReplicaState } from '../../editor/model/replica';
import type { ChangeEnvelope } from '../protocol';

/**
 * 서버가 승인한 변경(ChangeEnvelope)을 클라이언트 documentView에 반영한다.
 * revision과 속성별 lastActor는 서버가 정한 값을 그대로 사용한다.
 */
export function applyChange(view: DocumentView, env: ChangeEnvelope): DocumentView {
  const op = env.op;
  const next = applyOp(view, op);
  const meta = (prev?: { revision: number }) => ({
    revision: env.propertyRevision ?? (prev?.revision ?? 0) + 1,
    lastActorUserId: env.actorUserId,
  });

  if (op.type === 'PROPERTY_UPDATE') {
    if (op.target.scope === 'block') {
      const block = next.blocks[op.target.blockId];
      if (!block) return next;
      return {
        ...next,
        blocks: {
          ...next.blocks,
          [block.blockId]: {
            ...block,
            revision: env.revision,
            properties: { ...block.properties, [op.propertyPath]: meta(block.properties[op.propertyPath]) },
          },
        },
      };
    }
    const el = next.elements[op.target.elementId];
    const template = next.templates[op.target.templateId];
    if (!el || !template) return next;
    return {
      ...next,
      elements: {
        ...next.elements,
        [el.elementId]: { ...el, properties: { ...el.properties, [op.propertyPath]: meta(el.properties[op.propertyPath]) } },
      },
      templates: { ...next.templates, [template.templateId]: { ...template, revision: env.revision } },
    };
  }

  const template = next.templates[op.templateId];
  if (!template) return next;
  const elements = { ...next.elements };
  if ((op.type === 'ELEMENT_CREATE' || op.type === 'ELEMENT_RESTORE') && elements[op.elementId])
    elements[op.elementId] = { ...elements[op.elementId], provisional: false };
  return {
    ...next,
    elements,
    templates: {
      ...next.templates,
      [template.templateId]: {
        ...template,
        revision: env.revision,
        structureRevision: env.structureRevision ?? template.structureRevision + 1,
      },
    },
  };
}

export type ChangeCheck = 'apply' | 'duplicate' | 'gap' | 'out-of-order';

/**
 * 실시간 Delivery 검증 (§8.9.1).
 * - duplicate: revision ≤ lastReceivedRevision[target] → 무시 (상태를 되돌리지 않음)
 * - out-of-order: 같은 연결에서 streamSeq < lastProcessedSeq
 * - gap: revision > lastReceivedRevision[target] + 1 (대상별 연속성으로만 판단. 전역 순번이 건너뛰는 것은 정상)
 */
export function checkChange(replica: ReplicaState, lastProcessedSeq: number, env: ChangeEnvelope): ChangeCheck {
  const last = replica.lastReceivedRevision[env.target] ?? 0;
  if (env.revision <= last) return 'duplicate';
  if (env.streamSeq < lastProcessedSeq) return 'out-of-order';
  if (env.revision > last + 1) return 'gap';
  return 'apply';
}

/**
 * Delivery 수신: 이미 받은 revision 이하는 무시한다 (실시간 수신 후 따라잡기 중복 방지).
 * Delivery가 DELIVERED 될 때만 documentView와 lastReceivedRevision을 갱신한다 (§8.3).
 */
export function receiveChange(replica: ReplicaState, env: ChangeEnvelope): ReplicaState {
  const last = replica.lastReceivedRevision[env.target] ?? 0;
  if (env.revision <= last) return replica;
  const lastReceivedRevision = { ...replica.lastReceivedRevision, [env.target]: env.revision };
  if (env.op.type === 'ELEMENT_CREATE') lastReceivedRevision[`block:${env.op.blockId}`] ??= 0;
  return { ...replica, documentView: applyChange(replica.documentView, env), lastReceivedRevision };
}
