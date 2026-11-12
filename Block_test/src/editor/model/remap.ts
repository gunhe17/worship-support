/**
 * 클라이언트 임시 ID(local-E1, local-B1) → 서버 발급 ID(E002, B002) 치환.
 * Op, Undo 항목처럼 elementId/blockId 필드를 가진 구조를 재귀적으로 바꾼다. 다른 문자열은 건드리지 않는다.
 */
export const isProvisionalId = (id: string | null | undefined): boolean => !!id && id.startsWith('local-');

const ID_FIELDS = new Set(['elementId', 'blockId']);

export function remapIds<T>(value: T, map: ReadonlyMap<string, string>): T {
  if (map.size === 0) return value;
  if (Array.isArray(value)) return value.map((v) => remapIds(v, map)) as T;
  if (!value || typeof value !== 'object') return value;
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    let next = v;
    if (ID_FIELDS.has(k) && typeof v === 'string' && map.has(v)) next = map.get(v);
    else if (v && typeof v === 'object') next = remapIds(v, map);
    if (next !== v) changed = true;
    out[k] = next;
  }
  return (changed ? out : value) as T;
}

/** 값 안에 아직 서버 ID가 발급되지 않은 임시 ID가 있는가 */
export function referencesProvisional(value: unknown, resolved: ReadonlyMap<string, string>): boolean {
  if (Array.isArray(value)) return value.some((v) => referencesProvisional(v, resolved));
  if (!value || typeof value !== 'object') return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (ID_FIELDS.has(k) && typeof v === 'string' && isProvisionalId(v) && !resolved.has(v)) return true;
    if (v && typeof v === 'object' && referencesProvisional(v, resolved)) return true;
  }
  return false;
}
