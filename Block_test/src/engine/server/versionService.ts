import type { ReplaceTemplateStructureOp } from '../../editor/model/ops';
import type { EngineContext } from '../context';
import { CONTENT_TABLE_BY_KIND } from '../db/schema';
import type { ContentMismatch, UpMessage, VersionRejectCode } from '../protocol';
import { simTimestamp } from '../simTime';
import type { BlockKind, Json, JsonObject, Placement, Row, TableName, UserId } from '../types';
import { contentColumns, same, snapshotOf } from '../versionCompare';
import type { Broadcaster } from './broadcaster';
import type { EditService, FlushPlan } from './editService';
import {
  blocksOfTemplate,
  contiguousPersisted,
  readLiveBlock,
  readLiveTemplate,
  writeLiveTemplate,
  type LiveBlock,
  type LiveElement,
  type LiveTemplate,
} from './liveState';

/**
 * 명시적 저장과 과거 버전 복원 (DB_SCHEMA §7.7, §7.8, 시나리오 I·J).
 *
 * 이벤트 순서 (§8.11)
 * 저장: TEMPLATE_SAVE → TEMPLATE_SAVE_ACK(요청 승인) → VERSION_SAVE(트랜잭션) → TEMPLATE_SAVED(완료 알림)
 * 복원: TEMPLATE_RESTORE → TEMPLATE_RESTORE_ACK → VERSION_SAVE → STRUCTURE_UPDATED(REPLACE_TEMPLATE_STRUCTURE) → CONTENT_MISMATCH
 * 검증 실패·트랜잭션 실패: TEMPLATE_*_REJECTED (stage = validation | transaction)
 *
 * 저장: 대기 중 Debounce를 같은 트랜잭션 앞단에서 flush → 블록별로 Live content와 current_version 스냅샷 비교
 *       → 변경된 블록만 block_version + 콘텐츠 행 INSERT (나머지는 재사용) → template_version + 전체 구성 TVE INSERT
 *       → 변경이 전혀 없으면 NO_CHANGES (버전 생성 없음)
 * 복원: flush → 새 template_version(restored_from_version_id) + 과거 TVE 복사(block_version_id 유지)
 *       → template_live_element 구성 복원(삭제 요소는 deleted_at = NULL + 재 INSERT, 구성에 없는 요소는 삭제)
 *       → block_live_state, block.current_version_id는 변경하지 않음 → 참조 버전과 Live 콘텐츠가 다르면 CONTENT_MISMATCH
 */

const asJson = <T>(v: T) => v as unknown as Json;

function flattenDiff(a: Json, b: Json, prefix = ''): { path: string; versionValue: Json | null; liveValue: Json | null }[] {
  const isObj = (v: Json): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(a) && isObj(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return keys.flatMap((k) => flattenDiff(a[k] ?? null, b[k] ?? null, prefix ? `${prefix}.${k}` : k));
  }
  return same(a, b) ? [] : [{ path: prefix, versionValue: a ?? null, liveValue: b ?? null }];
}

export class VersionService {
  constructor(
    private ctx: EngineContext,
    private broadcaster: Broadcaster,
    private edits: EditService,
    private isJoined: (userId: UserId) => boolean,
    private sessionTemplateOf: (userId: UserId) => string | null,
  ) {}

  /**
   * 처리한 requestId → 단계 (같은 requestId로 다시 온 요청에 ACK·트랜잭션을 중복으로 실행하지 않기 위함).
   * 요청과 결과(ACK, VERSION_SAVE, REJECTED, 알림)는 모두 같은 requestId로 연결된다.
   */
  private handled = new Map<string, 'acked' | 'rejected' | 'completed'>();

