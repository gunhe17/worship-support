import { getTableDef } from './db/schema';
import type { Json, JsonObject, Row, TableName } from './types';

/**
 * 버전 비교 공통 헬퍼 (저장 판정 §7.7). 서버 VersionService와 UI 읽기 전용 판정(versionState)이 같은 기준을 쓴다.
 */

/** 키 순서와 무관한 JSON 비교 */
export const canon = (v: Json | undefined): string => {
  if (v === undefined || v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
};
export const same = (a: Json | undefined, b: Json | undefined) => canon(a) === canon(b);

/** 콘텐츠 테이블 행 → 스냅샷 (id 제외) */
export function snapshotOf(table: TableName, row: Row | undefined): JsonObject {
  const out: JsonObject = {};
  for (const c of getTableDef(table).columns) if (c.name !== 'id') out[c.name] = row?.[c.name] ?? null;
  return out;
}

/** Live content → 콘텐츠 테이블 컬럼 값 */
export function contentColumns(table: TableName, content: JsonObject): JsonObject {
  const out: JsonObject = {};
  for (const c of getTableDef(table).columns) if (c.name !== 'id') out[c.name] = content[c.name] ?? null;
  return out;
}
