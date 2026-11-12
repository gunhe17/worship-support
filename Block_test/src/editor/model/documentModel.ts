import type { BlockKind, JsonObject, Placement, Tables, UserId } from '../../engine/types';

/**
 * 클라이언트가 렌더링하는 문서 모델 (DB_SCHEMA.md §8.1 documentView).
 * PostgreSQL 행 구조와 분리된, 편집기 관점의 정규화 모델이다.
 */

export interface PropertyMeta {
  revision: number;
  lastActorUserId: UserId | null;
}

export interface BlockView {
  blockId: string;
  kind: BlockKind;
  content: JsonObject;
  revision: number;
  /** property_path별 revision과 마지막 수정자 (Undo 충돌 검증용) */
  properties: Record<string, PropertyMeta>;
}

export interface ElementView {
  elementId: string;
  templateId: string;
  blockId: string;
  sequence: number;
  renderZone: string;
  props: Placement;
  properties: Record<string, PropertyMeta>;
  /** 로컬에서 생성되어 아직 서버 ID가 없는 요소 */
  provisional?: boolean;
}

export interface TemplateView {
  templateId: string;
  name: string;
  revision: number;
  structureRevision: number;
}

export interface DocumentView {
  templates: Record<string, TemplateView>;
  elements: Record<string, ElementView>;
  blocks: Record<string, BlockView>;
}

const asPlacement = (props: unknown): Placement => {
  const p = props as Partial<Placement> | null;
  return {
    position: { x: p?.position?.x ?? 0, y: p?.position?.y ?? 0 },
    size: { width: p?.size?.width ?? 100, height: p?.size?.height ?? 100 },
  };
};

/** PostgreSQL Live 테이블(시드 또는 Mock DB)로부터 documentView를 만든다. */
export function buildDocumentView(tables: Tables): DocumentView {
  const view: DocumentView = { templates: {}, elements: {}, blocks: {} };

  for (const t of tables.template) {
    const live = tables.template_live_state.find((s) => s.template_id === t.id);
    view.templates[t.id as string] = {
      templateId: t.id as string,
      name: t.name as string,
      revision: (live?.revision as number) ?? 0,
      structureRevision: 0,
    };
  }

  for (const b of tables.block) {
    const live = tables.block_live_state.find((s) => s.block_id === b.id);
    view.blocks[b.id as string] = {
      blockId: b.id as string,
      kind: b.kind as BlockKind,
      content: structuredClone((live?.content as JsonObject) ?? {}),
      revision: (live?.revision as number) ?? 0,
      properties: {},
    };
  }

  for (const e of tables.template_live_element) {
    const id = e.template_element_id as string;
    view.elements[id] = {
      elementId: id,
      templateId: e.template_id as string,
      blockId: e.block_id as string,
      sequence: e.sequence as number,
      renderZone: e.render_zone as string,
      props: asPlacement(e.props),
      properties: {},
    };
  }
  return view;
}

/** 템플릿의 요소를 sequence 오름차순으로 (뒤쪽일수록 위에 그려짐) */
export function elementsOf(view: DocumentView, templateId: string): ElementView[] {
  return Object.values(view.elements)
    .filter((e) => e.templateId === templateId)
    .sort((a, b) => a.sequence - b.sequence || a.elementId.localeCompare(b.elementId));
}
