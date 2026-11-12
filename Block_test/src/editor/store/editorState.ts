import type { SimulationEngine } from '../../engine/engine';
import type { SimUser, TableName, UserId } from '../../engine/types';
import { buildDocumentView, type DocumentView } from '../model/documentModel';
import { createStore, type Store } from './createStore';

export interface Toast {
  id: number;
  tone: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  detail?: string;
}

/**
 * 편집기 UI 상태 (엔진 밖의 표시 전용 상태).
 * - viewerId: 현재 화면이 보여주는 사용자 시점 (네트워크와 무관, §8.1)
 * - live: LocalAdapter 전용 공유 상태 (Phase 1~2). Phase 3에서 Redis live:*(엔진)로 대체된다.
 * - toasts: 알림
 *
 * Client Replica, PostgreSQL, Redis, 이벤트는 모두 SimulationEngine의 WorldState에 있다.
 */
/** 모니터 패널 포커스 요청 (Timeline → DB Explorer 트랜잭션 이동 등). seq로 같은 대상 재요청을 구분 */
export interface MonitorFocus {
  seq: number;
  tab: 'pg';
  table?: TableName;
  txId?: string;
  changeId?: string;
}

export interface EditorState {
  users: readonly SimUser[];
  viewerId: UserId;
  live: DocumentView;
  toasts: Toast[];
  monitorFocus: MonitorFocus | null;
  /** 편집기 안에 DB·Redis 용어(테이블·ID·경로)를 함께 보여 줄지. 기본은 사용자 언어만 표시 */
  devInfo: boolean;
  /**
   * 다중 선택 (사용자별, 화면 전용). 대표 선택은 replica.selectedElementId(Presence로 전파)이고,
   * 함께 선택한 나머지 요소만 여기에 둔다. 대표 선택이 바뀌면 자동으로 무효가 된다.
   */
  multiSelection: Record<UserId, { primary: string; ids: string[] }>;
}

export function createEditorStore(engine: SimulationEngine): Store<EditorState> {
  const world = engine.store.getState();
  return createStore<EditorState>({
    users: world.users,
    viewerId: world.users[0].userId,
    live: buildDocumentView(world.tables),
    toasts: [],
    monitorFocus: null,
    devInfo: false,
    multiSelection: {},
  });
}

/** 함께 선택한 요소 지정 (ids는 대표 선택을 포함한 전체 목록) */
export function setMultiSelection(store: Store<EditorState>, userId: UserId, primary: string | null, ids: string[]): void {
  store.setState((s) => {
    const next = { ...s.multiSelection };
    if (!primary || ids.length <= 1) delete next[userId];
    else next[userId] = { primary, ids };
    return { ...s, multiSelection: next };
  });
}

/** 서버 승인으로 임시 요소 ID가 진짜 ID로 바뀌면 다중 선택 목록도 바꾼다 */
export function remapMultiSelection(store: Store<EditorState>, userId: UserId, from: string, to: string): void {
  store.setState((s) => {
    const m = s.multiSelection[userId];
    if (!m || (m.primary !== from && !m.ids.includes(from))) return s;
    const swap = (id: string) => (id === from ? to : id);
    return { ...s, multiSelection: { ...s.multiSelection, [userId]: { primary: swap(m.primary), ids: m.ids.map(swap) } } };
  });
}

export function toggleDevInfo(store: Store<EditorState>): void {
  store.setState((s) => ({ ...s, devInfo: !s.devInfo }));
}

let toastSeq = 0;
export function pushToast(store: Store<EditorState>, toast: Omit<Toast, 'id'>): void {
  const id = ++toastSeq;
  store.setState((s) => ({ ...s, toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
  setTimeout(() => dismissToast(store, id), 4200);
}

export function dismissToast(store: Store<EditorState>, id: number): void {
  store.setState((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) }));
}

/** 사용자 시점 전환: 표시 대상만 바꾼다. 네트워크/Lock/Debounce에 영향 없음 (§8.1) */
export function switchViewer(store: Store<EditorState>, userId: UserId): void {
  store.setState((s) => (s.viewerId === userId ? s : { ...s, viewerId: userId }));
  viewerSwitching = false;
}

/**
 * 시점 전환 중 표시: 전환 버튼을 누르는 순간 브라우저가 이전 사용자의 입력 포커스를 해제하면서
 * blur 핸들러가 이전 사용자의 로컬 상태(선택·편집)를 바꾸는 것을 막는다.
 * 시점 전환은 어떤 사용자의 상태도 바꾸지 않고 네트워크 이벤트를 만들지 않는다 (§8.1, MU-5).
 */
let viewerSwitching = false;
export function beginViewerSwitch(): void {
  viewerSwitching = true;
  // 클릭이 취소되어 switchViewer가 호출되지 않는 경우를 대비한 해제
  setTimeout(() => (viewerSwitching = false), 400);
}
export const isViewerSwitching = () => viewerSwitching;

let focusSeq = 0;
/** DB Explorer로 이동해 트랜잭션·변경을 연다 */
export function focusMonitor(store: Store<EditorState>, focus: Omit<MonitorFocus, 'seq' | 'tab'>): void {
  store.setState((s) => ({ ...s, monitorFocus: { ...focus, tab: 'pg', seq: ++focusSeq } }));
}
