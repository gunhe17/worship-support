/** Redis Lock 키 규칙 (DB_SCHEMA.md §4, §7.5) */
export const blockLockKey = (blockId: string, propertyPath: string) => `lock:block:${blockId}:${propertyPath}`;

export const elementLockKey = (templateId: string, elementId: string, propertyPath: string) =>
  `lock:template:${templateId}:element:${elementId}:${propertyPath}`;

/** 요소(배치) 또는 그 블록(콘텐츠)의 Lock 중 하나를 다른 사용자가 보유하면 그 소유자. 삭제 차단 판정용 (§8.10.5) */
export function elementLockOwner(
  foreignLocks: Record<string, string>,
  el: { templateId: string; elementId: string; blockId: string },
): string | null {
  const prefixes = [`lock:template:${el.templateId}:element:${el.elementId}:`, `lock:block:${el.blockId}:`];
  const key = Object.keys(foreignLocks).find((k) => prefixes.some((p) => k.startsWith(p)));
  return key ? foreignLocks[key] : null;
}

/**
 * 요소 편집 권한 (v1.2.8, DB_SCHEMA §7.5.1). 요소를 선택한 사용자가 갖고, 그 요소에서 나가거나 연결이 끊기면 해제된다.
 * 다른 사용자가 보유하면 그 요소와 블록의 모든 속성 Lock 요청이 거부된다 (선택만 가능).
 */
export const CLAIM_PATH = 'edit';
export const claimLockKey = (templateId: string, elementId: string) => elementLockKey(templateId, elementId, CLAIM_PATH);

const CLAIM_RE = /^lock:template:([^:]+):element:([^:]+):edit$/;
export const isClaimKey = (key: string) => CLAIM_RE.test(key);
export function parseClaimKey(key: string): { templateId: string; elementId: string } | null {
  const m = CLAIM_RE.exec(key);
  return m ? { templateId: m[1], elementId: m[2] } : null;
}

/** 편집 권한 대기열 (먼저 선택한 사용자부터 넘겨받는다) */
export const claimWaitKey = (claimKey: string) => `lockwait:${claimKey.slice('lock:'.length)}`;
