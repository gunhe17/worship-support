import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import { elementsOf } from '../../src/editor/model/documentModel';
import type { ReplaceTemplateStructureOp } from '../../src/editor/model/ops';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { renderView } from '../../src/editor/model/replica';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import type { ChangeEnvelope } from '../../src/engine/protocol';
import { STREAM_SEQ_KEY } from '../../src/engine/server/broadcaster';
import { readLiveTemplate } from '../../src/engine/server/liveState';

/** DB_SCHEMA §8.11 검증: 저장·복원 이벤트, VERSION_NOT_FOUND, REPLACE_TEMPLATE_STRUCTURE, 최초 SYNC 스냅샷 */

let engine: SimulationEngine;
let port: EditorPort;
const world = () => engine.store.getState();
const client = (id: string) => world().clients[id];
const view = (id: string) => renderView(client(id).replica);
const events = (name: string) => world().events.filter((e) => e.name === name);
const run = () => engine.runUntilIdle();
const dispatch = (actor: string, intent: EditorIntent) => port.dispatch(actor, intent);
const streamEntries = () => engine.internals.redis.keys('stream:*').flatMap((k) => engine.internals.redis.xrange(k));
const structureRevision = (tid = 'T001') => readLiveTemplate(engine.internals.redis, tid)!.structureRevision;

function setup(opts: Parameters<typeof createSimulationEngine>[0] = {}) {
  engine = createSimulationEngine(opts);
  port = createEngineAdapter(engine);
}

/** 시나리오 I precondition (B + E + F) 후 저장해 TV002를 만든다 */
function savedTv002() {
  dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '안녕하세요! 반갑습니다.' });
  dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'style.fontSize', value: 24 });
  dispatch('U001', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.y': 300 } });
  dispatch('U001', { type: 'endEdit' });
  run();
  dispatch('U001', { type: 'save', templateId: 'T001' });
  run();
}

beforeEach(() => setup());

describe('1~3. 명시적 저장 이벤트', () => {
  it('1. TEMPLATE_SAVE_ACK(요청 승인)은 VERSION_SAVE 전이며, ACK 시점에는 버전이 저장되지 않았다', () => {
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    run();
    dispatch('U001', { type: 'save', templateId: 'T001' });
    engine.advanceBy(10); // 서버 처리: ACK → VERSION_SAVE → TEMPLATE_SAVED가 같은 처리 단위에서 순서대로
    const [ack] = events('TEMPLATE_SAVE_ACK');
    const [tx] = events('VERSION_SAVE');
    const saved = events('TEMPLATE_SAVED')[0];
    expect(ack.sequence).toBeLessThan(tx.sequence);
    expect(tx.sequence).toBeLessThan(saved.sequence);
    expect(ack.payload).not.toHaveProperty('templateVersionId');
    expect(ack.payload).toMatchObject({ noChanges: false, changedBlocks: ['B001'] });
    // 클라이언트: ACK만 받은 상태는 "승인됨"이지 "저장 완료"가 아니다
    engine.step(); // ACK 도착 (FIFO 첫 메시지)
    expect(client('U001').versionPending).toMatchObject({ kind: 'save', acked: true });
    expect(client('U001').lastVersion).toBeNull();
    run(); // TEMPLATE_SAVED 도착
    expect(client('U001').versionPending).toBeNull();
    expect(client('U001').lastVersion).toMatchObject({ ok: true, templateVersionId: 'TV002' });
  });

  it('2. VERSION_SAVE가 실패하면 TEMPLATE_SAVED는 전달되지 않고 TEMPLATE_SAVE_REJECTED(stage=transaction)', () => {
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    run();
    engine.internals.db.failNextWrites(1);
    dispatch('U001', { type: 'save', templateId: 'T001' });
    run();
    expect(events('TEMPLATE_SAVE_ACK')).toHaveLength(1);
    expect(events('VERSION_SAVE')[0]).toMatchObject({ result: 'FAILED' });
    expect(events('TEMPLATE_SAVED')).toHaveLength(0);
    expect(world().broadcasts.some((b) => b.name === 'TEMPLATE_SAVED')).toBe(false);
    expect(events('TEMPLATE_SAVE_REJECTED')[0].payload).toMatchObject({ code: 'DB_WRITE_FAILED', rejectedBy: 'server', stage: 'transaction' });
    expect(client('U001').lastVersion).toMatchObject({ ok: false, code: 'DB_WRITE_FAILED' });
    expect(world().tables.template_version).toHaveLength(1);
  });

  it('3. TEMPLATE_SAVED는 Stream·전역 순번·documentView·revision을 바꾸지 않는다', () => {
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    run(); // flush 완료 → 저장 시 flush 없음
    const before = {
      stream: streamEntries().length,
      seq: engine.internals.redis.get(STREAM_SEQ_KEY),
      views: ['U001', 'U002', 'U003', 'U004'].map((u) => [client(u).replica.documentView, { ...client(u).replica.lastReceivedRevision }, client(u).lastProcessedSeq]),
    };
    dispatch('U001', { type: 'save', templateId: 'T001' });
    run();
    const notice = world().broadcasts.find((b) => b.name === 'TEMPLATE_SAVED')!;
    expect(notice).toMatchObject({ kind: 'notice', streamId: null, recipients: ['U001', 'U002', 'U003', 'U004'], status: 'COMPLETE' });
    expect(streamEntries()).toHaveLength(before.stream);
    expect(engine.internals.redis.get(STREAM_SEQ_KEY)).toBe(before.seq);
    ['U001', 'U002', 'U003', 'U004'].forEach((u, i) => {
      expect(client(u).replica.documentView).toBe(before.views[i][0]);
      expect(client(u).replica.lastReceivedRevision).toEqual(before.views[i][1]);
      expect(client(u).lastProcessedSeq).toBe(before.views[i][2]);
    });
  });

  it('3. 연결이 끊긴 사용자의 TEMPLATE_SAVED Delivery는 QUEUED → 재연결 SYNC 적용 후 DELIVERED', () => {
    engine.disconnect('U004');
    dispatch('U001', { type: 'save', templateId: 'T001' });
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    run();
    dispatch('U001', { type: 'save', templateId: 'T001' });
    run();
    const notice = world().broadcasts.find((b) => b.name === 'TEMPLATE_SAVED')!;
    const d = () => Object.values(world().deliveries).find((x) => x.broadcastId === notice.broadcastId && x.recipientUserId === 'U004')!;
    expect(d().status).toBe('QUEUED');
    engine.connect('U004');
    run();
    expect(d()).toMatchObject({ status: 'DELIVERED', via: 'catch-up' });
  });
});

