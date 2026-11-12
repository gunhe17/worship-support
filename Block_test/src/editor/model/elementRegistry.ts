import type { BlockKind, JsonObject } from '../../engine/types';

/**
 * 요소 종류 레지스트리 (DB_SCHEMA.md §8.6).
 * 새 요소 종류는 여기에 항목 하나를 추가하면 Tool 패널, 렌더러, Inspector가 함께 확장된다.
 * React를 import하지 않는다. 렌더러/컨트롤 매핑은 UI 계층이 kind와 control로 연결한다.
 */

export type ControlType =
  | 'textarea'
  | 'text'
  | 'url'
  | 'number'
  | 'fontSize'
  | 'color'
  | 'align'
  | 'level'
  | 'select'
  | 'listItems'
  | 'tableData'
  | 'metadata'
  | 'imageSource'
  | 'bytes'
  /** 켜고 끄는 서식 (볼드·기울임·밑줄·취소선) */
  | 'toggle';

export interface PropertyDef {
  /** Lock 키, property_state의 단위 */
  path: string;
  /** live content 내부 JSON 경로 */
  jsonPath: string;
  label: string;
  control: ControlType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** 값이 없을 때 표시 기본값 (예: textAlign 기본 left) */
  fallback?: JsonObject[string];
}

export interface PropertyGroup {
  title: string;
  properties: PropertyDef[];
}

export interface ElementKindDef {
  kind: BlockKind;
  label: string;
  description: string;
  defaultSize: { width: number; height: number };
  defaultContent: () => JsonObject;
  groups: PropertyGroup[];
}

const MUSICAL_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => ({
  value: k,
  label: k,
}));

export const IMAGE_SOURCES = [
  { value: '', label: '비어 있음' },
  { value: 'local://sample/ridge', label: '산 능선' },
  { value: 'local://sample/dawn', label: '새벽 하늘' },
  { value: 'local://sample/grid', label: '패턴' },
];

/** 글자 꾸밈 (v1.2.6, DB_SCHEMA §8.6): 요소 전체에 켜고 끈다. 항목마다 독립된 property_path */
export const TEXT_DECORATIONS = ['style.bold', 'style.italic', 'style.underline', 'style.strikethrough'] as const;

const textStyleProps = (withSize: boolean, isTitle = false): PropertyDef[] => [
  ...(withSize
    ? [{ path: 'style.fontSize', jsonPath: 'style.fontSize', label: '글자 크기', control: 'fontSize' as const, min: 8, max: 96, fallback: 16 }]
    : []),
  { path: 'style.color', jsonPath: 'style.color', label: '색상', control: 'color', fallback: '#000000' },
  { path: 'style.bold', jsonPath: 'style.bold', label: '굵게', control: 'toggle', fallback: isTitle },
  { path: 'style.italic', jsonPath: 'style.italic', label: '기울임', control: 'toggle', fallback: false },
  { path: 'style.underline', jsonPath: 'style.underline', label: '밑줄', control: 'toggle', fallback: false },
  { path: 'style.strikethrough', jsonPath: 'style.strikethrough', label: '취소선', control: 'toggle', fallback: false },
  { path: 'style.textAlign', jsonPath: 'style.textAlign', label: '정렬', control: 'align', fallback: 'left' },
];

