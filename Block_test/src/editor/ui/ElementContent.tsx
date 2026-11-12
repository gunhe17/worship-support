import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { Json } from '../../engine/types';
import type { BlockView } from '../model/documentModel';
import { decorationShortcut } from '../model/textDecoration';
import { Icon } from './icons';
import styles from './stage.module.css';

/**
 * 요소 종류별 렌더러. 외부 리소스를 불러오지 않는다 (DB_SCHEMA §8.8).
 * 콘텐츠는 block live content(JSON)만 사용한다.
 */

type Content = Record<string, Json>;
const str = (v: Json | undefined, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: Json | undefined, fallback: number) => (typeof v === 'number' ? v : fallback);
const obj = (v: Json | undefined): Content => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Content) : {});

const TITLE_SIZES: Record<number, number> = { 1: 34, 2: 26, 3: 20 };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const hostOf = (url: string) => url.replace(/^[a-z]+:\/\//i, '').split('/')[0] || url;

const flag = (v: Json | undefined, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

/** 글자 꾸밈 (v1.2.6): 굵게·기울임·밑줄·취소선. 제목은 기본이 굵게 */
function decorationOf(style: Content, isTitle: boolean): CSSProperties {
  const lines = [flag(style.underline, false) && 'underline', flag(style.strikethrough, false) && 'line-through'].filter(Boolean);
  return {
    fontWeight: flag(style.bold, isTitle) ? (isTitle ? 750 : 700) : 400,
    fontStyle: flag(style.italic, false) ? 'italic' : 'normal',
    textDecoration: lines.length ? lines.join(' ') : 'none',
  };
}

export function textStyleOf(block: BlockView): CSSProperties {
  const c = block.content as Content;
  const style = obj(c.style);
  if (block.kind === 'title') {
    const level = num(c.level, 1);
    return {
      fontSize: TITLE_SIZES[level] ?? 34,
      color: str(style.color, '#111111'),
      textAlign: str(style.textAlign, 'left') as CSSProperties['textAlign'],
      ...decorationOf(style, true),
    };
  }
  return {
    fontSize: num(style.fontSize, 16),
    color: str(style.color, '#000000'),
    textAlign: str(style.textAlign, 'left') as CSSProperties['textAlign'],
    ...decorationOf(style, false),
  };
}

/** 인라인 텍스트 편집기 (텍스트/제목). DOM은 비제어 방식으로 유지해 커서 위치를 보존한다. */
/** 화면 좌표의 글자 위치 (클릭한 자리에 커서를 두기 위함) */
function rangeAt(x: number, y: number, root: HTMLElement): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let range: Range | null = null;
  if (doc.caretRangeFromPoint) range = doc.caretRangeFromPoint(x, y);
  else if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) {
      range = document.createRange();
      range.setStart(p.offsetNode, p.offset);
    }
  }
  return range && root.contains(range.startContainer) ? range : null;
}

/** 다시 그려질 때 이어받을 커서 위치 (글자 수) */
let carriedCaret: { at: number; offset: number } | null = null;

/** 글자 수 위치의 Range */
function rangeAtOffset(root: HTMLElement, offset: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let left = offset;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (left <= len) {
      const r = document.createRange();
      r.setStart(n, left);
      return r;
    }
    left -= len;
  }
  return null;
}