  handle(userId: UserId, message: UpMessage): boolean {
    if (message.type !== 'TEMPLATE_SAVE' && message.type !== 'TEMPLATE_RESTORE') return false;
    const seen = this.handled.get(message.requestId);
    if (seen) {
      // 중복 요청: 다시 ACK하거나 트랜잭션을 실행하지 않는다. 요청 수신 사실만 기록한다
      this.ctx.logger.log({
        name: message.type,
        category: 'request',
        requestId: message.requestId,
        actorUserId: userId,
        from: userId,
        to: ['WS'],
        target: `template:${message.templateId}`,
        payload: asJson({ ...message, duplicate: true, previous: seen }),
        result: 'INFO',
        resultDetail: `중복 요청 · 이미 처리됨 (${seen}) · ACK·트랜잭션 재실행 없음`,
      });
      return true;
    }
    if (message.type === 'TEMPLATE_SAVE') this.save(userId, message);
    else this.restore(userId, message);
    if (!this.handled.has(message.requestId)) this.handled.set(message.requestId, 'completed');
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* 응답 기록                                                            */
  /* ------------------------------------------------------------------ */

  /** TEMPLATE_SAVE_ACK / TEMPLATE_RESTORE_ACK: 요청 승인(검증 통과). PostgreSQL 저장 완료가 아니다 */
  private ack(userId: UserId, kind: 'save' | 'restore', m: { requestId: string; templateId: string }, parent: number, payload: JsonObject, noChanges: boolean, detail: string) {
    if (this.handled.has(m.requestId)) return; // 요청당 ACK는 한 번
    this.handled.set(m.requestId, 'acked');
    this.ctx.logger.log({
      name: kind === 'save' ? 'TEMPLATE_SAVE_ACK' : 'TEMPLATE_RESTORE_ACK',
      category: 'response',
      requestId: m.requestId,
      actorUserId: userId,
      from: 'WS',
      to: [userId],
      target: `template:${m.templateId}`,
      parentSequence: parent,
      payload: asJson({ requestId: m.requestId, templateId: m.templateId, noChanges, ...payload }),
      result: noChanges ? 'INFO' : 'OK',
      resultDetail: detail,
      durationMs: 0,
    });
    this.ctx.ws.sendToClient(userId, { type: 'VERSION_ACK', requestId: m.requestId, kind, templateId: m.templateId, noChanges, ...(noChanges ? { message: detail } : {}) });
  }

  /**
   * TEMPLATE_SAVE_REJECTED / TEMPLATE_RESTORE_REJECTED.
   * 공통 payload: requestId, operation, code, message, rejectedBy, stage, result (+ 트랜잭션 실패 시 cause)
   * - stage = validation: 검증 실패 (ACK 전)
   * - stage = transaction: ACK 이후 VERSION_SAVE 롤백 (code = DB_WRITE_FAILED)
   */
  private reject(
    userId: UserId,
    kind: 'save' | 'restore',
    m: { requestId: string; templateId: string; versionId?: string },
    parent: number,
    code: VersionRejectCode,
    message: string,
    stage: 'validation' | 'transaction',
    cause?: { txId: string; error: string },
  ) {
    const operation = kind === 'save' ? 'TEMPLATE_SAVE' : 'TEMPLATE_RESTORE';
    const acked = this.handled.get(m.requestId) === 'acked';
    this.handled.set(m.requestId, 'rejected');
    this.ctx.logger.log({
      name: kind === 'save' ? 'TEMPLATE_SAVE_REJECTED' : 'TEMPLATE_RESTORE_REJECTED',
      category: 'response',
      requestId: m.requestId,
      actorUserId: userId,
      from: 'WS',
      to: [userId],
      target: `template:${m.templateId}`,
      parentSequence: parent,
      payload: asJson({
        requestId: m.requestId,
        operation,
        templateId: m.templateId,
        ...(m.versionId ? { versionId: m.versionId } : {}),
        code,
        message,
        rejectedBy: 'server',
        stage,
        result: stage === 'transaction' ? 'ROLLED_BACK' : 'NOT_EXECUTED',
        acked,
        ...(cause ? { cause } : {}),
      }),
      result: 'DENIED',
      resultDetail: `${code} · ${stage}${stage === 'transaction' ? ' · ROLLBACK' : ''} · ${message}`,
      durationMs: 0,
    });
    this.ctx.ws.sendToClient(userId, { type: 'VERSION_REJECTED', requestId: m.requestId, kind, operation, templateId: m.templateId, code, message, stage });
  }

  private check(userId: UserId, templateId: string): VersionRejectCode | null {
    if (!this.isJoined(userId)) return 'NOT_JOINED';
    if (this.sessionTemplateOf(userId) !== templateId || !readLiveTemplate(this.ctx.redis, templateId)) return 'FORBIDDEN';
    return null;
  }

  /** 템플릿과 그 블록의 대기 중 Debounce flush 계획 (같은 트랜잭션 앞단에서 적용) */
  private planFlushes(templateId: string, overlay: Map<string, LiveBlock | LiveTemplate>): FlushPlan[] {
    const blocks = new Set(blocksOfTemplate(this.ctx.redis, templateId));
    const keys = this.edits.pendingKeys((d) => d.target === `template:${templateId}` || (d.target.startsWith('block:') && blocks.has(d.target.slice(6))));
    return keys.map((k) => this.edits.planFlush(k, overlay)).filter((p): p is FlushPlan => !!p);
  }

  private request(userId: UserId, m: Extract<UpMessage, { type: 'TEMPLATE_SAVE' | 'TEMPLATE_RESTORE' }>) {
    return this.ctx.logger.log({
      name: m.type,
      category: 'request',
      requestId: m.requestId,
      actorUserId: userId,
      from: userId,
      to: ['WS'],
      target: `template:${m.templateId}`,
      payload: asJson(m),
    });
  }

  /** VERSION_SAVE: 실제 버전 생성(또는 flush) 트랜잭션 기록 */
  private logTx(userId: UserId, requestId: string, templateId: string, parent: number, payload: Json, ok: boolean, detail: string) {
    this.ctx.logger.log({
      name: 'VERSION_SAVE',
      category: 'db',
      requestId,
      actorUserId: userId,
      from: 'WS',
      to: ['PG'],
      target: `template:${templateId}`,
      parentSequence: parent,
      payload,
      result: ok ? 'OK' : 'FAILED',
      resultDetail: detail,
    });
  }

  /* ------------------------------------------------------------------ */
  /* 명시적 저장: TEMPLATE_SAVE → ACK → VERSION_SAVE → TEMPLATE_SAVED      */
  /* ------------------------------------------------------------------ */

  private save(userId: UserId, m: Extract<UpMessage, { type: 'TEMPLATE_SAVE' }>): void {
    const request = this.request(userId, m);
    const denied = this.check(userId, m.templateId);
    if (denied) return this.reject(userId, 'save', m, request.sequence, denied, '권한 없음 (보고 있는 템플릿이 아니거나 세션 미참여)', 'validation');

    const prep = this.prepareVersion(m.templateId);
    // 요청 승인 (검증 통과). 이 시점에는 아직 PostgreSQL에 저장되지 않았다
    this.ack(
      userId,
      'save',
      m,
      request.sequence,
      asJson({ plannedFlushKeys: prep.plans.map((p) => p.key), changedBlocks: prep.changedBlocks }) as JsonObject,
      prep.noChanges,
      prep.noChanges ? 'NO_CHANGES · 버전을 만들지 않습니다' : `승인 · 변경 블록 ${prep.changedBlocks.length}개 · flush 예정 ${prep.plans.length}건`,
    );
    if (prep.noChanges && prep.plans.length === 0) return;
    const result = this.writeVersion(userId, m.requestId, m.templateId, request.sequence, prep, null);
    if (!result.ok) return this.reject(userId, 'save', m, request.sequence, 'DB_WRITE_FAILED', `VERSION_SAVE 트랜잭션 롤백: ${result.error}`, 'transaction', result.cause);
  }

  /** 저장 판단 (§7.7): 대기 중 flush 계획, 블록별 변경 여부, 구성 비교 → 새 버전이 필요한가 */
  private prepareVersion(templateId: string) {
    const { redis, db } = this.ctx;
    const overlay = new Map<string, LiveBlock | LiveTemplate>();
    const plans = this.planFlushes(templateId, overlay);
    const liveT = readLiveTemplate(redis, templateId)!;

    // 블록별 변경 판단: Live content vs current_version 스냅샷 (§7.7)
    const blockIds = [...new Set(Object.values(liveT.elements).map((e) => e.blockId))].sort();
    const decisions = blockIds.map((blockId) => {
      const live = readLiveBlock(redis, blockId)!;
      const blockRow = db.get('block', { id: blockId })!;
      const table = CONTENT_TABLE_BY_KIND[blockRow.kind as BlockKind] as TableName;
      const current = (blockRow.current_version_id as string | null) ?? null;
      const snapshot = current ? snapshotOf(table, db.get(table, { id: current })) : null;
      const columns = contentColumns(table, live.content);
      return { blockId, table, current, columns, changed: !snapshot || !same(columns, snapshot) };
    });

    // 구성 비교: 새 구성 vs 현재 template_version
    const ordered = Object.entries(liveT.elements).sort(([a, x], [b, y]) => x.sequence - y.sequence || a.localeCompare(b));
    const currentTv = (db.get('template', { id: templateId })!.current_version_id as string | null) ?? null;
    const byElement = (rows: { e: string }[]) => [...rows].sort((a, b) => a.e.localeCompare(b.e));
    const currentTve = currentTv
      ? db.select('template_version_element', { template_version_id: currentTv }).map((r) => ({
          e: r.template_element_id as string,
          bv: r.block_version_id,
          s: r.sequence,
          z: r.render_zone,
          p: r.props,
        }))
      : [];
    const composition = ordered.map(([eid, el]) => {
      const d = decisions.find((x) => x.blockId === el.blockId)!;
      return { e: eid, bv: d.changed ? null : d.current, s: el.sequence, z: el.renderZone, p: el.props as unknown as Json };
    });
    const noChanges = decisions.every((d) => !d.changed) && same(asJson(byElement(composition)), asJson(byElement(currentTve)));
    const changedBlocks = decisions.filter((d) => d.changed).map((d) => d.blockId);
    return { plans, liveT, decisions, ordered, noChanges, changedBlocks };
  }

  /**
   * 버전 기록 트랜잭션 (VERSION_SAVE) + 완료 알림 (TEMPLATE_SAVED).
   * beforeRestore: 복원 직전 자동 저장이면 복원 대상 버전 ID (v1.2.9, §7.8)
   */
  private writeVersion(
    userId: UserId,
    requestId: string,
    templateId: string,
    parent: number,
    prep: ReturnType<VersionService['prepareVersion']>,
    beforeRestore: string | null,
  ): { ok: true; templateVersionId?: string; version?: number } | { ok: false; error: string; cause: { txId: string; error: string } } {
    const { db, ids, clock } = this.ctx;
    const { plans, liveT, decisions, ordered, noChanges } = prep;
    const now = simTimestamp(clock.now);

    // ID 발급은 실제로 버전을 만들 때만 (결정성)
    const created: { blockId: string; blockVersionId: string }[] = [];
    const reused: { blockId: string; blockVersionId: string }[] = [];
    const bvOf = new Map<string, string>();
    let tvId: string | undefined;
    let version: number | undefined;
    if (!noChanges) {
      for (const d of decisions) {
        const bvId = d.changed ? ids.next('BV') : d.current!;
        (d.changed ? created : reused).push({ blockId: d.blockId, blockVersionId: bvId });
        bvOf.set(d.blockId, bvId);
      }
      tvId = ids.next('TV');
      version = Math.max(0, ...db.select('template_version', { template_id: templateId }).map((r) => r.version as number)) + 1;
    }
    const tveIds = noChanges ? [] : ordered.map(() => ids.next('TVE'));
    const label = noChanges
      ? `save flush ${templateId}`
      : beforeRestore
        ? `auto save before restore ${templateId} → ${tvId}`
        : `explicit save ${templateId} → ${tvId}`;

    const tx = db.transaction({ label, kind: 'version', requestId, actorUserId: userId }, (t) => {
      for (const p of plans) p.apply(t); // 같은 트랜잭션 앞단에서 Debounce flush (§7.7)
      if (noChanges) return;
      for (const c of created) {
        const d = decisions.find((x) => x.blockId === c.blockId)!;
        const v = Math.max(0, ...t.select('block_version', { block_id: c.blockId }).map((r) => r.version as number)) + 1;
        t.insert('block_version', { id: c.blockVersionId, block_id: c.blockId, version: v, changed_by: userId, changed_at: now });
        t.insert(d.table, { id: c.blockVersionId, ...d.columns });
        t.update('block', { id: c.blockId }, { current_version_id: c.blockVersionId });
        t.update('block_live_state', { block_id: c.blockId }, { base_block_version_id: c.blockVersionId });
      }
      t.insert('template_version', { id: tvId!, template_id: templateId, version: version!, created_by: userId, created_at: now, restored_from_version_id: null });
      ordered.forEach(([eid, el], i) =>
        t.insert('template_version_element', {
          id: tveIds[i],
          template_version_id: tvId!,
          template_element_id: eid,
          block_version_id: bvOf.get(el.blockId)!,
          sequence: el.sequence,
          render_zone: el.renderZone,
          props: asJson(el.props),
        }),
      );
      t.update('template', { id: templateId }, { current_version_id: tvId! });
    });

    const flushedKeys = plans.map((p) => p.key);
    this.logTx(
      userId,
      requestId,
      templateId,
      parent,
      asJson({
        txId: tx.txId,
        flushedKeys,
        created,
        reused,
        templateVersionId: tvId ?? null,
        ...(beforeRestore ? { beforeRestore } : {}),
        changes: tx.ok ? tx.changes.map((c) => `${c.op} ${c.table}`) : [],
        ...(tx.ok ? {} : { error: tx.error }),
      }),
      tx.ok,
      tx.ok
        ? `${tx.txId} COMMIT · ${beforeRestore ? '복원 전 자동 저장 · ' : ''}flush ${flushedKeys.length}건 · ${noChanges ? '버전 생성 없음' : `${tvId} · block_version 신규 ${created.length} / 재사용 ${reused.length}`}`
        : `${tx.txId} ROLLBACK · ${tx.error}`,
    );
    if (!tx.ok) return { ok: false, error: tx.error, cause: { txId: tx.txId, error: tx.error } };

    for (const p of plans) p.commitLive();
    for (const p of plans) this.edits.completeFlush(p);
    if (noChanges) return { ok: true };

    // 저장 완료 알림: Broadcast/Delivery (Stream·전역 순번 미사용, documentView 변경 없음)
    this.broadcaster.notify({
      name: 'TEMPLATE_SAVED',
      requestId,
      actorUserId: userId,
      target: `template:${templateId}`,
      propertyPath: '',
      revision: liveT.revision,
      payload: asJson({ requestId, templateId, templateVersionId: tvId, version, createdBlockVersions: created, reusedBlockVersions: reused, flushedKeys, ...(beforeRestore ? { beforeRestore } : {}) }),
      includeActor: true,
    });
    return { ok: true, templateVersionId: tvId, version };
  }

  /* ------------------------------------------------------------------ */
  /* 복원: TEMPLATE_RESTORE → ACK → VERSION_SAVE → STRUCTURE_UPDATED       */
  /*       (REPLACE_TEMPLATE_STRUCTURE) → CONTENT_MISMATCH                 */
  /* ------------------------------------------------------------------ */

  private restore(userId: UserId, m: Extract<UpMessage, { type: 'TEMPLATE_RESTORE' }>): void {
    const { redis, db, ids, clock } = this.ctx;
    const request = this.request(userId, m);
    const denied = this.check(userId, m.templateId);
    if (denied) return this.reject(userId, 'restore', m, request.sequence, denied, '권한 없음 (보고 있는 템플릿이 아니거나 세션 미참여)', 'validation');
    // 1) 복원 대상 버전의 존재와 템플릿 소속 검증
    const source = db.get('template_version', { id: m.versionId });
    if (!source || source.template_id !== m.templateId)
      return this.reject(
        userId,
        'restore',
        m,
        request.sequence,
        'VERSION_NOT_FOUND',
        source ? `${m.versionId}는 ${String(source.template_id)}의 버전입니다 (요청 템플릿 ${m.templateId})` : `${m.versionId} 없음`,
        'validation',
      );

    // 2) 복원 대상 버전의 전체 요소 구성
    const sourceTve = db
      .select('template_version_element', { template_version_id: m.versionId })
      .sort((a, b) => (a.sequence as number) - (b.sequence as number));
    this.ack(userId, 'restore', m, request.sequence, { versionId: m.versionId, elements: sourceTve.length }, false, `승인 · ${m.versionId} 구성 ${sourceTve.length}개 요소로 전체 교체`);

    // 2-1) 복원 직전 자동 저장 (v1.2.9, §7.8): 마지막 버전 이후 바뀐 것이 있으면 지금 상태를 먼저 버전으로 남긴다.
    //      같은 요청 안에서 순서대로 처리하므로 그 사이에 다른 편집이 끼어들지 않는다
    let preserved: { templateVersionId: string; version: number } | null = null;
    const prep = this.prepareVersion(m.templateId);
    if (!prep.noChanges) {
      const saved = this.writeVersion(userId, m.requestId, m.templateId, request.sequence, prep, m.versionId);
      if (!saved.ok) return this.reject(userId, 'restore', m, request.sequence, 'DB_WRITE_FAILED', `복원 전 자동 저장 롤백: ${saved.error}`, 'transaction', saved.cause);
      preserved = { templateVersionId: saved.templateVersionId!, version: saved.version! };
    }

    // 3) 복원 전 flush (같은 트랜잭션 앞단) + 구성 전체 교체 계산
    const overlay = new Map<string, LiveBlock | LiveTemplate>();
    const plans = this.planFlushes(m.templateId, overlay);
    const liveT = (overlay.get(`template:${m.templateId}`) as LiveTemplate | undefined) ?? readLiveTemplate(redis, m.templateId)!;
    const now = simTimestamp(clock.now);
    const restoredIds = new Set(sourceTve.map((r) => r.template_element_id as string));
    const removed = Object.keys(liveT.elements).filter((eid) => !restoredIds.has(eid));
    const tombstones = { ...(liveT.tombstones ?? {}) };
    for (const eid of removed) tombstones[eid] = liveT.elements[eid].properties;
    const elements: Record<string, LiveElement> = {};
    for (const r of sourceTve) {
      const eid = r.template_element_id as string;
      elements[eid] = {
        blockId: db.get('template_element', { id: eid })!.block_id as string,
        sequence: r.sequence as number,
        renderZone: r.render_zone as string,
        props: structuredClone(r.props) as unknown as Placement,
        properties: liveT.elements[eid]?.properties ?? tombstones[eid] ?? {},
      };
      delete tombstones[eid];
    }
    const revision = liveT.revision + 1;
    const structureRevision = liveT.structureRevision + 1; // 4) 정확히 1 증가
    const nextLive: LiveTemplate = {
      ...liveT,
      revision,
      structureRevision,
      elements,
      unpersisted: liveT.unpersisted.filter((u) => !removed.some((eid) => u.key.startsWith(`${eid}:`))),
      tombstones,
      lastActorUserId: userId,
    };
    const persistedRevision = contiguousPersisted(nextLive);

    // CONTENT_MISMATCH: 복원 버전이 참조하는 block_version 콘텐츠 vs 현재 Live 콘텐츠 (공유 블록 보호로 콘텐츠는 복원하지 않음)
    const mismatches: ContentMismatch[] = [];
    for (const r of sourceTve) {
      const eid = r.template_element_id as string;
      const bvId = r.block_version_id as string;
      const blockId = elements[eid].blockId;
      const table = CONTENT_TABLE_BY_KIND[db.get('block', { id: blockId })!.kind as BlockKind] as TableName;
      const live = (overlay.get(`block:${blockId}`) as LiveBlock | undefined) ?? readLiveBlock(redis, blockId)!;
      const fields = flattenDiff(snapshotOf(table, db.get(table, { id: bvId })), contentColumns(table, live.content));
      if (fields.length === 0) continue;
      const existing = mismatches.find((x) => x.blockId === blockId && x.blockVersionId === bvId);
      if (existing) existing.elementIds.push(eid);
      else mismatches.push({ blockId, elementIds: [eid], blockVersionId: bvId, fields });
    }

    const tvId = ids.next('TV');
    const version = Math.max(0, ...db.select('template_version', { template_id: m.templateId }).map((r) => r.version as number)) + 1;
    const tveIds = sourceTve.map(() => ids.next('TVE'));

    const tx = db.transaction({ label: `restore ${m.templateId} ← ${m.versionId} → ${tvId}`, kind: 'version', requestId: m.requestId, actorUserId: userId }, (t) => {
      for (const p of plans) p.apply(t);
      t.insert('template_version', { id: tvId, template_id: m.templateId, version, created_by: userId, created_at: now, restored_from_version_id: m.versionId });
      sourceTve.forEach((r, i) => t.insert('template_version_element', { ...r, id: tveIds[i], template_version_id: tvId }));
      t.update('template', { id: m.templateId }, { current_version_id: tvId });
      for (const [eid, el] of Object.entries(elements)) {
        const pk = { template_id: m.templateId, template_element_id: eid };
        const row = t.get('template_live_element', pk);
        if (row) {
          const patch: Row = {};
          if (!same(row.props, el.props as unknown as Json)) patch.props = asJson(el.props);
          if (row.sequence !== el.sequence) patch.sequence = el.sequence;
          if (row.render_zone !== el.renderZone) patch.render_zone = el.renderZone;
          if (Object.keys(patch).length) t.update('template_live_element', pk, { ...patch, updated_at: now });
        } else {
          // 삭제된 요소 복원: deleted_at = NULL + live 행 재생성 (§7.8)
          t.update('template_element', { id: eid }, { deleted_at: null });
          t.insert('template_live_element', { ...pk, block_id: el.blockId, sequence: el.sequence, render_zone: el.renderZone, props: asJson(el.props), updated_at: now });
        }
      }
      for (const eid of removed) {
        t.delete('template_live_element', { template_id: m.templateId, template_element_id: eid });
        t.update('template_element', { id: eid }, { deleted_at: now });
      }
      t.update('template_live_state', { template_id: m.templateId }, { revision, persisted_revision: persistedRevision, updated_by: userId, updated_at: now, persisted_at: now });
    });

    const flushedKeys = plans.map((p) => p.key);
    this.logTx(
      userId,
      m.requestId,
      m.templateId,
      request.sequence,
      asJson({ txId: tx.txId, flushedKeys, templateVersionId: tvId, restoredFrom: m.versionId, removed, changes: tx.ok ? tx.changes.map((c) => `${c.op} ${c.table}`) : [], ...(tx.ok ? {} : { error: tx.error }) }),
      tx.ok,
      tx.ok ? `${tx.txId} COMMIT · ${tvId} (restored_from ${m.versionId}) · flush ${flushedKeys.length}건` : `${tx.txId} ROLLBACK · ${tx.error}`,
    );
    if (!tx.ok) return this.reject(userId, 'restore', m, request.sequence, 'DB_WRITE_FAILED', `VERSION_SAVE 트랜잭션 롤백: ${tx.error}`, 'transaction', { txId: tx.txId, error: tx.error });

    for (const p of plans) p.commitLive();
    for (const p of plans) this.edits.completeFlush(p);
    for (const eid of removed) {
      this.edits.cancelElementDebounce(m.templateId, eid);
      const locks = redis.keys(`lock:template:${m.templateId}:element:${eid}:*`);
      if (locks.length) redis.del(...locks);
    }
    writeLiveTemplate(redis, nextLive);

    // 5~6) STRUCTURE_UPDATED에 전체 교체 명령을 담아 요청자를 포함한 접속자에게 전파
    const op: ReplaceTemplateStructureOp = {
      opId: m.requestId,
      actorUserId: userId,
      type: 'REPLACE_TEMPLATE_STRUCTURE',
      templateId: m.templateId,
      templateVersionId: m.versionId,
      newTemplateVersionId: tvId,
      ...(preserved ? { preservedTemplateVersionId: preserved.templateVersionId, preservedVersion: preserved.version } : {}),
      structureRevision,
      elements: sourceTve.map((r) => {
        const eid = r.template_element_id as string;
        const el = elements[eid];
        return { templateElementId: eid, blockId: el.blockId, blockVersionId: r.block_version_id as string, sequence: el.sequence, renderZone: el.renderZone, props: el.props };
      }),
    };
    const { envelope } = this.broadcaster.publishChange(
      { name: 'STRUCTURE_UPDATED', requestId: m.requestId, actorUserId: userId, target: `template:${m.templateId}`, revision, structureRevision, op },
      { includeActor: true },
    );
    this.edits.recordResult(m.requestId, { status: 'APPROVED', opId: op.opId, streamSeq: envelope.streamSeq, target: `template:${m.templateId}`, revision });

    if (mismatches.length)
      this.broadcaster.notify({
        name: 'CONTENT_MISMATCH',
        requestId: m.requestId,
        actorUserId: userId,
        target: `template:${m.templateId}`,
        propertyPath: '',
        revision,
        payload: asJson({ requestId: m.requestId, templateId: m.templateId, templateVersionId: tvId, restoredFromVersionId: m.versionId, mismatches }),
        includeActor: true,
      });
  }
}
