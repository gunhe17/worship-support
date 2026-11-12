import { useEffect, useState } from 'react';
import { useEditorStore } from '../editor/editorContext';
import { Icon } from '../editor/ui/icons';
import { DbExplorer } from './DbExplorer';
import { ComparePanel } from './ComparePanel';
import { ConsolePanel } from './ConsolePanel';
import { RedisPanel } from './RedisPanel';
import styles from './monitor.module.css';

export function MonitorPanel({ onCollapse }: { onCollapse: () => void }) {
  const [tab, setTab] = useState<'pg' | 'redis' | 'compare' | 'console'>('compare');
  const focus = useEditorStore((s) => s.monitorFocus);
  useEffect(() => {
    if (focus) setTab(focus.tab);
  }, [focus]);
  return (
    <section className={styles.monitor} aria-label="DB Explorer">
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'pg'} onClick={() => setTab('pg')}>
          <Icon name="database" size={13} /> PostgreSQL
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'redis'} onClick={() => setTab('redis')}>
          <Icon name="pulse" size={13} /> Redis
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'compare'} onClick={() => setTab('compare')} title="Redis Live vs PostgreSQL Persisted">
          <Icon name="layers" size={13} /> Live vs PG
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'console'} onClick={() => setTab('console')} title="Simulation Console">
          <Icon name="plug" size={13} /> Console
        </button>
        <span className={styles.tabSpacer} />
        <button type="button" className={styles.tabAction} onClick={onCollapse} title="DB Explorer 접기" aria-label="DB Explorer 접기">
          <Icon name="panelRight" size={14} />
        </button>
      </div>
      <div className={styles.notice}>
        <Icon name="info" size={12} />
        <span>
          Phase 6 — 속성 편집은 엔진(Lock → PROPERTY_UPDATE → Stream·Delivery → Debounce → PostgreSQL)을 거칩니다. 구조 변경은 즉시 트랜잭션, 저장 버튼은 버전 생성(block_version · template_version), 복원은 새 버전 생성.
        </span>
      </div>
      {tab === 'pg' ? <DbExplorer /> : tab === 'redis' ? <RedisPanel /> : tab === 'compare' ? <ComparePanel /> : <ConsolePanel />}
    </section>
  );
}
