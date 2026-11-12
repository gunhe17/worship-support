import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { ClientState } from '../engine/client/clientRuntime';
import type { SimulationEngine, WorldState } from '../engine/engine';
import type { PresenceInfo } from '../engine/protocol';
import type { SimUser, UserId } from '../engine/types';
import type { DocumentView } from './model/documentModel';
import type { EditorIntent, EditorPort, IntentResult, LocalStatePatch } from './model/intents';
import { renderView, type ReplicaState } from './model/replica';
import { useStore, type Store } from './store/createStore';
import { isViewerSwitching, pushToast, type EditorState } from './store/editorState';

interface EditorContextValue {
  store: Store<EditorState>;
  port: EditorPort;
  engine: SimulationEngine;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ store, port, engine, children }: EditorContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ store, port, engine }), [store, port, engine]);
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorProvider missing');
  return ctx;
}

export function useEditorStore<S>(selector: (s: EditorState) => S): S {
  return useStore(useEditorContext().store, selector);
}

/**
 * 현재 시점 사용자의 선택 목록 (대표 선택 + 함께 선택한 요소). 대표 선택이 바뀌면 다중 선택은 무효.
 * 문서에 없는 요소(삭제됨)는 뺀다.
 */
export function useSelectionIds(): string[] {
  const replica = useViewerReplica();
  const doc = useViewerDocument();
  const multi = useEditorStore((s) => s.multiSelection[s.viewerId]);
  const primary = replica.selectedElementId;
  if (!primary) return [];
  const ids = multi && multi.primary === primary ? multi.ids : [primary];
  return ids.filter((id) => doc.elements[id]);
}

/** DB·Redis 용어 표시 여부 (TopBar의 "개발자 정보" 토글) */
export function useDevInfo(): boolean {
  return useEditorStore((s) => s.devInfo);
}

export function useEditorStoreApi(): Store<EditorState> {
  return useEditorContext().store;
}

/** 엔진 WorldState 구독 (읽기 전용) */
export function useWorld<S>(selector: (w: WorldState) => S): S {
  return useStore(useEditorContext().engine.store, selector);
}

export function useEngine(): SimulationEngine {
  return useEditorContext().engine;
}

export function usePortMode(): EditorPort['mode'] {
  return useEditorContext().port.mode;
}

/** 현재 시점 사용자 */
export function useViewer(): SimUser {
  const viewerId = useEditorStore((s) => s.viewerId);
  const users = useEditorStore((s) => s.users);
  return users.find((u) => u.userId === viewerId)!;
}

export function useViewerClient(): ClientState {
  const viewerId = useEditorStore((s) => s.viewerId);
  return useWorld((w) => w.clients[viewerId]);
}

export function useViewerReplica(): ReplicaState {
  return useViewerClient().replica;
}

/** 모든 사용자의 클라이언트 상태 (PresenceBar 등 시뮬레이터 컨트롤용) */
export function useClients(): Readonly<Record<UserId, ClientState>> {
  return useWorld((w) => w.clients);
}

/**
 * 현재 시점 클라이언트가 Presence(Pub/Sub)로 수신한 다른 사용자 상태.
 * 캔버스의 다른 사용자 선택·커서·이름표는 다른 replica를 직접 읽지 않고 이 값만 사용한다.
 */
export function useRemotePresence(): Record<UserId, PresenceInfo> {
  return useViewerClient().presence;
}

/** 현재 시점 사용자의 화면 = documentView + pendingOps */
export function useViewerDocument(): DocumentView {
  const replica = useViewerReplica();
  return useMemo(() => renderView(replica), [replica]);
}

const SILENT_CODES = new Set(['NO_CHANGE']);

/**
 * 현재 시점 사용자를 actor로 intent를 전달한다.
 * 실패 사유는 토스트로 표시한다 (Lock 충돌, Undo 충돌, 엔진 미연결 등).
 */
export function useIntent(): (intent: EditorIntent) => IntentResult {
  const { store, port } = useEditorContext();
  return useCallback(
    (intent: EditorIntent) => {
      const actor = store.getState().viewerId;
      const result = port.dispatch(actor, intent);
      if (!result.ok && !SILENT_CODES.has(result.code)) {
        pushToast(store, {
          tone: result.code === 'ENGINE_NOT_CONNECTED' ? 'info' : 'warning',
          title: TITLES[result.code] ?? result.code,
          detail: result.message,
        });
      } else if (result.ok && result.message && store.getState().devInfo) {
        // 성공 안내(실행 취소 요청 등)는 개발자 정보를 켰을 때만 보여 준다
        pushToast(store, { tone: 'success', title: result.message });
      }
      return result;
    },
    [store, port],
  );
}

const TITLES: Record<string, string> = {
  ENGINE_NOT_CONNECTED: '엔진 미연결',
  UNDO_CONFLICT: 'Undo 충돌',
  NOTHING_TO_UNDO: '되돌릴 작업 없음',
  NOTHING_TO_REDO: '다시 실행할 작업 없음',
  TARGET_NOT_FOUND: '대상을 찾을 수 없음',
  PROPERTY_LOCK_DENIED: 'Lock 거부',
};

/**
 * 다른 사용자가 보유한 Lock: lockKey → 소유자 userId (MockRedis lock:* 읽기 전용).
 * 화면은 이 값으로 편집 진입을 막는다. 최종 판정은 여전히 서버의 Lock 획득 결과다.
 */
export function useForeignLocks(): Record<string, UserId> {
  const viewerId = useEditorStore((s) => s.viewerId);
  // 문자열로 선택해 Lock 변화가 있을 때만 다시 렌더링한다
  const sig = useWorld((w) =>
    Object.entries(w.redis)
      .map(([k, v]) => [k, k.startsWith('lock:') && v.type === 'string' ? ((v.value as { userId?: string } | null)?.userId ?? '') : ''] as const)
      .filter(([, owner]) => owner && owner !== viewerId)
      .map(([k, owner]) => `${k}\u0002${owner}`)
      .sort()
      .join('\u0001'),
  );
  return useMemo(() => (sig ? Object.fromEntries(sig.split('\u0001').map((s) => s.split('\u0002'))) : {}), [sig]);
}

/** 현재 시점 사용자의 로컬 UI 상태 갱신 (선택, 포커스, 커서) */
export function useLocalState(): (patch: LocalStatePatch) => void {
  const { store, port } = useEditorContext();
  return useCallback(
    (patch: LocalStatePatch) => {
      // 시점 전환 중 발생한 blur 등은 이전 사용자의 상태를 바꾸지 않는다
      if (isViewerSwitching()) return;
      port.updateLocal(store.getState().viewerId, patch);
    },
    [store, port],
  );
}
