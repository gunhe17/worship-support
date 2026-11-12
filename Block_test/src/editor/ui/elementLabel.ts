import type { BlockView } from '../model/documentModel';
import { kindDef } from '../model/elementRegistry';

/** 레이어 목록 등에 표시할 요소 요약 텍스트 */
export function elementSummary(block: BlockView | undefined): string {
  if (!block) return '알 수 없음';
  const c = block.content as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const meta = (c.metadata ?? {}) as Record<string, unknown>;
  const text =
    pick(c.body) ??
    pick(c.content) ??
    pick(c.title) ??
    pick(c.file_name) ??
    pick(meta.title) ??
    pick(c.alt_text) ??
    (Array.isArray(c.items) ? pick(c.items[0]) : null);
  return text ? text.replace(/\s+/g, ' ').slice(0, 40) : kindDef(block.kind).label;
}