describe('4. VERSION_NOT_FOUND', () => {
  it.each([
    ['존재하지 않는 버전', 'TV999'],
    ['다른 템플릿의 버전', 'TV101'],
  ])('%s: TEMPLATE_RESTORE_REJECTED, DB·Redis·structureRevision 변경 없음', (_label, versionId) => {
    setup({ fixtures: [{ name: 'K' }] }); // TV101은 T002의 버전
    run();
    const before = { tables: world().tables, redis: world().redis, sr: structureRevision(), tx: world().dbTransactions.length };
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId });
    run();
    const rejected = events('TEMPLATE_RESTORE_REJECTED');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].payload).toMatchObject({ code: 'VERSION_NOT_FOUND', templateId: 'T001', versionId, rejectedBy: 'server', stage: 'validation' });
    expect(events('TEMPLATE_RESTORE_ACK')).toHaveLength(0);
    expect(events('VERSION_SAVE')).toHaveLength(0);
    expect(world().tables).toBe(before.tables);
    expect(world().dbTransactions).toHaveLength(before.tx);
    // Redis: 데이터 키 변경 없음
    expect(world().redis).toBe(before.redis);
    expect(structureRevision()).toBe(before.sr);
    expect(client('U001').lastVersion).toMatchObject({ ok: false, code: 'VERSION_NOT_FOUND' });
  });
});

