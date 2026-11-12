import { useState } from 'react';
import {
  useDevInfo,
  useEditorStore,
  useForeignLocks,
  useIntent,
  useLocalState,
  usePortMode,
  useRemotePresence,
  useSelectionIds,
  useViewer,
  useViewerDocument,
  useViewerReplica,
} from '../editorContext';
import { elementsOf } from '../model/documentModel';
import { elementLockOwner } from '../model/lockKeys';
import { elementSummary } from './elementLabel';
import { Icon } from './icons';
import styles from './leftPanel.module.css';
import { userStyle } from './PresenceBar';
import { useElementActions } from './useElementActions';

/**
 * 오른쪽 레이어 패널: 요소 목록(위에 그려지는 요소가 위), 클릭으로 선택, 끌어서 겹침 순서 변경.
 * 선택한 요소의 서식은 캔버스의 요소 툴바에서 바꾼다.
 */
function LayerList() {
  const doc = useViewerDocument();
  const replica = useViewerReplica();
  const viewer = useViewer();
  const users = useEditorStore((s) => s.users);
  const presence = useRemotePresence();
  const intent = useIntent();
  const local = useLocalState();
  const devInfo = useDevInfo();
  const selectionIds = useSelectionIds();
  const actions = useElementActions();
  const foreignLocks = useForeignLocks();
  const [drag, setDrag] = useState<{ id: string; over: string | null; pos: 'before' | 'after' } | null>(null);

  const ordered = elementsOf(doc, replica.viewingTemplateId);
  // 레이어 목록은 위에 그려지는 요소(sequence 큰 값)가 위쪽
  const layers = [...ordered].reverse();

  const drop = () => {
    if (!drag?.over || drag.over === drag.id) return setDrag(null);
    const without = ordered.filter((e) => e.elementId !== drag.id);
    const overIdx = without.findIndex((e) => e.elementId === drag.over);
    // 화면상 before(위) = sequence 상 뒤쪽
    const toIndex = drag.pos === 'before' ? overIdx + 1 : overIdx;
    intent({ type: 'reorderElement', templateId: replica.viewingTemplateId, elementId: drag.id, toIndex });
    setDrag(null);
  };

  return (
    <>
      <div className={styles.drawerHeader}>
        <span className={styles.drawerTitle}>레이어</span>
        <span className={styles.drawerHint}>{ordered.length}개 · 드래그로 순서 변경</span>
      </div>
      <div className={styles.drawerBody}>
        {layers.length === 0 && <div className={styles.empty}>요소가 없습니다</div>}
        <ul className={styles.layerList} style={userStyle(viewer)}>
          {layers.map((el) => {
            const block = doc.blocks[el.blockId];
            const lockOwnerId = elementLockOwner(foreignLocks, el);
            const lockOwner = users.find((u) => u.userId === lockOwnerId) ?? null;
            const others = users.filter(
              (u) => u.userId !== viewer.userId && presence[u.userId]?.status === 'connected' && presence[u.userId].selectedElementId === el.elementId,
            );
            return (
              <li
                key={el.elementId}
                className={styles.layer}
                aria-selected={selectionIds.includes(el.elementId)}
                data-locked={!!lockOwner || undefined}
                data-drop={drag?.over === el.elementId && drag.id !== el.elementId ? drag.pos : undefined}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setDrag({ id: el.elementId, over: null, pos: 'before' });
                }}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                  if (drag.over !== el.elementId || drag.pos !== pos) setDrag({ ...drag, over: el.elementId, pos });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop();
                }}
                onDragEnd={() => setDrag(null)}
                // Shift+클릭: 함께 선택에 더하거나 빼기
                onClick={(e) => {
                  if (!e.shiftKey) return actions.select([el.elementId]);
                  const ids = selectionIds.includes(el.elementId) ? selectionIds.filter((id) => id !== el.elementId) : [...selectionIds, el.elementId];
                  if (ids.length) actions.select(ids);
                  else local({ selectedElementId: null, selectedPropertyPath: null, localSelection: { editingElementId: null } });
                }}
                title={devInfo ? `sequence ${el.sequence}` : undefined}
              >
                <span className={styles.grip}>
                  <Icon name="grip" size={12} />
                </span>
                <span className={styles.layerIcon}>
                  <Icon name={block?.kind ?? 'text'} size={13} />
                </span>
                <span className={styles.layerText}>
                  <span className={styles.layerName}>{elementSummary(block)}</span>
                  {devInfo && (
                    <span className={styles.layerId}>
                      {el.elementId} · #{el.sequence}
                    </span>
                  )}
                </span>
                <span className={styles.layerMarks}>
                  {el.provisional && <span className={styles.tag}>{devInfo ? '로컬' : '저장 중'}</span>}
                  {/* 다른 사용자가 편집 중(Lock 보유)이면 자물쇠와 이름을 계속 보여 준다 */}
                  {lockOwner && (
                    <span className={styles.lockTag} style={userStyle(lockOwner)} title={`${lockOwner.name}이(가) 편집 중`}>
                      <Icon name="lock" size={9} />
                      {lockOwner.name}
                    </span>
                  )}
                  {others.map((u) => (
                    <span key={u.userId} className={styles.mark} style={{ ['--mark-color' as string]: u.color }} title={`${u.name} 선택 중`} />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

export function LayersPanel() {
  const viewer = useViewer();
  const devInfo = useDevInfo();
  const mode = usePortMode();
  return (
    <aside className={styles.layersPanel} style={userStyle(viewer)} aria-label="레이어">
      <div className={styles.drawer}>
        <LayerList />
        {devInfo && (
          <div className={styles.adapterNote}>
            <Icon name="info" size={14} style={{ flex: 'none', marginTop: 1 }} />
            {mode === 'engine' ? (
              <span>
                <code>EngineAdapter</code> — 속성 편집은 즉시 화면에 반영된 뒤 Lock 획득 → PROPERTY_UPDATE 승인 → 다른 사용자 Delivery → 1초 Debounce 후
                PostgreSQL에 저장됩니다. 요소를 벗어나면 Lock을 해제합니다. 요소 추가·삭제·순서 변경은 Debounce 없이 즉시 저장됩니다.
              </span>
            ) : (
              <span>
                <code>LocalAdapter</code> — 편집은 모든 replica에 즉시 반영되며 DB·Redis는 변경되지 않습니다.
              </span>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
