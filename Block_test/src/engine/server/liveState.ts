import type { MockDatabase } from '../db/mockDatabase';
import type { TargetKey } from '../protocol';
import type { MockRedis } from '../redis/mockRedis';
import type { BlockKind, Json, JsonObject, Placement, UserId } from '../types';

/**
 * Redis live:* 상태 (DB_SCHEMA §4 "Live 상태", §7.2).
 * 서버가 승인한 최신 상태의 원본이다. PostgreSQL Live 테이블보다 앞서 있을 수 있다.
 */

export interface LivePropertyMeta {
  /** 속성 revision (property_state.revision) */
  revision: number;
  lastActorUserId: UserId | null;
  /** 마지막 승인 시각 (sim ms) */
  updatedAt: number;
  /** 이 속성이 PostgreSQL에 저장된 속성 revision */
  persistedRevision: number;
  /** 마지막으로 PostgreSQL에 기록된 fencing token */
  lastFencingToken: number;
}

/** 아직 PostgreSQL에 저장되지 않은 대상 revision과 그 revision을 만든 속성 (§7.3) */
export interface UnpersistedRevision {
  revision: number;
  /** block: property_path · template: {elementId}:{property_path} */
  key: string;
}

export interface LiveBlock {
  blockId: string;
  kind: BlockKind;
  content: JsonObject;
  revision: number;
  properties: Record<string, LivePropertyMeta>;
  /** 아직 PostgreSQL에 저장되지 않은 블록 revision 목록 (§7.3) */
  unpersisted: UnpersistedRevision[];
  lastActorUserId: UserId | null;
}

export interface LiveElement {
  blockId: string;
  sequence: number;
  renderZone: string;
  props: Placement;
  properties: Record<string, LivePropertyMeta>;
}

export interface LiveTemplate {
  templateId: string;
  revision: number;
  structureRevision: number;
  elements: Record<string, LiveElement>;
  unpersisted: UnpersistedRevision[];
  lastActorUserId: UserId | null;
  /** 삭제된 요소의 속성 메타 (ELEMENT_RESTORE 시 property revision 연속성 유지) */
  tombstones?: Record<string, Record<string, LivePropertyMeta>>;
}

export const liveBlockKey = (blockId: string) => `live:block:${blockId}`;
export const liveTemplateKey = (templateId: string) => `live:template:${templateId}`;

const asJson = <T>(v: T) => v as unknown as Json;

/** 엔진 시작 시 PostgreSQL Live 테이블로부터 live:* 키를 만든다 */
export function bootstrapLiveState(db: MockDatabase, redis: MockRedis): void {
  for (const b of db.tables.block) {
    const row = db.get('block_live_state', { block_id: b.id });
    const live: LiveBlock = {
      blockId: b.id as string,
      kind: b.kind as BlockKind,
      content: structuredClone((row?.content as JsonObject) ?? {}),
      revision: (row?.revision as number) ?? 0,
      properties: {},
      unpersisted: [],
      lastActorUserId: null,
    };
    redis.set(liveBlockKey(live.blockId), asJson(live));
  }
  for (const t of db.tables.template) bootstrapTemplateLive(db, redis, t.id as string);
}

/** PostgreSQL Live 테이블로부터 live:template:{id}를 만든다 */
export function bootstrapTemplateLive(db: MockDatabase, redis: MockRedis, templateId: string): void {
  {
    const t = { id: templateId };
    const row = db.get('template_live_state', { template_id: t.id });
    const elements: Record<string, LiveElement> = {};
    for (const e of db.select('template_live_element', { template_id: t.id })) {
      elements[e.template_element_id as string] = {
        blockId: e.block_id as string,
        sequence: e.sequence as number,
        renderZone: e.render_zone as string,
        props: structuredClone(e.props) as unknown as Placement,
        properties: {},
      };
    }
    const live: LiveTemplate = {
      templateId: t.id as string,
      revision: (row?.revision as number) ?? 0,
      structureRevision: 0,
      elements,
      unpersisted: [],
      lastActorUserId: null,
    };
    redis.set(liveTemplateKey(live.templateId), asJson(live));
  }
}

export function readLiveBlock(redis: MockRedis, blockId: string): LiveBlock | null {
  return redis.get(liveBlockKey(blockId)) as unknown as LiveBlock | null;
}

export function readLiveTemplate(redis: MockRedis, templateId: string): LiveTemplate | null {
  return redis.get(liveTemplateKey(templateId)) as unknown as LiveTemplate | null;
}

export function writeLiveBlock(redis: MockRedis, live: LiveBlock): void {
  redis.set(liveBlockKey(live.blockId), asJson(live));
}

export function writeLiveTemplate(redis: MockRedis, live: LiveTemplate): void {
  redis.set(liveTemplateKey(live.templateId), asJson(live));
}

/** 연속 저장 완료된 최대 revision (§7.3): 가장 작은 미저장 revision - 1, 없으면 현재 revision */
export function contiguousPersisted(live: { revision: number; unpersisted: UnpersistedRevision[] }): number {
  if (live.unpersisted.length === 0) return live.revision;
  return Math.min(...live.unpersisted.map((u) => u.revision)) - 1;
}

/** 대상의 현재 승인 revision (없으면 0) */
export function liveRevisionOf(redis: MockRedis, target: TargetKey): number {
  const [kind, id] = target.split(':') as ['block' | 'template', string];
  const live = kind === 'block' ? readLiveBlock(redis, id) : readLiveTemplate(redis, id);
  return live?.revision ?? 0;
}

/** 템플릿이 현재 배치한 블록 ID 목록 */
export function blocksOfTemplate(redis: MockRedis, templateId: string): string[] {
  const live = readLiveTemplate(redis, templateId);
  if (!live) return [];
  return [...new Set(Object.values(live.elements).map((e) => e.blockId))].sort();
}

/** 블록을 배치한 템플릿 ID 목록 (공유 블록은 여러 개, §5) */
export function templatesContainingBlock(redis: MockRedis, blockId: string): string[] {
  return redis
    .keys('live:template:*')
    .map((k) => k.slice('live:template:'.length))
    .filter((tid) => blocksOfTemplate(redis, tid).includes(blockId));
}

/** 템플릿을 볼 때 동기화해야 하는 대상 키: 템플릿 자신 + 배치된 블록들 */
export function targetsOfTemplate(redis: MockRedis, templateId: string): TargetKey[] {
  return [`template:${templateId}`, ...blocksOfTemplate(redis, templateId).map((b) => `block:${b}` as TargetKey)];
}