describe('5~8. 복원 결과 전파: REPLACE_TEMPLATE_STRUCTURE', () => {
  it('5·6. STRUCTURE_UPDATED에 전체 교체 명령이 담기고 structureRevision은 정확히 1 증가한다', () => {
    savedTv002();
    dispatch('U001', { type: 'addElement', templateId: 'T001', kind: 'title' });
    run();
    const before = structureRevision();
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV001' });
    run();
    expect(structureRevision()).toBe(before + 1);
    const change = streamEntries().map((e) => e.fields.change as unknown as ChangeEnvelope).at(-1)!;
    expect(change).toMatchObject({ name: 'STRUCTURE_UPDATED', structureRevision: before + 1 });
    const op = change.op as ReplaceTemplateStructureOp;
    expect(op).toEqual({
      opId: expect.any(String),
      actorUserId: 'U001',
      type: 'REPLACE_TEMPLATE_STRUCTURE',
      templateId: 'T001',
      templateVersionId: 'TV001',
      // v1.2.9: 복원 전에 저장되지 않은 변경(제목 추가)이 있으므로 TV003으로 자동 저장한 뒤 TV004로 복원
      preservedTemplateVersionId: 'TV003',
      preservedVersion: 3,
      newTemplateVersionId: 'TV004',
      structureRevision: before + 1,
      elements: [
        { templateElementId: 'E001', blockId: 'B001', blockVersionId: 'BV001', sequence: 1, renderZone: 'main', props: { position: { x: 100, y: 100 }, size: { width: 300, height: 100 } } },
      ],
    });
    // 개별 ELEMENT_* 이벤트를 반복하지 않는다 (복원 요청 이후 구조 Broadcast는 1건)
    const restoreReq = events('TEMPLATE_RESTORE')[0];
    expect(world().events.filter((e) => e.sequence > restoreReq.sequence && e.category === 'broadcast' && e.name !== 'CONTENT_MISMATCH').map((e) => e.name)).toEqual(['TEMPLATE_SAVED', 'STRUCTURE_UPDATED']); // 복원 전 자동 저장 알림 + 구성 교체 1건
  });

  it('7. 수신 클라이언트는 구성을 전체 교체하고 새 structureRevision을 반영한다 (요청자 포함)', () => {
    savedTv002();
    dispatch('U002', { type: 'addElement', templateId: 'T001', kind: 'list' });
    dispatch('U003', { type: 'addElement', templateId: 'T001', kind: 'title' });
    run();
    dispatch('U003', { type: 'addElement', templateId: 'T001', kind: 'title' });
    run();
    expect(elementsOf(view('U004'), 'T001')).toHaveLength(3);
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV001' });
    run();
    const sr = structureRevision();
    for (const u of ['U001', 'U002', 'U003', 'U004']) {
      expect(elementsOf(view(u), 'T001').map((e) => [e.elementId, e.sequence, e.props.position.y])).toEqual([['E001', 1, 100]]);
      expect(view(u).templates.T001.structureRevision).toBe(sr);
    }
    // 교체된 요소의 블록은 지우지 않는다
    expect(view('U004').blocks.B002).toBeDefined();
  });

  it('8. 복원 과정에서 block_live_state는 변경되지 않는다 (공유 블록 보호), CONTENT_MISMATCH는 알림으로 전달', () => {
    savedTv002();
    const bls = world().tables.block_live_state;
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV001' });
    run();
    expect(world().tables.block_live_state).toBe(bls);
    expect(world().dbChanges.filter((c) => c.table === 'block_live_state' && c.txId === world().dbTransactions.at(-1)!.txId)).toEqual([]);
    const mismatch = world().broadcasts.find((b) => b.name === 'CONTENT_MISMATCH')!;
    expect(mismatch).toMatchObject({ kind: 'notice', streamId: null });
    expect(client('U001').lastVersion?.mismatches?.[0]).toMatchObject({ blockId: 'B001', blockVersionId: 'BV001' });
  });
});

