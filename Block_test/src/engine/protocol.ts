import type { EditorOp, ElementCreateOp, ElementDeleteOp, ElementReorderOp, ElementRestoreOp, PropertyUpdateOp, TemplateRenameOp } from '../editor/model/ops';

export type StructureOp = ElementCreateOp | ElementDeleteOp | ElementRestoreOp | ElementReorderOp | TemplateRenameOp;
import type { CursorPosition } from '../editor/model/replica';
import type { Json, UserId } from './types';

/**
 * Client ↔ WS Server 메시지 정의.
 * Phase 2: 연결(HELLO/SYNC), 템플릿 전환, Presence, 변경 전파(CHANGE)
 * Phase 3에서 Lock, PROPERTY_UPDATE 등 편집 명령이 추가된다.
 */

/** 대상 키: 'block:B001' | 'template:T001' (lastReceivedRevision과 같은 형식) */
export type TargetKey = `block:${string}` | `template:${string}`;

export const blockTarget = (blockId: string): TargetKey => `block:${blockId}`;
export const templateTarget = (templateId: string): TargetKey => `template:${templateId}`;

/** Redis Stream 키 (대상별) */
export const streamKeyOf = (target: TargetKey) => `stream:${target}`;

/**
 * 승인된 변경 1건. Redis Stream에 기록되고, Broadcast/Delivery 및 재연결 따라잡기에 그대로 사용된다.
 * revision은 대상(블록 또는 템플릿)의 승인 후 revision이다.
 */
export interface ChangeEnvelope {
  name: 'PROPERTY_UPDATED' | 'STRUCTURE_UPDATED';
  requestId: string;
  actorUserId: UserId;
  target: TargetKey;
  revision: number;
  op: EditorOp;
  /** 속성 변경일 때 승인 후 속성 revision */
  propertyRevision?: number;
  /** 구조 변경일 때 승인 후 structureRevision */
  structureRevision?: number;
  /**
   * 전역 순번 (seq:stream INCR, §8.9.1). 중복 없이 단조 증가한다.
   * 여러 Stream의 처리 순서를 자동으로 보장하지 않으므로 소비자가 직접 검증한다.
   */
  streamSeq: number;
}

/** Redis Hash presence:template:{templateId}의 userId 필드 값 (DB_SCHEMA §8.2) */
export interface PresenceInfo {
  userId: UserId;
  connectionId: string | null;
  status: 'connected' | 'disconnected';
  selectedElementId: string | null;
  selectedPropertyPath: string | null;
  cursor: CursorPosition | null;
  updatedAt: number;
}

export type PresenceFields = Pick<PresenceInfo, 'selectedElementId' | 'selectedPropertyPath' | 'cursor'>;

/** HELLO 사유: 재연결, 또는 같은 연결에서 누락·순서 역전 감지 후 복구 (§8.9.1) */
export type HelloReason =
  | { reason: 'reconnect' }
  | { reason: 'gap' | 'out-of-order'; deliveryId: string; target: TargetKey; receivedRevision: number; receivedSeq: number };