export function InlineTextEditor({
  block,
  caretAt = null,
  onFormatKey,
  onChange,
  onExit,
}: {
  block: BlockView;
  /** 편집을 시작한 클릭 위치(화면 좌표). 없으면 끝에 커서 */
  caretAt?: { x: number; y: number } | null;
  /** ⌘B·⌘I·⌘U·⌘⇧X: 요소 전체 글자 꾸밈 켜고 끄기 (브라우저 기본 서식 삽입은 막는다) */
  onFormatKey?: (path: string) => void;
  onChange: (text: string) => void;
  onExit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const c = block.content as Content;
  const initial = block.kind === 'title' ? str(c.content) : str(c.body);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 편집 시작 시점의 값으로 한 번만 초기화 (이후 DOM은 비제어)
    el.innerText = initial;
    el.dataset.empty = String(initial === '');
    el.focus({ preventScroll: true });
    // 임시 ID → 서버 ID 교체로 다시 그려진 경우: 직전 커서 위치를 이어받는다
    const carried = carriedCaret && performance.now() - carriedCaret.at < 3000 ? carriedCaret.offset : null;
    carriedCaret = null;
    let range = carried !== null ? rangeAtOffset(el, carried) : caretAt ? rangeAt(caretAt.x, caretAt.y, el) : null;
    if (range) range.collapse(true);
    else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    // transform: scale 캔버스에서 Chrome이 caret 위치를 잘못 계산해 스테이지를 스크롤하는 문제 방지:
    // 입력 직전 스크롤 위치를 저장하고 입력 직후 복원한다.
    // (caret reveal은 input 이벤트 이후 비동기로 일어나므로 짧은 시간 동안 발생한 스크롤을 되돌린다)
    const scroller = el.closest('main');
    let saved = { top: 0, left: 0 };
    let lockUntil = 0;
    const before = () => {
      if (!scroller) return;
      if (performance.now() > lockUntil) saved = { top: scroller.scrollTop, left: scroller.scrollLeft };
      lockUntil = performance.now() + 150;
    };
    const onScroll = () => {
      if (!scroller || performance.now() > lockUntil) return;
      if (scroller.scrollTop !== saved.top || scroller.scrollLeft !== saved.left) {
        scroller.scrollTop = saved.top;
        scroller.scrollLeft = saved.left;
      }
    };
    el.addEventListener('beforeinput', before);
    scroller?.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('beforeinput', before);
      scroller?.removeEventListener('scroll', onScroll);
      // DOM이 지워지기 전(layout cleanup)에 커서 위치를 기억한다 (편집 중에 다시 그려지는 경우만 쓰인다)
      const sel = window.getSelection();
      if (document.activeElement === el && sel?.rangeCount) {
        const r = document.createRange();
        r.selectNodeContents(el);
        r.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
        carriedCaret = { at: performance.now(), offset: r.toString().length };
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`${block.kind === 'title' ? styles.title : styles.text} ${styles.editing}`}
      style={textStyleOf(block)}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      // 비어 있으면 흐린 안내 문구만 보인다 (실제 값이 아니므로 지울 필요 없음)
      data-placeholder={block.kind === 'title' ? '제목' : '텍스트를 입력하세요'}
      onInput={(e) => {
        const node = e.currentTarget as HTMLDivElement;
        const text = node.innerText.replace(/\n$/, '');
        node.dataset.empty = String(text === '');
        onChange(text);
      }}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }}
      onKeyDown={(e) => {
        const decoration = decorationShortcut(e);
        if (decoration) {
          e.preventDefault();
          e.stopPropagation();
          onFormatKey?.(decoration);
          return;
        }
        if (e.key === 'Escape' || (block.kind === 'title' && e.key === 'Enter')) {
          e.preventDefault();
          (e.currentTarget as HTMLDivElement).blur();
        }
        e.stopPropagation();
      }}
      onBlur={onExit}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

function ImageArt({ src }: { src: string }) {
  if (src === 'local://sample/ridge')
    return (
      <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className={styles.art}>
        <defs>
          <linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9dcf2" />
            <stop offset="1" stopColor="#f3e7d8" />
          </linearGradient>
        </defs>
        <rect width="300" height="200" fill="url(#sky1)" />
        <circle cx="222" cy="64" r="20" fill="#fff6e6" />
        <path d="M0 150 70 84l40 36 50-58 70 70 70-40v108H0Z" fill="#8aa3bd" />
        <path d="M0 170 60 130l50 26 60-42 60 40 70-24v70H0Z" fill="#5f7891" />
        <path d="M0 200v-18l80-22 70 16 80-26 70 22v28Z" fill="#3f566c" />
      </svg>
    );
  if (src === 'local://sample/dawn')
    return (
      <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className={styles.art}>
        <defs>
          <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b2d5a" />
            <stop offset=".55" stopColor="#d8738b" />
            <stop offset="1" stopColor="#f6c28b" />
          </linearGradient>
        </defs>
        <rect width="300" height="200" fill="url(#dawn)" />
        <circle cx="150" cy="150" r="34" fill="#ffe0a8" opacity=".9" />
        <rect y="150" width="300" height="50" fill="#29304f" opacity=".85" />
        <path d="M0 158h300M30 168h240M70 178h160" stroke="#f6c28b" strokeOpacity=".4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" className={styles.art}>
      <rect width="300" height="200" fill="#efe9df" />
      {Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 9 }).map((__, col) => (
          <circle
            key={`${row}-${col}`}
            cx={18 + col * 33}
            cy={18 + row * 33}
            r={(row + col) % 3 === 0 ? 11 : 6}
            fill={['#e2725b', '#2f6f73', '#e8b04b'][(row * 9 + col) % 3]}
            opacity=".85"
          />
        )),
      )}
    </svg>
  );
}

