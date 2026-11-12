import type { BlockView } from '../model/documentModel';
import { textStyleOf } from './ElementContent';
import { LIST_ITEM_PLACEHOLDER, listItems } from './ListCanvas';
import styles from './stage.module.css';

/**
 * 텍스트·제목 요소의 자동 높이 (내용에 맞춤).
 * 캔버스와 같은 클래스·스타일로 화면 밖 측정용 노드에 그려 높이를 잰다. 측정은 순수 표시 계산이며 상태를 바꾸지 않는다.
 * 저장되는 size.height는 편집 시 같은 gesture로 함께 갱신된다 (useEditText).
 */

export const isAutoHeightKind = (kind: string | undefined) => kind === 'text' || kind === 'title' || kind === 'list';

const PLACEHOLDER: Record<string, string> = { text: '텍스트를 입력하세요', title: '제목' };
const MIN_HEIGHT = 16;

let probe: HTMLDivElement | null = null;
const cache = new Map<string, number>();

if (typeof document !== 'undefined' && document.fonts?.ready) {
  // 글꼴이 늦게 로드되면 그 전 측정값이 달라질 수 있으므로 한 번 비운다
  void document.fonts.ready.then(() => cache.clear());
}

export function textOf(block: BlockView): string {
  const c = block.content as Record<string, unknown>;
  const v = block.kind === 'title' ? c.content : c.body;
  return typeof v === 'string' ? v : '';
}

function probeNode(): HTMLDivElement {
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    Object.assign(probe.style, { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', pointerEvents: 'none' });
    document.body.appendChild(probe);
  }
  return probe;
}

/** 목록: 항목마다 한 줄 이상. 빈 항목은 안내 문구 길이로 잰다 */
function measureListHeight(block: BlockView, width: number): number {
  const items = listItems(block).map((t) => t || LIST_ITEM_PLACEHOLDER);
  const key = ['list', Math.round(width), ...items].join('\u0001');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const node = probeNode();
  node.className = '';
  node.removeAttribute('style');
  Object.assign(node.style, { position: 'absolute', left: '-10000px', top: '0', visibility: 'hidden', pointerEvents: 'none', width: `${Math.max(1, width)}px` });
  const ul = document.createElement('ul');
  ul.className = styles.list;
  ul.style.height = 'auto';
  for (const t of items) {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  }
  node.replaceChildren(ul);
  const height = Math.max(MIN_HEIGHT, Math.ceil(ul.getBoundingClientRect().height));
  node.replaceChildren();
  if (cache.size > 500) cache.clear();
  cache.set(key, height);
  return height;
}

/** 주어진 너비에서 블록 내용이 차지하는 높이(px, 페이지 좌표). 측정할 수 없는 환경이면 null */
export function measureTextHeight(block: BlockView, width: number, text: string = textOf(block)): number | null {
  if (typeof document === 'undefined' || !isAutoHeightKind(block.kind)) return null;
  if (block.kind === 'list') return measureListHeight(block, width);
  const style = textStyleOf(block);
  const shown = text || PLACEHOLDER[block.kind];
  const key = [block.kind, style.fontSize, style.fontWeight, style.fontStyle, Math.round(width), shown].join('\u0001');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  probe = probeNode();
  probe.className = block.kind === 'title' ? styles.title : styles.text;
  probe.style.width = `${Math.max(1, width)}px`;
  probe.style.height = 'auto';
  probe.style.overflow = 'visible';
  probe.style.fontSize = `${Number(style.fontSize)}px`;
  // 굵게·기울임은 글자 폭을 바꾸므로 높이 측정에도 반영한다
  probe.style.fontWeight = String(style.fontWeight);
  probe.style.fontStyle = String(style.fontStyle);
  // 마지막 줄바꿈도 한 줄로 센다
  probe.textContent = shown.endsWith('\n') ? `${shown}​` : shown;
  const height = Math.max(MIN_HEIGHT, Math.ceil(probe.getBoundingClientRect().height));

  if (cache.size > 500) cache.clear();
  cache.set(key, height);
  return height;
}
