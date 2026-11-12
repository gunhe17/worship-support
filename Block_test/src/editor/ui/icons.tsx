import type { SVGProps } from 'react';
import type { BlockKind } from '../../engine/types';

/** 외부 의존성 없는 인라인 SVG 아이콘 세트 (16px 그리드, stroke 1.5) */
export type IconName =
  | BlockKind
  | 'undo'
  | 'redo'
  | 'plus'
  | 'minus'
  | 'trash'
  | 'layers'
  | 'shapes'
  | 'lock'
  | 'unlock'
  | 'cloud'
  | 'cloudOff'
  | 'check'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'arrowUp'
  | 'arrowDown'
  | 'bringFront'
  | 'sendBack'
  | 'grip'
  | 'close'
  | 'play'
  | 'external'
  | 'download'
  | 'pencil'
  | 'eye'
  | 'fit'
  | 'database'
  | 'pulse'
  | 'chevronRight'
  | 'chevronDown'
  | 'panelRight'
  | 'panelBottom'
  | 'warning'
  | 'info'
  | 'page'
  | 'pause'
  | 'step'
  | 'reset'
  | 'plug'
  | 'history'
  | 'code'
  | 'help'
  | 'more';

const paths: Record<IconName, JSX.Element> = {
  text: <path d="M3 4h10M3 8h10M3 12h6" />,
  title: <path d="M3.5 3v10M10.5 3v10M3.5 8h7M12.5 13V9l-1 .7" />,
  image: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1.2" />
      <path d="m13.5 10.5-3.2-3.2L4 13" />
    </>
  ),
  file: (
    <>
      <path d="M9 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6L9 2.5Z" />
      <path d="M9 2.5V6h3.5" />
    </>
  ),
  link: (
    <>
      <path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.7.7" />
      <path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.7-.7" />
    </>
  ),
  song: (
    <>
      <path d="M6 12V3.5l7-1.5V10.5" />
      <circle cx="4.5" cy="12" r="1.5" />
      <circle cx="11.5" cy="10.5" r="1.5" />
    </>
  ),
  list: (
    <>
      <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
      <circle cx="3.2" cy="4" r=".6" fill="currentColor" />
      <circle cx="3.2" cy="8" r=".6" fill="currentColor" />
      <circle cx="3.2" cy="12" r=".6" fill="currentColor" />
    </>
  ),
  table: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M2.5 9.8h11M7 3v10" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="3.5" width="9" height="9" rx="1.5" />
      <path d="m11 7 3-2v6l-3-2" />
    </>
  ),
  embed: <path d="m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5 14 8l-3.5 3.5M9 3 7 13" />,
  undo: (
    <>
      <path d="M5.5 3 2.5 6l3 3" />
      <path d="M2.5 6h7a4 4 0 0 1 0 8H7" />
    </>
  ),
  redo: (
    <>
      <path d="m10.5 3 3 3-3 3" />
      <path d="M13.5 6h-7a4 4 0 0 0 0 8H9" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  minus: <path d="M3 8h10" />,
  trash: (
    <>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.6 8.5a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9L12 4.5" />
    </>
  ),
  layers: (
    <>
      <path d="m8 2.5 5.5 3L8 8.5l-5.5-3L8 2.5Z" />
      <path d="m2.5 8.5 5.5 3 5.5-3" />
      <path d="m2.5 11 5.5 3 5.5-3" />
    </>
  ),
  shapes: (
    <>
      <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
      <circle cx="11" cy="5" r="2.5" />
      <path d="M5 9.5 7.5 13.5h-5L5 9.5Z" />
      <rect x="9" y="9.5" width="4.5" height="4" rx="1" />
    </>
  ),
  lock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>
  ),
  unlock: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 4.8-1" />
    </>
  ),
  cloud: <path d="M4.5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.7-.8 3 3 0 0 1-.3 6.8h-7Z" />,
  cloudOff: (
    <>
      <path d="M4.5 12.5a3 3 0 0 1-.4-6 4 4 0 0 1 7.7-.8 3 3 0 0 1-.3 6.8h-7Z" />
      <path d="m2.5 2.5 11 11" />
    </>
  ),
  check: <path d="m3.5 8.5 3 3 6-7" />,
  alignLeft: <path d="M2.5 3.5h11M2.5 6.5h7M2.5 9.5h11M2.5 12.5h7" />,
  alignCenter: <path d="M2.5 3.5h11M4.5 6.5h7M2.5 9.5h11M4.5 12.5h7" />,
  alignRight: <path d="M2.5 3.5h11M6.5 6.5h7M2.5 9.5h11M6.5 12.5h7" />,
  arrowUp: <path d="M8 13V3M4 7l4-4 4 4" />,
  arrowDown: <path d="M8 3v10M4 9l4 4 4-4" />,
  bringFront: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 3.5v-1h-8v8h1" />
    </>
  ),
  sendBack: (
    <>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <path d="M12.5 5.5h1v8h-8v-1" />
    </>
  ),
  grip: (
    <>
      {[4.5, 8, 11.5].map((y) => (
        <g key={y}>
          <circle cx="6" cy={y} r=".8" fill="currentColor" stroke="none" />
          <circle cx="10" cy={y} r=".8" fill="currentColor" stroke="none" />
        </g>
      ))}
    </>
  ),
  close: <path d="m4 4 8 8M12 4l-8 8" />,
  play: <path d="M5.5 3.5v9l7-4.5-7-4.5Z" fill="currentColor" />,
  pause: <path d="M5 3.5v9M11 3.5v9" strokeWidth="2" />,
  step: (
    <>
      <path d="M3.5 3.5v9l6.5-4.5-6.5-4.5Z" fill="currentColor" />
      <path d="M12.5 3.5v9" strokeWidth="1.8" />
    </>
  ),
  reset: <path d="M3 8a5 5 0 1 0 1.5-3.6M3 2.5V5h2.5" />,
  plug: <path d="M6 2.5v3M10 2.5v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0v-2ZM8 11v2.5" />,
  external: <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />,
  download: <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />,
  pencil: <path d="M10.5 2.5 13.5 5.5 6 13H3v-3l7.5-7.5Z" />,
  eye: (
    <>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  fit: <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />,
  database: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="1.8" />
      <path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" />
    </>
  ),
  pulse: <path d="M1.5 8h3l1.5-4 3 8 1.5-4h4" />,
  chevronRight: <path d="m6 3.5 4.5 4.5L6 12.5" />,
  chevronDown: <path d="m3.5 6 4.5 4.5L12.5 6" />,
  panelRight: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M10 2.5v11" />
    </>
  ),
  panelBottom: (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M2 10h12" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.5 14 13H2L8 2.5Z" />
      <path d="M8 6.5v3M8 11.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 7.2V11M8 5v.1" />
    </>
  ),
  page: (
    <>
      <rect x="3.5" y="2" width="9" height="12" rx="1.2" />
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" />
    </>
  ),
  history: (
    <>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.6h2.6" />
      <path d="M8 5v3.2l2 1.3" />
    </>
  ),
  code: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />,
  help: (
    <>
      <circle cx="8" cy="8" r="5.8" />
      <path d="M6.3 6.4a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.5-.7 1v.3M8 11.2v.1" />
    </>
  ),
  more: (
    <>
      <circle cx="3.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
};

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
