import { useEditorStore, useEditorStoreApi } from '../editorContext';
import { dismissToast } from '../store/editorState';
import { Icon, type IconName } from './icons';
import { LayersPanel } from './LayersPanel';
import { LeftPanel } from './LeftPanel';
import styles from './shell.module.css';
import { Stage } from './Stage';
import { TopBar } from './TopBar';

const TOAST_ICON: Record<string, IconName> = { info: 'info', warning: 'warning', danger: 'warning', success: 'check' };

function Toasts() {
  const toasts = useEditorStore((s) => s.toasts);
  const store = useEditorStoreApi();
  return (
    <div className={styles.toasts} aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast} data-tone={t.tone} role="status">
          <span className={styles.toastIcon}>
            <Icon name={TOAST_ICON[t.tone]} />
          </span>
          <span>
            <div className={styles.toastTitle}>{t.title}</div>
            {t.detail && <div className={styles.toastDetail}>{t.detail}</div>}
          </span>
          <button type="button" className={styles.toastClose} onClick={() => dismissToast(store, t.id)} aria-label="닫기">
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Canvas Editor: TopBar / 요소 추가 / 캔버스(선택 요소 툴바) / 레이어 */
export function EditorShell() {
  return (
    <section className={styles.editor} aria-label="Canvas Editor">
      <TopBar />
      <div className={styles.body}>
        <LeftPanel />
        <Stage />
        <LayersPanel />
      </div>
      <Toasts />
    </section>
  );
}