describe('9~10. 처음 보는 템플릿의 최초 SYNC 스냅샷', () => {
  it('9. 처음 진입하면 SYNC에 전체 스냅샷과 structureRevision이 포함되고 documentView가 그것으로 초기화된다', () => {
    engine.loadFixture('K');
    dispatch('U003', { type: 'editPlacement', templateId: 'T001', elementId: 'E001', changes: { 'position.x': 200 } }); // T001만 변경
    run();
    port.updateLocal('U002', { viewingTemplateId: 'T002' });
    run();
    const sync = world().events.filter((e) => e.name === 'SYNC').at(-1)!;
    expect(sync.target).toBe('template:T002');
    expect(view('U002').templates.T002).toEqual({ templateId: 'T002', name: '경력 템플릿', revision: 0, structureRevision: 0 });
    expect(client('U002').replica.lastReceivedRevision['template:T002']).toBe(0);
    // 다시 T001 → T002로 돌아오면 이미 받은 템플릿이므로 증분 SYNC (스냅샷 없음)
    port.updateLocal('U002', { viewingTemplateId: 'T001' });
    run();
    port.updateLocal('U002', { viewingTemplateId: 'T002' });
    run();
    expect(view('U002').elements.E101).toBeDefined();
  });

  it('10. 스냅샷과 실시간 이벤트 사이에 누락·중복이 없다 (SYNC보다 먼저 도착한 실시간 Delivery 포함)', () => {
    engine.loadFixture('K');
    // U001이 B001 content Lock을 보유한 상태로 시작 (이후 편집은 Lock 요청 없이 바로 전송)
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '스냅샷 전' });
    engine.advanceBy(100);
    const t0 = world().now;
    port.updateLocal('U002', { viewingTemplateId: 'T002' }); // VIEW_TEMPLATE 도착 t0+10
    engine.advanceBy(9);
    engine.internals.ws.latencyMs = 60;
    engine.advanceBy(1); // VIEW_TEMPLATE 처리: 스냅샷(rev 1 포함)·watermark 확정, SYNC는 t0+70 도착
    engine.internals.ws.latencyMs = 10;
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '스냅샷 후' }); // 승인 t0+20, U002 도착 t0+30
    engine.advanceBy(25);
    expect(world().now).toBe(t0 + 35);
    // 실시간 Delivery가 SYNC보다 먼저 도착 → 따라잡는 중이므로 보류
    expect(client('U002')).toMatchObject({ sync: 'catching-up', bufferedCount: 1 });
    run();
    const sync = world().events.filter((e) => e.name === 'SYNC').at(-1)!;
    expect((sync.payload as { changes: unknown[] }).changes).toHaveLength(0); // 스냅샷 이전 변경은 스냅샷 상태에 포함
    expect(view('U002').blocks.B001.content.body).toBe('스냅샷 후');
    expect(view('U002').blocks.B001.properties.content.revision).toBe(2); // rev 1(스냅샷) + rev 2(실시간 1회)
    expect(client('U002').replica.lastReceivedRevision['block:B001']).toBe(2);
    expect(client('U002')).toMatchObject({ sync: 'synced', bufferedCount: 0 });
    const changeBroadcasts = new Set(world().broadcasts.filter((b) => b.kind === 'change').map((b) => b.broadcastId));
    const live = Object.values(world().deliveries).filter(
      (d) => d.recipientUserId === 'U002' && changeBroadcasts.has(d.broadcastId) && d.target === 'block:B001' && d.revision === 2,
    );
    expect(live).toEqual([expect.objectContaining({ status: 'DELIVERED', via: 'live' })]);
    // 이후 실시간 이벤트 정상 수신
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: '이후' });
    run();
    expect(view('U002').blocks.B001.content.body).toBe('이후');
    expect(client('U002').replica.lastReceivedRevision['block:B001']).toBe(3);
  });
});