export function ElementContent({ block }: { block: BlockView }) {
  const c = block.content as Content;

  switch (block.kind) {
    case 'text':
      return (
        <div className={styles.text} style={textStyleOf(block)}>
          {str(c.body) || <span className={styles.placeholder}>텍스트를 입력하세요</span>}
        </div>
      );
    case 'title':
      return (
        <div className={styles.title} style={textStyleOf(block)}>
          {str(c.content) || <span className={styles.placeholder}>제목</span>}
        </div>
      );
    case 'image': {
      const src = str(c.file_url);
      return src ? (
        <figure className={styles.image}>
          <ImageArt src={src} />
          {str(c.alt_text) && <figcaption className={styles.caption}>{str(c.alt_text)}</figcaption>}
        </figure>
      ) : (
        <div className={styles.imageEmpty}>
          <Icon name="image" size={26} />
          <span>이미지를 선택하세요</span>
          <small>
            {num(c.width, 0)} × {num(c.height, 0)}
          </small>
        </div>
      );
    }
    case 'file': {
      const name = str(c.file_name, 'untitled');
      const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase() : 'FILE';
      return (
        <div className={styles.card}>
          <span className={styles.fileBadge} data-ext={ext}>
            {ext.slice(0, 4)}
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardTitle}>{name}</span>
            <span className={styles.cardMeta}>
              {formatBytes(num(c.size_bytes, 0))} · {str(c.mime_type)}
            </span>
          </span>
          <span className={styles.cardAction}>
            <Icon name="download" />
          </span>
        </div>
      );
    }
    case 'link': {
      const url = str(c.url);
      return (
        <div className={styles.card}>
          <span className={styles.linkFavicon}>{hostOf(url).slice(0, 1).toUpperCase()}</span>
          <span className={styles.cardBody}>
            <span className={styles.cardTitle}>{str(c.title) || url}</span>
            <span className={styles.cardMeta}>{hostOf(url)}</span>
          </span>
          <span className={styles.cardAction}>
            <Icon name="external" />
          </span>
        </div>
      );
    }
    case 'song':
      return (
        <div className={styles.card}>
          <span className={styles.songArt}>
            <Icon name="song" size={20} />
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardTitle}>{str(c.title) || '제목 없음'}</span>
            <span className={styles.cardMeta}>{str(c.description)}</span>
          </span>
          <span className={styles.keyBadge}>{str(c.musical_key, 'C')}</span>
        </div>
      );
    case 'list': {
      const items = Array.isArray(c.items) ? c.items : [];
      return (
        <ul className={styles.list}>
          {items.map((item, i) => (
            <li key={i}>{str(item) || <span className={styles.placeholder}>빈 항목</span>}</li>
          ))}
        </ul>
      );
    }
    case 'table': {
      const rows = Array.isArray(c.data) ? (c.data as Json[][]) : [];
      return (
        <table className={styles.table}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {(Array.isArray(row) ? row : []).map((cell, ci) =>
                  r === 0 ? <th key={ci}>{str(cell)}</th> : <td key={ci}>{str(cell)}</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'video': {
      const meta = obj(c.metadata);
      return (
        <div className={styles.video}>
          <span className={styles.play}>
            <Icon name="play" size={18} />
          </span>
          <span className={styles.videoBar}>
            <span className={styles.videoTitle}>{str(meta.title, '동영상')}</span>
            <span className={styles.videoTime}>{str(meta.duration, '00:00')}</span>
          </span>
          {!str(c.video_url) && <span className={styles.videoHint}>영상 URL 없음 · 로컬 미리보기</span>}
        </div>
      );
    }
    case 'embed': {
      const meta = obj(c.metadata);
      const url = str(c.embed_url);
      return (
        <div className={styles.embed}>
          <div className={styles.embedBar}>
            <i />
            <i />
            <i />
            <span>{hostOf(url) || 'embed'}</span>
          </div>
          <div className={styles.embedBody}>
            <Icon name="embed" size={22} />
            <strong>{str(meta.title, '임베드')}</strong>
            <span>{str(meta.provider, 'Web')} · 외부 연결 없이 미리보기</span>
          </div>
        </div>
      );
    }
  }
}
