import { useEffect, useRef, useState } from 'react';
import type { CrudChange } from '../engine/db/mockDatabase';

/** 변경 강조 유지 시간 (실제 시간). 강조는 사라지지만 CRUD 이력은 유지된다 (CLAUDE_PROMPT §5) */
export const HIGHLIGHT_MS = 4000;

/**
 * 화면에 처음 나타난 시점 기준으로 HIGHLIGHT_MS 동안 "새 변경"으로 취급한다.
 * 시뮬레이션 시간이 아니라 실제 시간으로 판단한다 (일시정지 중에도 강조가 사라짐).
 * 첫 렌더링 시점에 이미 있던 변경은 강조하지 않는다.
 */
export function useFreshChanges(changes: readonly CrudChange[]): Set<string> {
  const seenAt = useRef<Map<string, number> | null>(null);
  const [, force] = useState(0);

  if (seenAt.current === null) seenAt.current = new Map(changes.map((c) => [c.changeId, -Infinity]));
  const now = performance.now();
  for (const c of changes) if (!seenAt.current.has(c.changeId)) seenAt.current.set(c.changeId, now);

  const fresh = new Set<string>();
  let nextExpiry = Infinity;
  for (const [id, t] of seenAt.current) {
    const left = t + HIGHLIGHT_MS - now;
    if (left > 0) {
      fresh.add(id);
      nextExpiry = Math.min(nextExpiry, left);
    }
  }

  useEffect(() => {
    if (nextExpiry === Infinity) return;
    const timer = setTimeout(() => force((n) => n + 1), nextExpiry + 20);
    return () => clearTimeout(timer);
  });

  return fresh;
}
