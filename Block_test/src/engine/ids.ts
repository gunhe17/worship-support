/**
 * 결정적 ID 생성기 (DB_SCHEMA §7.10).
 * 접두사별 순번: REQ001, BC001, DL001, CONN001 ...
 * 시드에 이미 존재하는 순번(B001, BV001, TV001, TVE001, E001)은 initial로 지정한다.
 */
export class IdGenerator {
  private counters = new Map<string, number>();

  constructor(initial: Record<string, number> = {}) {
    for (const [prefix, n] of Object.entries(initial)) this.counters.set(prefix, n);
  }

  next(prefix: string, width = 3): string {
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    return `${prefix}${String(n).padStart(width, '0')}`;
  }

  peek(prefix: string): number {
    return this.counters.get(prefix) ?? 0;
  }
}

/** 시드 데이터가 사용한 순번 */
export const SEED_ID_COUNTERS: Record<string, number> = { B: 1, BV: 1, TV: 1, TVE: 1, E: 1 };
