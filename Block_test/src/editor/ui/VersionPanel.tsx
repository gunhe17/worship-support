import type { Json } from '../../engine/types';
import { simClock } from '../../engine/simTime';
import { restoredUnchangedVersionId } from '../../engine/versionState';
import { useDevInfo, useEditorStore, useIntent, useViewerClient, useWorld } from '../editorContext';
import { useState } from 'react';
import { Icon } from './icons';
import { VersionPreview } from './VersionPreview';
import styles from './inspector.module.css';

const show = (v: Json | null) => (v === null ? 'NULL' : typeof v === 'string' ? v : JSON.stringify(v));

/**
 * 버전 이력과 복원 (DB_SCHEMA §7.7, §7.8).
 * 버전 목록은 PostgreSQL template_version을 그대로 보여 준다. 복원은 새 버전을 만들며 기존 버전은 변경하지 않는다.
 */
export function VersionPanel({ templateId }: { templateId: string }) {
  const intent = useIntent();
  const client = useViewerClient();
  const versions = useWorld((w) => w.tables.template_version);
  const current = useWorld((w) => w.tables.template.find((t) => t.id === templateId)?.current_version_id as string | null);
  const tves = useWorld((w) => w.tables.template_version_element);
  const list = versions.filter((v) => v.template_id === templateId).sort((a, b) => (b.version as number) - (a.version as number));
  // 방금 복원한 버전은 수정이 생기기 전까지 다시 복원할 필요가 없으므로 비활성화
  const justRestored = useWorld((w) => restoredUnchangedVersionId(w, templateId));
  const pending = client.versionPending;
  // 복원 전에 그 버전의 배치를 미리 본다 (행을 눌러 펼치고 다시 눌러 접기)
  const [previewId, setPreviewId] = useState<string | null>(null);
  const devInfo = useDevInfo();
  const users = useEditorStore((s) => s.users);
  const nameOf = (id: unknown) => users.find((u) => u.userId === id)?.name ?? String(id);
  const versionNo = (id: unknown) => list.find((v) => v.id === id)?.version;
  const last = client.lastVersion?.templateId === templateId ? client.lastVersion : null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>버전 이력</span>
        <span className={styles.sectionMeta}>
          {list.length}개{devInfo ? ' · template_version' : ''}
        </span>
      </div>

      {last && (devInfo ? <LastResult outcome={last} /> : <LastResultSimple outcome={last} versionNo={versionNo} />)}

      <ol className={styles.versionList}>
        {list.map((v) => {
          const id = v.id as string;
          const isCurrent = id === current;
          const elements = tves.filter((t) => t.template_version_id === id);
          return (
            <li key={id} className={styles.versionRow} data-current={isCurrent}>
              <span className={styles.versionNo}>v{String(v.version)}</span>
              <span className={styles.versionBody}>
                <span className={styles.versionTitle} data-plain={!devInfo}>
                  {devInfo ? id : nameOf(v.created_by)}
                  {isCurrent && <span className={styles.versionBadge}>현재</span>}
                  {v.restored_from_version_id && (
                    <span className={styles.versionBadge} data-kind="restore">
                      {devInfo ? `← ${String(v.restored_from_version_id)}` : `v${String(versionNo(v.restored_from_version_id))}에서 복원`}
                    </span>
                  )}
                </span>
                <span className={styles.versionMeta}>
                  {devInfo
                    ? `${String(v.created_by)} · ${String(v.created_at).slice(11)} · 요소 ${elements.length} · ${[...new Set(elements.map((e) => String(e.block_version_id)))].join(', ')}`
                    : `${String(v.created_at).slice(11, 19)} · 요소 ${elements.length}개`}
                </span>
              </span>
              <button
                type="button"
                className={styles.versionPreviewButton}
                aria-expanded={previewId === id}
                aria-label={`v${String(v.version)} 미리보기`}
                title="미리보기"
                onClick={() => setPreviewId((cur) => (cur === id ? null : id))}
              >
                <Icon name="eye" size={13} />
              </button>
              {!isCurrent && (
                <button
                  type="button"
                  className={styles.versionRestore}
                  disabled={!!pending || justRestored === id}
                  onClick={() => intent({ type: 'restoreVersion', templateId, versionId: id })}
                  title={
                    justRestored === id
                      ? `방금 v${String(v.version)}(으)로 복원했습니다. 수정하면 다시 복원할 수 있습니다`
                      : devInfo
                        ? `${id}의 구성으로 복원 → 새 template_version 생성 (블록 콘텐츠는 유지)`
                        : `지금 상태를 먼저 버전으로 저장한 뒤 v${String(v.version)}의 배치로 되돌립니다`
                  }
                >
                  복원
                </button>
              )}
              {previewId === id && (
                <div className={styles.versionPreviewSlot}>
                  <VersionPreview versionId={id} label={`v${String(v.version)}`} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {pending && (
        <div className={styles.versionPending}>
          <Icon name="cloud" size={12} /> {pending.kind === 'save' ? '저장' : '복원'}하는 중…{devInfo ? ` · ${pending.requestId}` : ''}
        </div>
      )}
    </section>
  );
}

/** 사용자 언어 결과 요약 (상세 비교표는 개발자 정보에서) */
function LastResultSimple({
  outcome,
  versionNo,
}: {
  outcome: NonNullable<ReturnType<typeof useViewerClient>['lastVersion']>;
  versionNo: (id: unknown) => unknown;
}) {
  const what = outcome.kind === 'save' ? '저장' : '복원';
  if (!outcome.ok)
    return (
      <div className={styles.resultCard} data-tone="danger">
        <b>{what}하지 못했어요</b>
        <span>{outcome.message}</span>
      </div>
    );
  if (outcome.code === 'NO_CHANGES')
    return (
      <div className={styles.resultCard} data-tone="info">
        <b>바뀐 내용이 없어 새 버전을 만들지 않았어요</b>
      </div>
    );
  return (
    <div className={styles.resultCard} data-tone={outcome.mismatches?.length ? 'warn' : 'ok'}>
      <b>
        {outcome.kind === 'save'
          ? `${outcome.version !== undefined ? `v${outcome.version} ` : ''}버전 저장 완료`
          : `v${String(versionNo(outcome.restoredFromVersionId))}의 배치로 복원했어요${outcome.version !== undefined ? ` (v${outcome.version})` : ''}`}
      </b>
      {outcome.kind === 'restore' && outcome.preservedVersion !== undefined && <span>복원 전 상태는 v{outcome.preservedVersion}로 저장해 두었어요.</span>}
      {outcome.kind === 'restore' && outcome.mismatches?.length ? (
        <span>글 내용은 지금 내용을 그대로 유지했어요 ({outcome.mismatches.length}개 요소가 그때와 달라요).</span>
      ) : null}
    </div>
  );
}

function LastResult({ outcome }: { outcome: NonNullable<ReturnType<typeof useViewerClient>['lastVersion']> }) {
  const what = outcome.kind === 'save' ? '저장' : '복원';
  if (!outcome.ok)
    return (
      <div className={styles.resultCard} data-tone="danger">
        <b>
          {what} 실패 · {outcome.code}
        </b>
        <span>{outcome.message}</span>
      </div>
    );
  if (outcome.code === 'NO_CHANGES')
    return (
      <div className={styles.resultCard} data-tone="info">
        <b>NO_CHANGES · 버전을 만들지 않았습니다</b>
        <span>{outcome.message}</span>
      </div>
    );
  return (
    <div className={styles.resultCard} data-tone={outcome.mismatches?.length ? 'warn' : 'ok'}>
      <b>
        {what} 완료 · {outcome.templateVersionId}
        {outcome.version !== undefined && ` (v${outcome.version})`} · {simClock(outcome.at)}
      </b>
      {outcome.kind === 'save' ? (
        <span>
          block_version 신규 {outcome.createdBlockVersions?.map((c) => `${c.blockId}→${c.blockVersionId}`).join(', ') || '없음'} · 재사용{' '}
          {outcome.reusedBlockVersions?.map((c) => `${c.blockId}=${c.blockVersionId}`).join(', ') || '없음'}
          {outcome.flushedKeys?.length ? ` · 대기 중 변경 ${outcome.flushedKeys.length}건 함께 저장` : ''}
        </span>
      ) : (
        <span>
          {outcome.restoredFromVersionId}의 구성(배치·순서·참조 버전)을 복원했습니다. 블록 Live 콘텐츠는 변경하지 않았습니다.
        </span>
      )}
      {outcome.mismatches?.map((m) => (
        <div key={`${m.blockId}-${m.blockVersionId}`} className={styles.mismatch}>
          <div className={styles.mismatchHead}>
            <Icon name="warning" size={12} /> CONTENT_MISMATCH · {m.blockId} ({m.elementIds.join(', ')}) · 참조 {m.blockVersionId}
          </div>
          <table className={styles.mismatchTable}>
            <thead>
              <tr>
                <th>필드</th>
                <th>{m.blockVersionId}</th>
                <th>현재 Live</th>
              </tr>
            </thead>
            <tbody>
              {m.fields.map((f) => (
                <tr key={f.path}>
                  <td>{f.path}</td>
                  <td>{show(f.versionValue)}</td>
                  <td>{show(f.liveValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
