import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { hasVersionChanges } from '../../engine/versionState';
import {
  useDevInfo,
  useEditorStore,
  useEditorStoreApi,
  useIntent,
  useLocalState,
  usePortMode,
  useViewerClient,
  useViewerDocument,
  useViewerReplica,
  useWorld,
} from '../editorContext';
import { toggleDevInfo } from '../store/editorState';
import { Icon, type IconName } from './icons';
import { PresenceBar } from './PresenceBar';
import { VersionPanel } from './VersionPanel';
import styles from './shell.module.css';

/**
 * 저장 상태 (현재 시점 사용자 기준).
 * pendingOps(서버 승인 대기) → Debounce 대기(PostgreSQL 미반영) → 저장 완료. 버전 스냅샷(명시적 저장)과는 별개다.
 */
function useSaveState() {
  const viewerId = useEditorStore((s) => s.viewerId);
  const mode = usePortMode();
  const live = useEditorStore((s) => s.live);
  const summary = useWorld((w) => {
    const c = w.clients[viewerId];
    const tid = c.replica.viewingTemplateId;
    const blocks = new Set(Object.values(c.replica.documentView.elements).filter((e) => e.templateId === tid).map((e) => e.blockId));
    const keys = Object.keys(w.redis).filter(
      (k) => k.startsWith(`debounce:template:${tid}:`) || [...blocks].some((b) => k.startsWith(`debounce:block:${b}:`)),
    );
    const failed = keys.filter((k) => {
      const v = w.redis[k];
      const status = v.type === 'string' ? (v.value as { status?: string } | null)?.status : undefined;
      return status === 'FAILED' || status === 'DEAD';
    }).length;
    return [c.replica.pendingOps.length, keys.length, failed, c.sync].join('|');
  });
  const [pending, waiting, failed, sync] = summary.split('|');
  const n = (v: string) => Number(v);

  // label: 사용자 언어 / devLabel: 개발자 정보 표시 시
  if (mode === 'local') {
    const edited = Object.values(live.blocks).some((b) => b.revision > 0);
    return edited
      ? { tone: 'neutral', icon: 'cloudOff' as const, label: '이 기기에만 반영됨', devLabel: 'Live 반영됨 · DB 미연결 (로컬)', short: '로컬 반영' }
      : { tone: 'ok', icon: 'check' as const, label: '모든 변경 사항 저장됨', devLabel: '모든 변경 저장됨', short: '저장됨' };
  }
  if (sync === 'offline')
    return { tone: 'warn', icon: 'cloudOff' as const, label: '오프라인 · 연결되면 다시 보냅니다', devLabel: '연결 끊김 · 편집 전송 불가', short: '오프라인' };
  if (n(failed) > 0)
    return { tone: 'warn', icon: 'warning' as const, label: '저장 실패 · 다시 시도하는 중', devLabel: `DB 저장 실패 ${failed}건 · Live 유지`, short: '저장 실패' };
  if (n(pending) > 0)
    return { tone: 'warn', icon: 'cloud' as const, label: '저장하는 중…', devLabel: `서버 승인 대기 ${pending}건`, short: '저장 중' };
  if (n(waiting) > 0)
    return { tone: 'warn', icon: 'cloud' as const, label: '저장하는 중…', devLabel: `Live 반영됨 · DB 저장 대기 ${waiting}건 (Debounce)`, short: '저장 중' };
  return { tone: 'ok', icon: 'check' as const, label: '모든 변경 사항 저장됨', devLabel: 'Live · PostgreSQL 저장됨 (버전은 버전 저장 버튼)', short: '저장됨' };
}

