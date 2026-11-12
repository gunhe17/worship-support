import type { TableName } from '../types';

/**
 * PostgreSQL 테이블 메타데이터 (DB_SCHEMA.md §3, §7.1).
 * DB Explorer의 컬럼/타입/PK/FK 표시와 MockDatabase 검증에 공통으로 사용한다.
 */

export type ColumnType = 'text' | 'integer' | 'bigint' | 'jsonb' | 'timestamptz';

export interface ColumnDef {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  pk?: boolean;
  fk?: { table: TableName; column: string };
  /** 문서 원안 대비 확장 컬럼 (v1.1) */
  extension?: string;
}

export interface TableDef {
  name: TableName;
  group: 'block' | 'block-content' | 'block-live' | 'template' | 'template-live';
  description: string;
  columns: ColumnDef[];
}

const fk = (table: TableName, column = 'id') => ({ table, column });

const contentTable = (
  name: TableName,
  description: string,
  columns: ColumnDef[],
): TableDef => ({
  name,
  group: 'block-content',
  description,
  columns: [{ name: 'id', type: 'text', pk: true, fk: fk('block_version') }, ...columns],
});

export const TABLES: readonly TableDef[] = [
  {
    name: 'block',
    group: 'block',
    description: '블록 정체성',
    columns: [
      { name: 'id', type: 'text', pk: true },
      { name: 'workspace_id', type: 'text' },
      { name: 'kind', type: 'text' },
      { name: 'current_version_id', type: 'text', nullable: true, fk: fk('block_version') },
      { name: 'created_by', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'block_version',
    group: 'block',
    description: '블록 확정 버전 (명시적 저장 시에만 INSERT)',
    columns: [
      { name: 'id', type: 'text', pk: true },
      { name: 'block_id', type: 'text', fk: fk('block') },
      { name: 'version', type: 'integer' },
      { name: 'changed_by', type: 'text' },
      { name: 'changed_at', type: 'timestamptz' },
    ],
  },
  contentTable('block_text', '텍스트 콘텐츠', [
    { name: 'body', type: 'text' },
    { name: 'style', type: 'jsonb', nullable: true, extension: 'v1.1 확장 컬럼 (DB_SCHEMA §7.1)' },
  ]),
  contentTable('block_title', '제목 콘텐츠', [
    { name: 'content', type: 'text' },
    { name: 'level', type: 'integer' },
    { name: 'style', type: 'jsonb', nullable: true },
  ]),
  contentTable('block_image', '이미지 콘텐츠', [
    { name: 'file_url', type: 'text', nullable: true },
    { name: 'alt_text', type: 'text' },
    { name: 'width', type: 'integer' },
    { name: 'height', type: 'integer' },
  ]),
  contentTable('block_file', '파일 콘텐츠', [
    { name: 'file_url', type: 'text', nullable: true },
    { name: 'file_name', type: 'text' },
    { name: 'mime_type', type: 'text' },
    { name: 'size_bytes', type: 'bigint' },
  ]),
  contentTable('block_link', '링크 콘텐츠', [
    { name: 'url', type: 'text' },
    { name: 'title', type: 'text' },
  ]),
  contentTable('block_song', '음악 콘텐츠', [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'text' },
    { name: 'reference_url', type: 'text', nullable: true },
    { name: 'musical_key', type: 'text' },
  ]),
  contentTable('block_list', '목록 콘텐츠', [{ name: 'items', type: 'jsonb' }]),
  contentTable('block_table', '표 콘텐츠', [{ name: 'data', type: 'jsonb' }]),
  contentTable('block_video', '동영상 콘텐츠', [
    { name: 'video_url', type: 'text', nullable: true },
    { name: 'metadata', type: 'jsonb' },
  ]),
  contentTable('block_embed', '임베드 콘텐츠', [
    { name: 'embed_url', type: 'text', nullable: true },
    { name: 'metadata', type: 'jsonb' },
  ]),
  {
    name: 'block_live_state',
    group: 'block-live',
    description: '현재 편집 중인 블록 콘텐츠 (Debounce 후 갱신)',
    columns: [
      { name: 'block_id', type: 'text', pk: true, fk: fk('block') },
      { name: 'base_block_version_id', type: 'text', nullable: true, fk: fk('block_version') },
      { name: 'content', type: 'jsonb' },
      { name: 'revision', type: 'integer' },
      { name: 'persisted_revision', type: 'integer' },
      { name: 'updated_by', type: 'text', nullable: true },
      { name: 'updated_at', type: 'timestamptz' },
      { name: 'persisted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    name: 'block_property_state',
    group: 'block-live',
    description: '블록 속성별 revision/저장 상태',
    columns: [
      { name: 'block_id', type: 'text', pk: true, fk: fk('block') },
      { name: 'property_path', type: 'text', pk: true },
      { name: 'revision', type: 'integer' },
      { name: 'persisted_revision', type: 'integer' },
      { name: 'last_fencing_token', type: 'bigint' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'template',
    group: 'template',
    description: '템플릿 정체성',
    columns: [
      { name: 'id', type: 'text', pk: true },
      { name: 'workspace_id', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'current_version_id', type: 'text', nullable: true, fk: fk('template_version') },
      { name: 'created_by', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'template_version',
    group: 'template',
    description: '템플릿 확정 버전',
    columns: [
      { name: 'id', type: 'text', pk: true },
      { name: 'template_id', type: 'text', fk: fk('template') },
      { name: 'version', type: 'integer' },
      { name: 'created_by', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'restored_from_version_id', type: 'text', nullable: true, fk: fk('template_version') },
    ],
  },
  {
    name: 'template_element',
    group: 'template',
    description: '템플릿 요소 정체성',
    columns: [
      { name: 'id', type: 'text', pk: true },
      { name: 'template_id', type: 'text', fk: fk('template') },
      { name: 'block_id', type: 'text', fk: fk('block') },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'deleted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    name: 'template_version_element',
    group: 'template',
    description: '확정 버전의 요소 배치',
    columns: [
      { name: 'id', type: 'text', pk: true },
      { name: 'template_version_id', type: 'text', fk: fk('template_version') },
      { name: 'template_element_id', type: 'text', fk: fk('template_element') },
      { name: 'block_version_id', type: 'text', fk: fk('block_version') },
      { name: 'sequence', type: 'integer' },
      { name: 'render_zone', type: 'text' },
      { name: 'props', type: 'jsonb' },
    ],
  },
  {
    name: 'template_live_state',
    group: 'template-live',
    description: '템플릿 구조 revision/저장 상태',
    columns: [
      { name: 'template_id', type: 'text', pk: true, fk: fk('template') },
      { name: 'revision', type: 'integer' },
      { name: 'persisted_revision', type: 'integer' },
      { name: 'updated_by', type: 'text', nullable: true },
      { name: 'updated_at', type: 'timestamptz' },
      { name: 'persisted_at', type: 'timestamptz', nullable: true },
    ],
  },
  {
    name: 'template_live_element',
    group: 'template-live',
    description: '현재 편집 중인 요소 배치',
    columns: [
      { name: 'template_id', type: 'text', pk: true, fk: fk('template') },
      { name: 'template_element_id', type: 'text', pk: true, fk: fk('template_element') },
      { name: 'block_id', type: 'text', fk: fk('block') },
      { name: 'sequence', type: 'integer' },
      { name: 'render_zone', type: 'text' },
      { name: 'props', type: 'jsonb' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'template_element_property_state',
    group: 'template-live',
    description: '요소 배치 속성별 revision/저장 상태',
    columns: [
      { name: 'template_id', type: 'text', pk: true, fk: fk('template') },
      { name: 'template_element_id', type: 'text', pk: true, fk: fk('template_element') },
      { name: 'property_path', type: 'text', pk: true },
      { name: 'revision', type: 'integer' },
      { name: 'persisted_revision', type: 'integer' },
      { name: 'last_fencing_token', type: 'bigint' },
      { name: 'updated_at', type: 'timestamptz' },
    ],
  },
];

export const TABLE_NAMES: readonly TableName[] = TABLES.map((t) => t.name);

export function getTableDef(name: TableName): TableDef {
  const def = TABLES.find((t) => t.name === name);
  if (!def) throw new Error(`Unknown table: ${name}`);
  return def;
}

export function primaryKeyOf(name: TableName): string[] {
  return getTableDef(name)
    .columns.filter((c) => c.pk)
    .map((c) => c.name);
}

/** block kind → 콘텐츠 테이블 */
export const CONTENT_TABLE_BY_KIND = {
  text: 'block_text',
  title: 'block_title',
  image: 'block_image',
  file: 'block_file',
  link: 'block_link',
  song: 'block_song',
  list: 'block_list',
  table: 'block_table',
  video: 'block_video',
  embed: 'block_embed',
} as const satisfies Record<string, TableName>;
