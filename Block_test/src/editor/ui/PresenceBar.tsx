import type { CSSProperties } from 'react';
import { syncInfoOf, type SyncInfo } from '../../engine/engine';
import type { PresenceInfo } from '../../engine/protocol';
import type { SimUser } from '../../engine/types';
import { useClients, useEditorStore, useEditorStoreApi, useWorld } from '../editorContext';
import type { ReplicaState } from '../model/replica';
import { beginViewerSwitch, switchViewer } from '../store/editorState';
import { Icon } from './icons';
import styles from './shell.module.css';

/** 사용자 자신의 replica 기준 활동 표시 */
export function userActivity(r: ReplicaState): { label: string; active: boolean } {
  if (r.connectionStatus === 'disconnected') return { label: '연결 끊김', active: false };
  if (r.localSelection.editingElementId) return { label: `편집 중 · ${r.localSelection.editingElementId}`, active: true };
  if (r.selectedPropertyPath && r.selectedElementId)
    return { label: `${r.selectedPropertyPath} 편집`, active: true };
  if (r.selectedElementId) return { label: `선택 · ${r.selectedElementId}`, active: false };
  return { label: `${r.viewingTemplateId} 보는 중`, active: false };
}

/** 다른 사용자의 활동 표시: 현재 클라이언트가 수신한 Presence 기준 */
export function presenceActivity(p: PresenceInfo | undefined): { label: string; active: boolean } {
  if (!p) return { label: 'Presence 없음', active: false };
  if (p.status === 'disconnected') return { label: '연결 끊김', active: false };
  if (p.selectedPropertyPath && p.selectedElementId) return { label: `${p.selectedPropertyPath} 편집`, active: true };
  if (p.selectedElementId) return { label: `선택 · ${p.selectedElementId}`, active: false };
  return { label: '보는 중', active: false };
}

/** 동기화 상태 문구. 연결이 끊긴 사용자는 동기화된 것으로 표시하지 않는다 (§8.3) */
export function syncLabel(info: SyncInfo): string | null {
  const gap = info.behind[0];
  const rev = gap ? ` (수신 rev ${gap.received} / 현재 rev ${gap.current})` : '';
  switch (info.state) {
    case 'offline':
      return `동기화 안 됨${rev}`;
    case 'catching-up':
      return '따라잡는 중';
    case 'receiving':
      return `수신 중${rev}`;
    case 'synced':
      return null;
  }
}

export const userStyle = (u: SimUser) => ({ '--user-color': u.color, '--user-tint': u.tint }) as CSSProperties;

/**
 * 사용자 4명 선택 영역 (시뮬레이터 컨트롤). 클릭은 "시점 전환"이며 로그아웃/재접속이 아니다.
 * 각 사용자 자신의 클라이언트 상태(연결, 동기화, 활동)를 보여준다.
 */
export function PresenceBar() {
  const store = useEditorStoreApi();
  const users = useEditorStore((s) => s.users);
  const viewerId = useEditorStore((s) => s.viewerId);
  const clients = useClients();
  // 문자열로 선택해 시계 진행만으로는 다시 렌더링하지 않게 한다
  const syncs = useWorld((w) => users.map((u) => syncLabel(syncInfoOf(w, u.userId)) ?? '').join('\u0001')).split('\u0001');
  const viewer = users.find((u) => u.userId === viewerId)!;

  return (
    <>
      <div className={styles.viewerBadge} style={userStyle(viewer)} title="현재 Canvas Editor가 보여주는 클라이언트 시점">
        <Icon name="eye" size={14} />
        <b>{viewer.userId}</b>
        {viewer.name} 시점
      </div>
      <div className={styles.presence} role="group" aria-label="사용자 시점 선택">
        {users.map((u, i) => {
          const c = clients[u.userId];
          const sync = syncs[i] || null;
          const activity = sync ? { label: sync, active: false } : userActivity(c.replica);
          const status = c.sync === 'offline' ? 'disconnected' : c.sync === 'catching-up' ? 'syncing' : 'connected';
          return (
            <button
              key={u.userId}
              type="button"
              className={styles.userPill}
              style={userStyle(u)}
              aria-pressed={u.userId === viewerId}
              // 포커스를 옮기지 않는다: 이전 사용자의 편집 중 입력창이 blur되지 않도록
              onPointerDown={(e) => {
                beginViewerSwitch();
                e.preventDefault();
              }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => switchViewer(store, u.userId)}
              title={`${u.userId} · ${u.name}\n${activity.label}\n클릭: 이 사용자의 클라이언트 시점으로 전환 (네트워크 이벤트 없음)`}
            >
              <span className={styles.avatar}>
                {u.name.replace(/\D/g, '') || u.name[0]}
                <span className={styles.statusDot} data-status={status} />
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{u.name}</span>
                <span className={styles.userActivity} data-active={activity.active} data-warn={!!sync}>
                  {activity.active && <Icon name="pencil" size={10} />}
                  {activity.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