/** 상단 바 버튼에서 여는 작은 창. 바깥을 누르거나 Esc로 닫는다 */
function Popover({
  icon,
  label,
  active,
  wide,
  children,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={styles.popoverAnchor} ref={ref}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={label}
        aria-expanded={open}
        data-active={open || active}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={icon} />
      </button>
      {open && (
        <div className={styles.popover} data-wide={wide} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}

/** 템플릿 이름: 눌러서 바로 고친다. Enter·포커스 해제로 저장, Esc로 취소 (TEMPLATE_RENAME, §8.8.1) */
function TemplateName({ name, devInfo, onRename }: { name: string; devInfo: boolean; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  if (draft === null)
    return (
      <button
        type="button"
        className={styles.titleText}
        data-editable="true"
        title={devInfo ? '클릭해서 이름 변경 → TEMPLATE_RENAME (즉시 저장)' : '클릭해서 이름 바꾸기'}
        onClick={() => {
          cancelled.current = false;
          setDraft(name);
        }}
      >
        {name || '이름 없는 템플릿'}
      </button>
    );
  const commit = () => {
    const next = draft.trim();
    setDraft(null);
    if (!cancelled.current && next && next !== name) onRename(next);
  };
  return (
    <input
      className={styles.titleInput}
      value={draft}
      autoFocus
      maxLength={60}
      aria-label="템플릿 이름"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      style={{ width: `${Math.max(6, draft.length + 2)}ch` }}
    />
  );
}

const SHORTCUTS: [string, string][] = [
  ['텍스트 입력', '선택 후 클릭 · Enter'],
  ['편집 끝내기', 'Esc'],
  ['굵게 · 기울임 · 밑줄', '⌘B · ⌘I · ⌘U'],
  ['취소선', '⌘⇧X'],
  ['이동', '← → ↑ ↓ (⇧ 10칸)'],
  ['삭제', 'Delete'],
  ['복사 · 붙여넣기 · 복제', '⌘C · ⌘V · ⌘D'],
  ['여러 개 선택', '⇧ + 클릭 · 빈 곳 드래그'],
  ['모두 선택', '⌘A'],
  ['메뉴', '오른쪽 클릭'],
  ['실행 취소 / 다시', '⌘Z · ⇧⌘Z'],
  ['맞춤선 끄고 이동', '⌥ + 드래그'],
];

export function TopBar() {
  const replica = useViewerReplica();
  const client = useViewerClient();
  const local = useLocalState();
  const templates = useWorld((w) => w.tables.template);
  const doc = useViewerDocument();
  const intent = useIntent();
  const save = useSaveState();
  const mode = usePortMode();
  const devInfo = useDevInfo();
  const store = useEditorStoreApi();
  const template = doc.templates[replica.viewingTemplateId];
  const templateId = replica.viewingTemplateId;
  // 마지막 버전 이후 바뀐 것이 없으면 버전 저장이 필요 없다 (서버 NO_CHANGES와 같은 기준)
  const changed = useWorld((w) => hasVersionChanges(w, templateId));
  const saving = client.versionPending?.kind === 'save';
  const canSave = !client.versionPending && (mode !== 'engine' || changed);

  return (
    <header className={styles.topBar}>
      <div className={styles.brand} aria-hidden="true">
        Tm
      </div>
      <div className={styles.docTitle}>
        {devInfo && (
          <div className={styles.crumbs}>
            <span>W001</span>
            <Icon name="chevronRight" size={10} />
            <span>템플릿</span>
          </div>
        )}
        <div className={styles.titleRow}>
          <TemplateName
            name={template?.name ?? ''}
            devInfo={devInfo}
            onRename={(name) => intent({ type: 'renameTemplate', templateId, name })}
          />
          {(devInfo || templates.length > 1) && (
            <select
              className={styles.templateSelect}
              value={templateId}
              onChange={(e) => local({ viewingTemplateId: e.target.value, selectedElementId: null, selectedPropertyPath: null, localSelection: { editingElementId: null } })}
              title="다른 템플릿 보기"
              aria-label="보는 템플릿"
            >
              {templates.map((t) => (
                <option key={String(t.id)} value={String(t.id)}>
                  {devInfo ? String(t.id) : String(t.name)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <span className={styles.divider} />

      <div className={styles.history}>
        <button
          type="button"
          className={styles.iconButton}
          disabled={replica.undoStack.length === 0}
          onClick={() => intent({ type: 'undo' })}
          title={`실행 취소 (⌘Z)${devInfo && replica.undoStack.length ? ` — ${replica.undoStack[replica.undoStack.length - 1].label}` : ''}`}
          aria-label="실행 취소"
        >
          <Icon name="undo" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          disabled={replica.redoStack.length === 0}
          onClick={() => intent({ type: 'redo' })}
          title="다시 실행 (⇧⌘Z)"
          aria-label="다시 실행"
        >
          <Icon name="redo" />
        </button>
      </div>

      <div className={styles.saveState} data-tone={save.tone} title={devInfo ? save.devLabel : save.label}>
        <Icon name={save.icon} size={14} />
        <span className={styles.saveLong}>{devInfo ? save.devLabel : save.label}</span>
        <span className={styles.saveShort}>{save.short}</span>
      </div>

      <div className={styles.spacer} />

      <PresenceBar />

      <div className={styles.tools}>
        <Popover icon="history" label="버전 기록" wide>
          <VersionPanel templateId={templateId} />
        </Popover>
        <Popover icon="help" label="단축키">
          <div className={styles.popoverTitle}>단축키</div>
          <div className={styles.shortcuts}>
            {SHORTCUTS.map(([what, keys]) => (
              <Fragment key={what}>
                <span>{what}</span>
                <kbd className={styles.kbd}>{keys}</kbd>
              </Fragment>
            ))}
          </div>
        </Popover>
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={devInfo}
          data-active={devInfo}
          onClick={() => toggleDevInfo(store)}
          title={devInfo ? '개발자 정보 숨기기' : '개발자 정보 보기 (테이블·ID·경로)'}
          aria-label="개발자 정보"
        >
          <Icon name="code" />
        </button>
      </div>

      <button
        type="button"
        className={styles.primaryButton}
        disabled={!canSave}
        aria-busy={saving || undefined}
        onClick={() => intent({ type: 'save', templateId })}
        title={
          saving
            ? '버전을 저장하는 중입니다'
            : !canSave
              ? '마지막 버전 이후 바뀐 내용이 없습니다'
              : devInfo
                ? '버전 저장: 대기 중 변경 flush → 변경된 블록만 block_version 생성 → template_version 생성'
                : '지금 상태를 새 버전으로 남깁니다. 편집 내용은 이미 자동 저장되고 있어요'
        }
      >
        <Icon name="check" size={14} />
        {saving ? '저장 중…' : '버전 저장'}
      </button>
    </header>
  );
}
