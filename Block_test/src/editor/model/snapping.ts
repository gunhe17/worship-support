/** 이동 시 스냅 가이드 계산 (페이지 가장자리·중앙, 다른 요소의 가장자리·중앙) */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: 'x' | 'y';
  /** 페이지 좌표 */
  at: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

const xs = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
const ys = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];

function bestDelta(own: number[], targets: number[], threshold: number) {
  let best: { delta: number; at: number } | null = null;
  for (const t of targets) {
    for (const o of own) {
      const delta = t - o;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t };
    }
  }
  return best;
}

export function snapRect(rect: Rect, others: Rect[], page: { width: number; height: number }, threshold: number): SnapResult {
  const pageRect = { x: 0, y: 0, ...page };
  const tx = [...xs(pageRect), ...others.flatMap(xs)];
  const ty = [...ys(pageRect), ...others.flatMap(ys)];
  const bx = bestDelta(xs(rect), tx, threshold);
  const by = bestDelta(ys(rect), ty, threshold);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { x: rect.x + (bx?.delta ?? 0), y: rect.y + (by?.delta ?? 0), guides };
}

export type HandleDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** 핸들 방향과 이동량으로 새 사각형 계산 (최소 크기 보장) */
export function resizeRect(start: Rect, dir: HandleDir, dx: number, dy: number, min = 24): Rect {
  let { x, y, width, height } = start;
  if (dir.includes('e')) width = Math.max(min, start.width + dx);
  if (dir.includes('s')) height = Math.max(min, start.height + dy);
  if (dir.includes('w')) {
    width = Math.max(min, start.width - dx);
    x = start.x + start.width - width;
  }
  if (dir.includes('n')) {
    height = Math.max(min, start.height - dy);
    y = start.y + start.height - height;
  }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
