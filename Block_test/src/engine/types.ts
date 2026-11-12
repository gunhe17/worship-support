/**
 * 도메인 공통 타입. React를 import하지 않는다.
 * 테이블 행 구조는 DB_SCHEMA.md §3, §7.1을 따른다.
 */

export type UserId = string;

export type BlockKind =
  | 'text'
  | 'title'
  | 'image'
  | 'file'
  | 'link'
  | 'song'
  | 'list'
  | 'table'
  | 'video'
  | 'embed';

export const BLOCK_KINDS: readonly BlockKind[] = [
  'text',
  'title',
  'image',
  'file',
  'link',
  'song',
  'list',
  'table',
  'video',
  'embed',
];

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface Placement {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export type TableName =
  | 'block'
  | 'block_version'
  | 'block_text'
  | 'block_title'
  | 'block_image'
  | 'block_file'
  | 'block_link'
  | 'block_song'
  | 'block_list'
  | 'block_table'
  | 'block_video'
  | 'block_embed'
  | 'block_live_state'
  | 'block_property_state'
  | 'template'
  | 'template_version'
  | 'template_element'
  | 'template_version_element'
  | 'template_live_state'
  | 'template_live_element'
  | 'template_element_property_state';

export type Row = Record<string, Json>;
export type Tables = Record<TableName, Row[]>;

export interface SimUser {
  userId: UserId;
  name: string;
  /** 사용자 고유 색상 (커서, 선택, 이벤트 구분) */
  color: string;
  /** 색상 위 텍스트 대비용 옅은 배경 */
  tint: string;
}