export type UpMessage =
  | {
      type: 'HELLO';
      requestId: string;
      templateId: string;
      lastReceivedRevision: Record<string, number>;
      /** 이 클라이언트가 마지막으로 처리한 전역 순번 (§8.9.1) */
      lastProcessedSeq: number;
      presence: PresenceFields;
      recovery: HelloReason;
      /** 전송했으나 응답 전에 연결이 끊겨 승인 여부를 모르는 요청 (§8.10.6) */
      unconfirmedRequestIds: string[];
    }
  | {
      type: 'VIEW_TEMPLATE';
      requestId: string;
      templateId: string;
      lastReceivedRevision: Record<string, number>;
      /** 이 클라이언트가 마지막으로 처리한 전역 순번 (§8.9.1) */
      lastProcessedSeq: number;
      presence: PresenceFields;
    }
  | { type: 'PRESENCE_UPDATE'; requestId: string; templateId: string; presence: PresenceFields }
  /* ---------- Phase 3: 속성 편집 ---------- */
  | { type: 'PROPERTY_LOCK_REQUEST'; requestId: string; lockKey: string; target: PropertyUpdateOp['target']; propertyPath: string }
  | { type: 'PROPERTY_LOCK_RELEASE'; requestId: string; lockKey: string; lockToken: string }
  | {
      type: 'PROPERTY_UPDATE';
      requestId: string;
      op: PropertyUpdateOp;
      /** 클라이언트가 기준으로 삼은 속성 revision (§7.4) */
      baseRevision: number;
      lockToken: string;
      fencingToken: number;
      /** Undo/Redo 명령이면 서버가 충돌을 검증할 기대 현재값 (§8.4) */
      undo?: { direction: 'undo' | 'redo'; expectedCurrent: Json };
    }
  /* ---------- 구조 변경 (템플릿 단위 직렬 처리, §7.4·§7.6) ---------- */
  | {
      type: 'STRUCTURE_COMMAND';
      requestId: string;
      /** ELEMENT_CREATE의 elementId/blockId는 클라이언트 임시 ID (서버가 실제 ID를 발급) */
      op: StructureOp;
      baseStructureRevision: number;
      /** Undo/Redo 명령이면 구조 Undo 충돌 검증 (§8.4). 순서 변경은 기대 현재 index 포함 */
      undo?: { direction: 'undo' | 'redo'; expectedIndex?: number };
    }
  /* ---------- 버전 (명시적 저장 §7.7, 복원 §7.8) ---------- */
  | { type: 'TEMPLATE_SAVE'; requestId: string; templateId: string }
  | { type: 'TEMPLATE_RESTORE'; requestId: string; templateId: string; versionId: string };

/** 템플릿 최초 로드 스냅샷 (Redis live:* 기준) */
export interface TemplateSnapshot {
  template: { templateId: string; name: string; revision: number; structureRevision: number };
  elements: { elementId: string; blockId: string; sequence: number; renderZone: string; props: import('./types').Placement; properties: Record<string, { revision: number; lastActorUserId: UserId | null }> }[];
  blocks: { blockId: string; kind: import('./types').BlockKind; content: import('./types').JsonObject; revision: number; properties: Record<string, { revision: number; lastActorUserId: UserId | null }> }[];
}

/** 복원 버전이 참조하는 block_version 콘텐츠와 현재 Live 콘텐츠의 차이 (§7.8) */
export interface ContentMismatch {
  blockId: string;
  elementIds: string[];
  blockVersionId: string;
  fields: { path: string; versionValue: Json | null; liveValue: Json | null }[];
}

export type VersionRejectCode = 'NOT_JOINED' | 'FORBIDDEN' | 'VERSION_NOT_FOUND' | 'DB_WRITE_FAILED';

/** 클라이언트가 조립한 저장·복원 결과 (ACK → TEMPLATE_SAVED / STRUCTURE_UPDATED · CONTENT_MISMATCH 또는 REJECTED) */
export interface VersionOutcome {
  kind: 'save' | 'restore';
  requestId: string;
  templateId: string;
  ok: boolean;
  /** NO_CHANGES는 성공(ok) 응답이지만 버전을 만들지 않았음을 뜻한다 */
  code?: 'NO_CHANGES' | VersionRejectCode | 'DISCONNECTED';
  message?: string;
  templateVersionId?: string;
  version?: number;
  restoredFromVersionId?: string;
  /** 복원 직전 자동 저장 버전 (v1.2.9) */
  preservedTemplateVersionId?: string;
  preservedVersion?: number;
  createdBlockVersions?: { blockId: string; blockVersionId: string }[];
  reusedBlockVersions?: { blockId: string; blockVersionId: string }[];
  flushedKeys?: string[];
  mismatches?: ContentMismatch[];
  at: number;
};

/** Lock 정보 (Redis lock:* 값, §4) */
export interface LockValue {
  userId: UserId;
  connectionId: string;
  lockToken: string;
  fencingToken: number;
  expiresAt: number;
}

/**
 * 서버의 PROPERTY_UPDATE 처리 결과 기록 (requestId → 결과).
 * NOT_RECEIVED: 서버에 도달하지 않은 요청 (처리 기록 없음)
 */
export type RequestResult =
  | { status: 'APPROVED'; opId: string; streamSeq: number; target: TargetKey; revision: number; assigned?: AssignedIds }
  | { status: 'REJECTED'; opId: string; code: UpdateRejectCode; message: string }
  | { status: 'NOT_RECEIVED' };