describe('VS-13 ACK 이후 VERSION_SAVE 트랜잭션 실패 (§8.11.3)', () => {
  const rejectedPayload = (name: string) => events(name)[0].payload as Record<string, unknown>;

  it('저장: TEMPLATE_SAVE_REJECTED(stage=transaction, DB_WRITE_FAILED, operation, 원인), 롤백, TEMPLATE_SAVED 미발행, 같은 requestId로 연결', () => {
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    run();
    const before = { tables: world().tables, tv: world().tables.template_version.length };
    engine.internals.db.failNextWrites(1);
    dispatch('U001', { type: 'save', templateId: 'T001' });
    run();
    const p = rejectedPayload('TEMPLATE_SAVE_REJECTED');
    const tx = world().dbTransactions.at(-1)!;
    expect(p).toMatchObject({
      operation: 'TEMPLATE_SAVE',
      code: 'DB_WRITE_FAILED',
      stage: 'transaction',
      result: 'ROLLED_BACK',
      rejectedBy: 'server',
      acked: true,
      cause: { txId: tx.txId, error: 'connection reset (mock)' },
    });
    expect(tx.status).toBe('ROLLED_BACK');
    expect(world().tables).toBe(before.tables); // 롤백: 테이블 변경 없음
    expect(events('TEMPLATE_SAVED')).toHaveLength(0);
    // 요청 · ACK · VERSION_SAVE · REJECTED가 같은 requestId
    const requestId = events('TEMPLATE_SAVE')[0].requestId;
    expect(['TEMPLATE_SAVE_ACK', 'VERSION_SAVE', 'TEMPLATE_SAVE_REJECTED'].map((n) => events(n)[0].requestId)).toEqual([requestId, requestId, requestId]);
    expect(p.requestId).toBe(requestId);
    expect(tx.requestId).toBe(requestId);
    expect(events('TEMPLATE_SAVE_ACK')).toHaveLength(1);
    expect(client('U001').lastVersion).toMatchObject({ ok: false, code: 'DB_WRITE_FAILED', requestId });
  });

  it('복원: TEMPLATE_RESTORE_REJECTED(stage=transaction), 구성·Redis·structureRevision 변경 없음, STRUCTURE_UPDATED 미발행', () => {
    savedTv002();
    const before = { tables: world().tables, live: engine.internals.redis.get('live:template:T001'), sr: structureRevision() };
    engine.internals.db.failNextWrites(1);
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV001' });
    run();
    expect(rejectedPayload('TEMPLATE_RESTORE_REJECTED')).toMatchObject({
      operation: 'TEMPLATE_RESTORE',
      versionId: 'TV001',
      code: 'DB_WRITE_FAILED',
      stage: 'transaction',
      result: 'ROLLED_BACK',
      acked: true,
    });
    expect(events('TEMPLATE_RESTORE_ACK')).toHaveLength(1);
    expect(world().tables).toBe(before.tables);
    expect(engine.internals.redis.get('live:template:T001')).toEqual(before.live);
    expect(structureRevision()).toBe(before.sr);
    expect(world().broadcasts.filter((b) => b.name === 'STRUCTURE_UPDATED' && b.requestId === events('TEMPLATE_RESTORE')[0].requestId)).toEqual([]);
    expect(events('CONTENT_MISMATCH')).toHaveLength(0);
    expect(view('U002').elements.E001.props.position.y).toBe(300);
  });

  it('검증 단계 거부는 stage=validation, result=NOT_EXECUTED, ACK 없음', () => {
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV999' });
    run();
    expect(rejectedPayload('TEMPLATE_RESTORE_REJECTED')).toMatchObject({ operation: 'TEMPLATE_RESTORE', stage: 'validation', result: 'NOT_EXECUTED', acked: false });
    expect(rejectedPayload('TEMPLATE_RESTORE_REJECTED')).not.toHaveProperty('cause');
  });

  it('같은 requestId의 중복 요청에는 ACK·트랜잭션을 다시 실행하지 않는다', () => {
    dispatch('U001', { type: 'editProperty', blockId: 'B001', propertyPath: 'content', value: 'x' });
    run();
    const msg = { type: 'TEMPLATE_SAVE' as const, requestId: 'REQ-DUP', templateId: 'T001' };
    engine.internals.ws.sendToServer('U001', msg);
    engine.internals.ws.sendToServer('U001', msg);
    run();
    expect(events('TEMPLATE_SAVE').map((e) => e.result)).toEqual(['OK', 'INFO']);
    expect(events('TEMPLATE_SAVE_ACK')).toHaveLength(1);
    expect(events('VERSION_SAVE')).toHaveLength(1);
    expect(events('TEMPLATE_SAVED')).toHaveLength(1);
    expect(world().tables.template_version).toHaveLength(2);
  });

  it('복원 요청자도 다른 수신자와 같은 REPLACE_TEMPLATE_STRUCTURE를 받으며 ACK와 STRUCTURE_UPDATED는 별개 이벤트다', () => {
    savedTv002();
    dispatch('U001', { type: 'restoreVersion', templateId: 'T001', versionId: 'TV001' });
    run();
    const ack = events('TEMPLATE_RESTORE_ACK')[0];
    const structure = events('STRUCTURE_UPDATED').at(-1)!;
    expect(ack.sequence).toBeLessThan(structure.sequence);
    expect(ack.payload).not.toHaveProperty('op');
    expect(structure.to).toEqual(['U001', 'U002', 'U003', 'U004']);
    const deliveries = Object.values(world().deliveries).filter((d) => d.broadcastId === structure.broadcastId);
    expect(deliveries.map((d) => [d.recipientUserId, d.status])).toEqual([
      ['U001', 'DELIVERED'],
      ['U002', 'DELIVERED'],
      ['U003', 'DELIVERED'],
      ['U004', 'DELIVERED'],
    ]);
    expect(view('U001').elements).toEqual(view('U003').elements);
  });
});
