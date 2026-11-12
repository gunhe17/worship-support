import type { BlockKind, Json, JsonObject, UserId } from '../../engine/types';
import type { PlacementPath } from './elementRegistry';
import type { CursorPosition, LocalSelection } from './replica';

/**
 * EditorIntent: UI가 발생시키는 유일한 편집 명령 형태 (CLAUDE_PROMPT.md §15.3).
 * UI는 DB/Redis를 직접 변경하지 않고 EditorPort로만 intent를 전달한다.
 * Phase 1: LocalAdapter / Phase 3: EngineAdapter가 같은 인터페이스를 구현한다.
 */
export type EditorIntent =
  | { type: 'editProperty'; blockId: string; propertyPath: string; value: Json; gestureId?: string }
  | {
      type: 'editPlacement';
      templateId: string;
      elementId: string;
      changes: Partial<Record<PlacementPath, number>>;
      gestureId?: string;
    }
  | {
      type: 'addElement';
      templateId: string;
      kind: BlockKind;
      position?: { x: number; y: number };
      /** 복제·붙여넣기: 원본 내용·크기 (없으면 종류별 기본값) */
      content?: JsonObject;
      size?: { width: number; height: number };
      /** 여러 요소를 한 번에 추가할 때 Undo 한 번으로 묶는다 */
      gestureId?: string;
    }
  | { type: 'deleteElement'; templateId: string; elementId: string }
  | { type: 'reorderElement'; templateId: string; elementId: string; toIndex: number }
  /** 템플릿 이름 변경 (v1.2.7, TEMPLATE_RENAME) */
  | { type: 'renameTemplate'; templateId: string; name: string }
  | { type: 'save'; templateId: string }
  /** 과거 버전 복원 (새 template_version 생성, §7.8) */
  | { type: 'restoreVersion'; templateId: string; versionId: string }
  /** 편집 종료(포커스 해제, 드래그 종료): 보유 Lock 명시적 해제 (§7.5) */
  | { type: 'endEdit' }
  | { type: 'undo' }
  | { type: 'redo' };

export type IntentErrorCode =
  | 'ENGINE_NOT_CONNECTED'
  | 'UNDO_CONFLICT'
  | 'NOTHING_TO_UNDO'
  | 'NOTHING_TO_REDO'
  | 'TARGET_NOT_FOUND'
  | 'PROPERTY_LOCK_DENIED'
  | 'NO_CHANGE'
  | 'INVALID_NAME'
  | 'DISCONNECTED';

export type IntentResult =
  | { ok: true; createdElementId?: string; message?: string }
  | { ok: false; code: IntentErrorCode; message: string; lockOwnerUserId?: UserId };

/** 네트워크 명령이 아닌 replica 로컬 UI 상태 (Phase 2부터 Presence로 전파) */
export interface LocalStatePatch {
  selectedElementId?: string | null;
  selectedPropertyPath?: string | null;
  cursorPosition?: CursorPosition | null;
  localSelection?: Partial<LocalSelection>;
  viewingTemplateId?: string;
}

export interface EditorPort {
  /** 어댑터 식별 (UI에 연결 상태 표시용) */
  readonly mode: 'local' | 'engine';
  dispatch(actorUserId: UserId, intent: EditorIntent): IntentResult;
  updateLocal(actorUserId: UserId, patch: LocalStatePatch): void;
}