/** ELEMENT_CREATE 승인 시 클라이언트 임시 ID → 서버 발급 ID */
export interface AssignedIds {
  localElementId: string;
  localBlockId: string;
  elementId: string;
  blockId: string;
}

export type UpdateRejectCode =
  /** 템플릿 이름이 비었거나 너무 김 (v1.2.7) */
  | 'INVALID_NAME'
  | 'NOT_JOINED'
  | 'FORBIDDEN'
  | 'TARGET_NOT_FOUND'
  | 'LOCK_NOT_HELD'
  | 'FENCING_TOKEN_STALE'
  | 'REVISION_CONFLICT'
  | 'UNDO_CONFLICT'
  | 'STRUCTURE_CONFLICT'
  /** 다른 사용자가 요소(배치) 또는 그 블록(콘텐츠) Lock을 보유 중이라 삭제 불가 (§8.10.5, v1.2.5) */
  | 'ELEMENT_LOCKED'
  | 'DB_WRITE_FAILED';

export type DownMessage =
  | {
      type: 'SYNC';
      requestId: string;
      templateId: string;
      /** SYNC 시작 시 확정한 전역 순번 경계 (§8.9.4). 이 값 이하만 changes에 포함된다 */
      syncWatermark: number;
      /** lastReceivedRevision 이후이며 streamSeq ≤ syncWatermark인 Stream 항목 (streamSeq 순) */
      changes: ChangeEnvelope[];
      /** 템플릿 접속자 Presence 스냅샷 (HGETALL) */
      presence: Record<UserId, PresenceInfo>;
      /** HELLO의 unconfirmedRequestIds에 대한 서버 처리 결과 (requestId 기준, §8.10.6) */
      requestResults: Record<string, RequestResult>;
      /** 클라이언트가 처음 보는 템플릿이면 현재 Live 구성 스냅샷 (최초 로드) */
      snapshot?: TemplateSnapshot;
    }
  | { type: 'PRESENCE'; templateId: string; userId: UserId; info: PresenceInfo | null }
  | { type: 'CHANGE'; broadcastId: string; deliveryId: string; change: ChangeEnvelope }
  | {
      type: 'LOCK_RESULT';
      requestId: string;
      lockKey: string;
      granted: boolean;
      lock?: LockValue;
      /** 거부 시 현재 소유자 */
      owner?: { userId: UserId; expiresAt: number };
    }
  | {
      type: 'UPDATE_RESULT';
      requestId: string;
      opId: string;
      ok: boolean;
      change?: ChangeEnvelope;
      lockExpiresAt?: number;
      code?: UpdateRejectCode;
      message?: string;
    }
  | {
      type: 'STRUCTURE_RESULT';
      requestId: string;
      opId: string;
      ok: boolean;
      change?: ChangeEnvelope;
      assigned?: AssignedIds;
      code?: UpdateRejectCode;
      message?: string;
    }
  /** 저장·복원 요청 승인 (검증 통과). PostgreSQL 저장 완료가 아니다 (§8.11) */
  | { type: 'VERSION_ACK'; requestId: string; kind: 'save' | 'restore'; templateId: string; noChanges: boolean; message?: string }
  /** 저장·복원 요청 거부. stage=validation(검증 실패) | transaction(VERSION_SAVE 롤백) */
  | {
      type: 'VERSION_REJECTED';
      requestId: string;
      kind: 'save' | 'restore';
      operation: 'TEMPLATE_SAVE' | 'TEMPLATE_RESTORE';
      templateId: string;
      code: VersionRejectCode;
      message: string;
      stage: 'validation' | 'transaction';
    }
  /** 저장 상태 알림 (Stream 미기록, §8.3 Delivery는 기록) */
  | {
      type: 'NOTICE';
      broadcastId: string;
      deliveryId: string;
      name: 'PROPERTY_PERSISTED' | 'PROPERTY_PERSIST_FAILED' | 'TEMPLATE_SAVED' | 'CONTENT_MISMATCH';
      target: TargetKey;
      propertyPath: string;
      payload: Json;
    };
