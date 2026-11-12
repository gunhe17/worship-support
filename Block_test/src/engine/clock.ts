/**
 * VirtualClock (CLAUDE_PROMPT §7, DB_SCHEMA §7.10).
 * 실제 타이머와 분리된 가상 시계. 모든 예약 작업(네트워크 지연, Debounce, 재시도, TTL)은 이 시계로 실행한다.
 * - 같은 시각의 작업은 예약 순서대로 실행한다 (결정성).
 * - 실행 중 새로 예약된 작업도 진행 범위 안이면 같은 advance에서 실행한다.
 */

export interface TimerInfo {
  id: number;
  dueAt: number;
  label: string;
}

interface Timer extends TimerInfo {
  seq: number;
  fn: () => void;
}

export class VirtualClock {
  private _now = 0;
  private seq = 0;
  private nextId = 1;
  private timers: Timer[] = [];
  /** 예약 목록이 바뀔 때마다 증가 (스냅샷 캐시 키). 현재 시각 변화는 포함하지 않는다. */
  version = 0;

  get now(): number {
    return this._now;
  }

  schedule(delayMs: number, label: string, fn: () => void): number {
    const id = this.nextId++;
    this.timers.push({ id, dueAt: this._now + Math.max(0, delayMs), seq: this.seq++, label, fn });
    this.timers.sort((a, b) => a.dueAt - b.dueAt || a.seq - b.seq);
    this.version++;
    return id;
  }

  cancel(id: number | null | undefined): boolean {
    if (id == null) return false;
    const before = this.timers.length;
    this.timers = this.timers.filter((t) => t.id !== id);
    if (this.timers.length !== before) this.version++;
    return this.timers.length !== before;
  }

  /** 다음 예약 작업 */
  peek(): TimerInfo | null {
    const t = this.timers[0];
    return t ? { id: t.id, dueAt: t.dueAt, label: t.label } : null;
  }

  pending(): TimerInfo[] {
    return this.timers.map(({ id, dueAt, label }) => ({ id, dueAt, label }));
  }

  /** now + ms까지 진행하며 그 사이 예약 작업을 실행한다 */
  advanceBy(ms: number): number {
    return this.advanceTo(this._now + Math.max(0, ms));
  }

  advanceTo(target: number): number {
    let ran = 0;
    while (this.timers.length > 0 && this.timers[0].dueAt <= target) {
      this.runFirst();
      ran++;
    }
    if (target > this._now) this._now = target;
    return ran;
  }

  /** 단계별 진행: 다음 예약 작업 하나를 실행한다 (그 시각으로 이동) */
  step(): TimerInfo | null {
    const t = this.timers[0];
    if (!t) return null;
    this.runFirst();
    return { id: t.id, dueAt: t.dueAt, label: t.label };
  }

  /** 예약 작업이 없을 때까지 진행 (테스트·precondition용). 무한 예약 방지 상한 포함 */
  runUntilIdle(limit = 10_000): number {
    let ran = 0;
    while (this.timers.length > 0) {
      if (ran++ >= limit) throw new Error('VirtualClock.runUntilIdle: limit exceeded');
      this.runFirst();
    }
    return ran;
  }

  private runFirst(): void {
    const t = this.timers.shift()!;
    if (t.dueAt > this._now) this._now = t.dueAt;
    this.version++;
    t.fn();
  }
}
