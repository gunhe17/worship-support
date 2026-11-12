import type { SimulationEngine } from '../../src/engine/engine';
import { liveBlockKey, liveTemplateKey, readLiveBlock, readLiveTemplate } from '../../src/engine/server/liveState';
import type { Json } from '../../src/engine/types';

/**
 * Phase 3 서버 승인을 흉내 내는 테스트 도우미.
 * Redis live:*를 승인 상태로 갱신한 뒤 엔진의 Stream/Broadcast/Delivery 경로로 전파한다.
 */
export function approveContent(engine: SimulationEngine, actor: string, body: string) {
  const redis = engine.internals.redis;
  const live = readLiveBlock(redis, 'B001')!;
  const revision = live.revision + 1;
  redis.set(liveBlockKey('B001'), { ...live, content: { ...live.content, body }, revision } as unknown as Json);
  return engine.server.publishChange({
    name: 'PROPERTY_UPDATED',
    requestId: engine.server.nextRequestId(),
    actorUserId: actor,
    target: 'block:B001',
    revision,
    propertyRevision: revision,
    op: { opId: `t-${revision}`, actorUserId: actor, type: 'PROPERTY_UPDATE', target: { scope: 'block', blockId: 'B001' }, propertyPath: 'content', value: body },
  });
}

export function approveMove(engine: SimulationEngine, actor: string, templateId: string, elementId: string, y: number) {
  const redis = engine.internals.redis;
  const live = readLiveTemplate(redis, templateId)!;
  const revision = live.revision + 1;
  redis.set(liveTemplateKey(templateId), { ...live, revision } as unknown as Json);
  return engine.server.publishChange({
    name: 'PROPERTY_UPDATED',
    requestId: engine.server.nextRequestId(),
    actorUserId: actor,
    target: `template:${templateId}`,
    revision,
    op: { opId: `m-${revision}`, actorUserId: actor, type: 'PROPERTY_UPDATE', target: { scope: 'element', templateId, elementId }, propertyPath: 'position.y', value: y },
  });
}
