import type { BlockKind, Json, JsonObject, Placement, UserId } from '../../engine/types';
import { elementsOf, type BlockView, type DocumentView, type ElementView } from './documentModel';
import { findPropertyDef, type PlacementPath } from './elementRegistry';
import { getAtPath, setAtPath } from './jsonPath';

/**
 * 편집 작업(Op). pendingOps와 서버 요청의 공통 단위.
 * 이름은 엔진 명령(PROPERTY_UPDATE, ELEMENT_CREATE ...)과 일치한다.
 */

interface OpBase {
  opId: string;
  actorUserId: UserId;
  /** Undo/Redo로 발생한 명령이면 원래 방향 */
  undoDirection?: 'undo' | 'redo';
}

export interface BlockPropertyUpdateOp extends OpBase {
  type: 'PROPERTY_UPDATE';
  target: { scope: 'block'; blockId: string };
  propertyPath: string;
  value: Json;
}

export interface ElementPropertyUpdateOp extends OpBase {
  type: 'PROPERTY_UPDATE';
  target: { scope: 'element'; templateId: string; elementId: string };
  propertyPath: PlacementPath;
  value: number;
}

export interface ElementCreateOp extends OpBase {
  type: 'ELEMENT_CREATE';
  templateId: string;
  elementId: string;
  blockId: string;
  kind: BlockKind;
  content: JsonObject;
  props: Placement;
  renderZone: string;
}

export interface ElementDeleteOp extends OpBase {
  type: 'ELEMENT_DELETE';
  templateId: string;
  elementId: string;
}

export interface ElementRestoreOp extends OpBase {
  type: 'ELEMENT_RESTORE';
  templateId: string;
  elementId: string;
  blockId: string;
  /** 삭제 직전 순서 (0-based index) */
  index: number;
  renderZone: string;
  props: Placement;
}

export interface ElementReorderOp extends OpBase {
  type: 'ELEMENT_REORDER';
  templateId: string;
  elementId: string;
  /** sequence 오름차순 기준 목표 index (0-based) */
  toIndex: number;
}

/** 템플릿 이름 변경 (v1.2.7, DB_SCHEMA §8.8.1). 구조 명령 경로로 즉시 저장된다 */
export interface TemplateRenameOp extends OpBase {
  type: 'TEMPLATE_RENAME';
  templateId: string;
  name: string;
  /** 바꾸기 전 이름 (Undo 되돌리기·충돌 검사용) */
  previousName: string;
}

/**
 * 템플릿 구성 전체 교체 (복원 결과 전파, DB_SCHEMA §7.8, §8.11).
 * 개별 요소 추가·삭제를 반복하지 않고, 복원된 전체 요소 구성을 한 번에 교체한다.
 * 서버가 승인한 결과로만 전파되며 Undo 대상이 아니다. 블록 콘텐츠는 변경하지 않는다.
 */
export interface ReplaceTemplateStructureOp extends OpBase {
  type: 'REPLACE_TEMPLATE_STRUCTURE';
  templateId: string;
  /** 복원 대상(원본) template_version */
  templateVersionId: string;
  /** 복원으로 새로 생성된 template_version */
  newTemplateVersionId: string;
  /** 복원 직전 자동 저장으로 만든 template_version (바뀐 것이 있었을 때만, v1.2.9) */
  preservedTemplateVersionId?: string;
  preservedVersion?: number;
  /** 교체 후 구조 revision (이전 + 1) */
  structureRevision: number;
  elements: {
    templateElementId: string;
    blockId: string;
    blockVersionId: string;
    sequence: number;
    renderZone: string;
    props: Placement;
  }[];
}

export type PropertyUpdateOp = BlockPropertyUpdateOp | ElementPropertyUpdateOp;
export type EditorOp =
  | PropertyUpdateOp
  | ElementCreateOp
  | ElementDeleteOp
  | ElementRestoreOp
  | ElementReorderOp
  | TemplateRenameOp
  | ReplaceTemplateStructureOp;

/* ------------------------------------------------------------------ */

export function blockJsonPath(block: BlockView, propertyPath: string): string {
  return findPropertyDef(block.kind, propertyPath)?.jsonPath ?? propertyPath;
}

export function readBlockProperty(block: BlockView, propertyPath: string): Json | undefined {
  return getAtPath(block.content, blockJsonPath(block, propertyPath));
}

export function readPlacement(element: ElementView, path: PlacementPath): number {
  const [group, key] = path.split('.') as ['position' | 'size', string];
  return (element.props[group] as Record<string, number>)[key];
}

