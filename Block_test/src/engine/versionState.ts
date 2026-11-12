import { CONTENT_TABLE_BY_KIND } from './db/schema';
import type { WorldState } from './engine';
import { liveBlockKey, liveTemplateKey, type LiveBlock, type LiveTemplate } from './server/liveState';
import { simTimestamp } from './simTime';
import type { BlockKind, Json, TableName } from './types';
import { contentColumns, same as sameCanon, snapshotOf } from './versionCompare';

const readString = <T>(w: WorldState, key: string): T | null => {
  const v = w.redis[key];
  return v?.type === 'string' ? (v.value as unknown as T) : null;
};

const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b);

/**
 * 방금 복원해서 "다시 복원해도 바뀌는 것이 없는" 버전 ID (읽기 전용 판정, DB·Redis를 바꾸지 않는다).
 *
 * 조건: 현재 버전이 X에서 복원된 버전이고, 그 뒤로 아무것도 수정되지 않았다.
 *  - 구성(요소 집합·순서·render_zone·배치)이 현재 template_version_element와 같다
 *  - 템플릿 요소·블록 속성 중 현재 버전 생성 시각 이후에 수정된 것이 없다
 * 수정이 한 번이라도 일어나면 null → 복원 버튼 다시 활성화.
 */
export function restoredUnchangedVersionId(w: WorldState, templateId: string): string | null {
  const template = w.tables.template.find((t) => t.id === templateId);
  const currentId = (template?.current_version_id as string | null) ?? null;
  if (!currentId) return null;
  const current = w.tables.template_version.find((v) => v.id === currentId);
  const from = (current?.restored_from_version_id as string | null) ?? null;
  if (!current || !from) return null;

  const live = readString<LiveTemplate>(w, liveTemplateKey(templateId));
  if (!live) return null;

  // 1) 구성 비교
  const tve = w.tables.template_version_element
    .filter((r) => r.template_version_id === currentId)
    .map((r) => ({ e: r.template_element_id as string, s: r.sequence, z: r.render_zone, p: r.props as Json }))
    .sort((a, b) => a.e.localeCompare(b.e));
  const now = Object.entries(live.elements)
    .map(([e, el]) => ({ e, s: el.sequence, z: el.renderZone, p: el.props as unknown as Json }))
    .sort((a, b) => a.e.localeCompare(b.e));
  if (!same(tve as unknown as Json, now as unknown as Json)) return null;

  // 2) 복원 이후 속성 수정 여부 (요소 배치 + 블록 콘텐츠)
  const createdAt = String(current.created_at);
  const after = (meta: Record<string, { updatedAt: number }>) => Object.values(meta).some((m) => simTimestamp(m.updatedAt) > createdAt);
  if (Object.values(live.elements).some((el) => after(el.properties))) return null;
  for (const blockId of new Set(Object.values(live.elements).map((el) => el.blockId))) {
    const block = readString<LiveBlock>(w, liveBlockKey(blockId));
    if (block && after(block.properties)) return null;
  }
  return from;
}

/**
 * 지금 저장하면 새 버전이 만들어지는가 (읽기 전용 판정, 서버의 NO_CHANGES 판정 §7.7과 같은 기준).
 *  - 블록: Live content ≠ current_version 콘텐츠 스냅샷
 *  - 구성: 요소 집합·순서·render_zone·배치·참조 block_version ≠ 현재 template_version_element
 * "버전 저장" 버튼 활성화에 쓴다. 최종 판정은 서버가 한다.
 */
export function hasVersionChanges(w: WorldState, templateId: string): boolean {
  const live = readString<LiveTemplate>(w, liveTemplateKey(templateId));
  if (!live) return false;
  const blockRows = new Map(w.tables.block.map((b) => [b.id as string, b]));

  // 블록이 하나라도 바뀌었으면 새 버전이 생긴다 (이후 구성 비교의 참조 버전은 모두 current_version_id)
  for (const blockId of new Set(Object.values(live.elements).map((e) => e.blockId))) {
    const liveBlock = readString<LiveBlock>(w, liveBlockKey(blockId));
    const row = blockRows.get(blockId);
    if (!liveBlock || !row) return true;
    const table = CONTENT_TABLE_BY_KIND[row.kind as BlockKind] as TableName;
    const current = (row.current_version_id as string | null) ?? null;
    const snapshot = current ? snapshotOf(table, w.tables[table].find((r) => r.id === current)) : null;
    if (!snapshot || !sameCanon(contentColumns(table, liveBlock.content), snapshot)) return true;
  }

  const currentTv = (w.tables.template.find((t) => t.id === templateId)?.current_version_id as string | null) ?? null;
  const byElement = <T extends { e: string }>(rows: T[]) => [...rows].sort((a, b) => a.e.localeCompare(b.e));
  const tve = currentTv
    ? w.tables.template_version_element
        .filter((r) => r.template_version_id === currentTv)
        .map((r) => ({ e: r.template_element_id as string, bv: r.block_version_id, s: r.sequence, z: r.render_zone, p: r.props }))
    : [];
  const composition = Object.entries(live.elements).map(([e, el]) => ({
    e,
    bv: (blockRows.get(el.blockId)?.current_version_id as string | null) ?? null,
    s: el.sequence,
    z: el.renderZone,
    p: el.props as unknown as Json,
  }));
  return !sameCanon(byElement(composition) as unknown as Json, byElement(tve) as unknown as Json);
}
