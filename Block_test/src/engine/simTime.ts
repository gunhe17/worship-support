/**
 * 시뮬레이션 시각 (DB_SCHEMA.md §7.10).
 * 모든 시각은 고정 기준 시각 + 시뮬레이션 경과 ms로 만든다. 실제 시스템 시각을 사용하지 않는다.
 */
export const SIM_EPOCH = Date.UTC(2026, 0, 1, 14, 0, 0, 0);

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** 경과 ms → "2026-01-01 14:00:00.000" (타임존 표기 없이 UTC 기준 값 사용) */
export function simTimestamp(elapsedMs: number): string {
  const d = new Date(SIM_EPOCH + elapsedMs);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`
  );
}

/** 경과 ms → "14:00:01.030" */
export function simClock(elapsedMs: number): string {
  return simTimestamp(elapsedMs).slice(11);
}