function writePlacement(props: Placement, path: PlacementPath, value: number): Placement {
  const [group, key] = path.split('.') as ['position' | 'size', string];
  return { ...props, [group]: { ...props[group], [key]: value } };
}

/** 같은 템플릿 요소들의 sequence를 1..n으로 다시 매긴다 */
function renumber(view: DocumentView, ordered: ElementView[]): DocumentView {
  const elements = { ...view.elements };
  ordered.forEach((e, i) => {
    if (e.sequence !== i + 1) elements[e.elementId] = { ...e, sequence: i + 1 };
    else elements[e.elementId] = e;
  });
  return { ...view, elements };
}

/**
 * Op를 documentView에 적용한 새 view를 반환한다 (순수 함수).
 * 적용할 수 없는 Op(대상 없음 등)는 view를 그대로 반환한다.
 */
export function applyOp(view: DocumentView, op: EditorOp): DocumentView {
  switch (op.type) {
    case 'PROPERTY_UPDATE': {
      if (op.target.scope === 'block') {
        const block = view.blocks[op.target.blockId];
        if (!block) return view;
        const content = setAtPath(block.content, blockJsonPath(block, op.propertyPath), op.value);
        return { ...view, blocks: { ...view.blocks, [block.blockId]: { ...block, content } } };
      }
      const el = view.elements[op.target.elementId];
      if (!el) return view;
      const props = writePlacement(el.props, op.propertyPath as PlacementPath, op.value as number);
      return { ...view, elements: { ...view.elements, [el.elementId]: { ...el, props } } };
    }
    case 'TEMPLATE_RENAME': {
      const template = view.templates[op.templateId];
      if (!template) return view;
      return { ...view, templates: { ...view.templates, [op.templateId]: { ...template, name: op.name } } };
    }
    case 'ELEMENT_CREATE': {
      if (view.elements[op.elementId]) return view;
      const ordered = elementsOf(view, op.templateId);
      const element: ElementView = {
        elementId: op.elementId,
        templateId: op.templateId,
        blockId: op.blockId,
        sequence: ordered.length + 1,
        renderZone: op.renderZone,
        props: op.props,
        properties: {},
        provisional: true,
      };
      const block: BlockView = view.blocks[op.blockId] ?? {
        blockId: op.blockId,
        kind: op.kind,
        content: op.content,
        revision: 0,
        properties: {},
      };
      return {
        ...view,
        elements: { ...view.elements, [op.elementId]: element },
        blocks: { ...view.blocks, [op.blockId]: block },
      };
    }
    case 'ELEMENT_DELETE': {
      if (!view.elements[op.elementId]) return view;
      const elements = { ...view.elements };
      delete elements[op.elementId];
      // 블록은 삭제하지 않는다 (SIMULATION_SCENARIOS H v1.1)
      const next = { ...view, elements };
      return renumber(next, elementsOf(next, op.templateId));
    }
    case 'ELEMENT_RESTORE': {
      if (view.elements[op.elementId] || !view.blocks[op.blockId]) return view;
      const ordered = elementsOf(view, op.templateId);
      const restored: ElementView = {
        elementId: op.elementId,
        templateId: op.templateId,
        blockId: op.blockId,
        sequence: 0,
        renderZone: op.renderZone,
        props: op.props,
        properties: {},
      };
      const index = Math.max(0, Math.min(op.index, ordered.length));
      ordered.splice(index, 0, restored);
      return renumber({ ...view, elements: { ...view.elements, [op.elementId]: restored } }, ordered);
    }
    case 'REPLACE_TEMPLATE_STRUCTURE': {
      // 기존 구성을 전체 교체한다 (같은 요소의 속성 메타는 유지)
      const elements = { ...view.elements };
      for (const e of elementsOf(view, op.templateId)) delete elements[e.elementId];
      for (const r of op.elements) {
        const prev = view.elements[r.templateElementId];
        elements[r.templateElementId] = {
          elementId: r.templateElementId,
          templateId: op.templateId,
          blockId: r.blockId,
          sequence: r.sequence,
          renderZone: r.renderZone,
          props: structuredClone(r.props),
          properties: prev?.properties ?? {},
        };
      }
      return { ...view, elements };
    }
    case 'ELEMENT_REORDER': {
      const ordered = elementsOf(view, op.templateId);
      const from = ordered.findIndex((e) => e.elementId === op.elementId);
      if (from < 0) return view;
      const [moved] = ordered.splice(from, 1);
      const to = Math.max(0, Math.min(op.toIndex, ordered.length));
      ordered.splice(to, 0, moved);
      return renumber(view, ordered);
    }
  }
}