export const ELEMENT_KINDS: Record<BlockKind, ElementKindDef> = {
  text: {
    kind: 'text',
    label: '텍스트',
    description: '본문 문단',
    defaultSize: { width: 320, height: 80 },
    defaultContent: () => ({
      // 빈 값으로 시작한다. 캔버스에는 흐린 안내 문구(placeholder)만 보인다
      body: '',
      style: { fontSize: 16, color: '#1f2328', textAlign: 'left' },
    }),
    groups: [
      { title: '텍스트', properties: [{ path: 'content', jsonPath: 'body', label: '본문', control: 'textarea' }] },
      { title: '스타일', properties: textStyleProps(true) },
    ],
  },
  title: {
    kind: 'title',
    label: '제목',
    description: 'H1–H3 제목',
    defaultSize: { width: 420, height: 64 },
    defaultContent: () => ({ content: '', level: 1, style: { color: '#111111', textAlign: 'left' } }),
    groups: [
      {
        title: '제목',
        properties: [
          { path: 'content', jsonPath: 'content', label: '내용', control: 'text' },
          { path: 'level', jsonPath: 'level', label: '레벨', control: 'level' },
        ],
      },
      { title: '스타일', properties: textStyleProps(false, true) },
    ],
  },
  image: {
    kind: 'image',
    label: '이미지',
    description: '사진, 일러스트',
    defaultSize: { width: 300, height: 200 },
    // 시나리오 G 정책과 동일한 초기 콘텐츠
    defaultContent: () => ({ file_url: null, alt_text: '', width: 300, height: 200 }),
    groups: [
      {
        title: '이미지',
        properties: [
          { path: 'file_url', jsonPath: 'file_url', label: '소스', control: 'imageSource' },
          { path: 'alt_text', jsonPath: 'alt_text', label: '대체 텍스트', control: 'text' },
          { path: 'width', jsonPath: 'width', label: '원본 너비', control: 'number', min: 1 },
          { path: 'height', jsonPath: 'height', label: '원본 높이', control: 'number', min: 1 },
        ],
      },
    ],
  },
  file: {
    kind: 'file',
    label: '파일',
    description: '첨부 문서',
    defaultSize: { width: 320, height: 72 },
    defaultContent: () => ({
      file_url: 'local://files/portfolio.pdf',
      file_name: 'portfolio.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2457600,
    }),
    groups: [
      {
        title: '파일',
        properties: [
          { path: 'file_name', jsonPath: 'file_name', label: '파일 이름', control: 'text' },
          {
            path: 'mime_type',
            jsonPath: 'mime_type',
            label: '형식',
            control: 'select',
            options: [
              { value: 'application/pdf', label: 'PDF' },
              { value: 'application/zip', label: 'ZIP' },
              { value: 'image/png', label: 'PNG' },
              { value: 'text/plain', label: 'TXT' },
            ],
          },
          { path: 'size_bytes', jsonPath: 'size_bytes', label: '크기', control: 'bytes', min: 0 },
          { path: 'file_url', jsonPath: 'file_url', label: '파일 URL', control: 'url' },
        ],
      },
    ],
  },
  link: {
    kind: 'link',
    label: '링크',
    description: '북마크 카드',
    defaultSize: { width: 340, height: 84 },
    defaultContent: () => ({ url: 'https://example.com/portfolio', title: '포트폴리오 보러가기' }),
    groups: [
      {
        title: '링크',
        properties: [
          { path: 'title', jsonPath: 'title', label: '제목', control: 'text' },
          { path: 'url', jsonPath: 'url', label: 'URL', control: 'url' },
        ],
      },
    ],
  },
  song: {
    kind: 'song',
    label: '음악',
    description: '곡 정보 카드',
    defaultSize: { width: 340, height: 96 },
    defaultContent: () => ({
      title: '새로운 곡',
      description: '곡에 대한 짧은 설명',
      reference_url: null,
      musical_key: 'C',
    }),
    groups: [
      {
        title: '음악',
        properties: [
          { path: 'title', jsonPath: 'title', label: '곡 제목', control: 'text' },
          { path: 'description', jsonPath: 'description', label: '설명', control: 'textarea' },
          { path: 'musical_key', jsonPath: 'musical_key', label: '조성', control: 'select', options: MUSICAL_KEYS },
          { path: 'reference_url', jsonPath: 'reference_url', label: '참고 URL', control: 'url' },
        ],
      },
    ],
  },
  list: {
    kind: 'list',
    label: '목록',
    description: '글머리 목록',
    defaultSize: { width: 300, height: 112 },
    // 빈 항목 하나로 시작한다. 캔버스에는 흐린 안내 문구만 보인다
    defaultContent: () => ({ items: [''] }),
    groups: [{ title: '목록', properties: [{ path: 'items', jsonPath: 'items', label: '항목', control: 'listItems' }] }],
  },
  table: {
    kind: 'table',
    label: '표',
    description: '행과 열',
    defaultSize: { width: 360, height: 132 },
    defaultContent: () => ({
      data: [
        ['항목', '내용'],
        ['이름', '홍길동'],
        ['연락처', 'hello@example.com'],
      ],
    }),
    groups: [{ title: '표', properties: [{ path: 'data', jsonPath: 'data', label: '셀', control: 'tableData' }] }],
  },
  video: {
    kind: 'video',
    label: '동영상',
    description: '영상 플레이어',
    defaultSize: { width: 400, height: 225 },
    defaultContent: () => ({ video_url: null, metadata: { title: '소개 영상', duration: '03:24' } }),
    groups: [
      {
        title: '동영상',
        properties: [
          { path: 'video_url', jsonPath: 'video_url', label: '영상 URL', control: 'url' },
          { path: 'metadata', jsonPath: 'metadata', label: '메타데이터', control: 'metadata' },
        ],
      },
    ],
  },
  embed: {
    kind: 'embed',
    label: '임베드',
    description: '외부 콘텐츠',
    defaultSize: { width: 400, height: 240 },
    defaultContent: () => ({
      embed_url: 'https://example.com/embed/calendar',
      metadata: { title: '일정 캘린더', provider: 'Calendar' },
    }),
    groups: [
      {
        title: '임베드',
        properties: [
          { path: 'embed_url', jsonPath: 'embed_url', label: '임베드 URL', control: 'url' },
          { path: 'metadata', jsonPath: 'metadata', label: '메타데이터', control: 'metadata' },
        ],
      },
    ],
  },
};

export function kindDef(kind: BlockKind): ElementKindDef {
  return ELEMENT_KINDS[kind];
}

export function findPropertyDef(kind: BlockKind, path: string): PropertyDef | undefined {
  for (const group of ELEMENT_KINDS[kind].groups) {
    const found = group.properties.find((p) => p.path === path);
    if (found) return found;
  }
  return undefined;
}

/** 배치 속성 (template_live_element.props) */
export const PLACEMENT_PATHS = ['position.x', 'position.y', 'size.width', 'size.height'] as const;
export type PlacementPath = (typeof PLACEMENT_PATHS)[number];

export const PAGE_SIZE = { width: 800, height: 1040 } as const;
