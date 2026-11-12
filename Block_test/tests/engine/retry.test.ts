import { beforeEach, describe, expect, it } from 'vitest';
import { createEngineAdapter } from '../../src/editor/adapters/engineAdapter';
import type { EditorIntent, EditorPort } from '../../src/editor/model/intents';
import { createSimulationEngine, type SimulationEngine } from '../../src/engine/engine';
import type { DebounceValue } from '../../src/engine/server/editService';

/** 저장 실패 재시도와 DEAD (DB_SCHEMA §7.9, §8.10.7, 시나리오 L) */

let engine: SimulationEngine;
let port: EditorPort;
const KEY = 'debounce:block:B001:content';
const world = () => engine.store.getState();
const saves = () => world().events.filter((e) => e.name === 'DEBOUNCE_SAVE');
const debounce = () => engine.internals.redis.get(KEY) as unknown as DebounceValue | null;
const liveRow = () => world().tables.block_live_state[0];
const at = (ms: number) => engine.advanceBy(ms - world().now);
const edit = (actor: string, propertyPath: string, value: string | number) =>
  port.dispatch(actor, { type: 'editProperty', blockId: 'B001', propertyPath, value } as EditorIntent);

beforeEach(() => {
  engine = createSimulationEngine();
  port = createEngineAdapter(engine);
});

describe('재시도 1s · 2s · 4s', () => {
  it('각 시도는 Timeline에 requestId · 대상 · revision · attempt · retryCount · 시각 · 원인 · 다음 재시도 · 상태를 남긴다', () => {
    engine.setFailureInjection(2, 'debounce');
    edit('U001', 'content', '재시도 테스트'); // 승인 t=30
    at(1030);
    expect(debounce()).toMatchObject({ status: 'FAILED', attempt: 1, retryCount: 0, nextRetryAt: 2030, lastError: 'connection reset (mock)' });
    expect(liveRow().revision).toBe(0); // 실패 중 PostgreSQL은 이전 값
    expect(world().clients.U002.replica.documentView.blocks.B001.content.body).toBe('재시도 테스트'); // 화면은 유지
    at(2030);
    expect(debounce()).toMatchObject({ status: 'FAILED', attempt: 2, retryCount: 1, nextRetryAt: 4030 });
    at(4030);
    expect(debounce()).toBeNull();
    expect(liveRow()).toMatchObject({ revision: 1, persisted_revision: 1, content: { body: '재시도 테스트' } });
    const requestId = world().events.find((e) => e.name === 'PROPERTY_UPDATE')!.requestId;
    expect(saves().map((e) => e.payload)).toEqual([
      expect.objectContaining({ requestId, blockId: 'B001', propertyPath: 'content', revision: 1, attempt: 1, retryCount: 0, trigger: 'debounce', attemptedAt: 1030, error: 'connection reset (mock)', injected: true, nextRetryAt: 2030, status: 'FAILED' }),
      expect.objectContaining({ attempt: 2, retryCount: 1, trigger: 'retry', attemptedAt: 2030, nextRetryAt: 4030, status: 'FAILED' }),
      expect.objectContaining({ attempt: 3, retryCount: 2, trigger: 'retry', attemptedAt: 4030, nextRetryAt: null, status: 'PERSISTED' }),
    ]);
    expect(world().events.filter((e) => e.name === 'PROPERTY_PERSIST_FAILED')).toHaveLength(2);
    expect(world().events.filter((e) => e.name === 'PROPERTY_PERSISTED')).toHaveLength(1);
  });

  it('VirtualClock 예약으로만 재시도한다 (시계를 멈추면 재시도도 멈춘다)', () => {
    engine.setFailureInjection(1, 'debounce');
    edit('U001', 'content', 'x');
    at(1030);
    expect(world().timers.map((t) => [t.label, t.dueAt]).filter(([l]) => String(l).startsWith('debounce retry'))).toEqual([['debounce retry 1 debounce:block:B001:content', 2030]]);
    engine.tick(5000); // running = true: 실제 프레임 시간이 아닌 tick 인자만큼만 진행
    expect(saves()).toHaveLength(2);
  });
});

describe('DEAD와 수동 재시도', () => {
  function toDead() {
    engine.setFailureInjection(4, 'debounce');
    edit('U001', 'content', 'DEAD 테스트');
    at(8030 + 1);
  }

  it('최초 1회 + 재시도 3회 실패 → DEAD(attempt 4, retryCount 3), 이후 자동 재시도 없음', () => {
    toDead();
    expect(saves().map((e) => e.timestamp)).toEqual([1030, 2030, 4030, 8030]);
    expect(debounce()).toMatchObject({ status: 'DEAD', attempt: 4, retryCount: 3, nextRetryAt: null });
    engine.advanceBy(120_000);
    expect(saves()).toHaveLength(4);
    expect(world().timers.some((t) => t.label.startsWith('debounce'))).toBe(false);
    expect(liveRow().revision).toBe(0);
    expect(engine.internals.redis.get('live:block:B001')).toMatchObject({ content: { body: 'DEAD 테스트' }, revision: 1 });
    expect(world().injection).toMatchObject({ configured: 4, triggered: 4, remaining: 0 });
  });

  it('수동 재시도 성공: 최신 Live 값으로 저장하고 PROPERTY_PERSISTED', () => {
    toDead();
    expect(engine.manualRetry(KEY)).toBe(true);
    expect(saves().at(-1)!.payload).toMatchObject({ trigger: 'manual', attempt: 5, retryCount: 4, status: 'PERSISTED' });
    expect(debounce()).toBeNull();
    expect(liveRow()).toMatchObject({ revision: 1, persisted_revision: 1, content: { body: 'DEAD 테스트' } });
    expect(engine.manualRetry(KEY)).toBe(false); // DEAD가 아니면 수행하지 않음
  });

  it('수동 재시도 실패: 다시 DEAD (자동 재시도 예약 없음)', () => {
    toDead();
    engine.setFailureInjection(1, 'debounce');
    expect(engine.manualRetry(KEY)).toBe(true);
    expect(saves().at(-1)).toMatchObject({ result: 'FAILED', payload: expect.objectContaining({ trigger: 'manual', status: 'DEAD', nextRetryAt: null }) });
    expect(debounce()).toMatchObject({ status: 'DEAD', attempt: 5, retryCount: 4 });
    engine.advanceBy(60_000);
    expect(saves()).toHaveLength(5);
  });

  it('재시도 대기 중 새 입력: 일반 Debounce로 재예약하고 attempt 0 (L 변형 2), 기존 재시도 예약은 실행되지 않는다', () => {
    engine.setFailureInjection(1, 'debounce');
    edit('U001', 'content', 'A');
    at(1030); // 실패, 재시도 2030 예약
    edit('U001', 'content', 'AB'); // Lock 보유 → 승인 1040
    at(1041);
    expect(debounce()).toMatchObject({ status: 'WAITING', attempt: 0, retryCount: 0, nextRetryAt: null, dueAt: 2040 });
    at(2035);
    expect(saves()).toHaveLength(1); // 2030 재시도는 실행되지 않음
    at(2040);
    expect(saves().at(-1)!.payload).toMatchObject({ trigger: 'debounce', attempt: 1, status: 'PERSISTED' });
    expect(liveRow()).toMatchObject({ revision: 2, persisted_revision: 2, content: { body: 'AB' } });
  });
});

describe('최신 revision 보호', () => {
  it('재시도는 시도 시점의 최신 Live 값과 revision으로 계획한다 (다른 속성 변경 이후에도 PostgreSQL revision이 줄지 않음)', () => {
    engine.setFailureInjection(1, 'debounce');
    edit('U001', 'content', '본문'); // rev1, flush 1030 실패 → 재시도 2030
    engine.advanceBy(500);
    edit('U002', 'style.color', '#ff0000'); // rev2, flush 1530 성공
    at(1600);
    expect(liveRow()).toMatchObject({ revision: 2, persisted_revision: 0 }); // rev1(content) 미저장
    at(2030);
    expect(liveRow()).toMatchObject({ revision: 2, persisted_revision: 2, content: { body: '본문', style: { color: '#ff0000' } } });
    expect(saves().at(-1)!.payload).toMatchObject({ trigger: 'retry', revision: 2 });
  });

  it('PostgreSQL이 Live보다 최신 revision이면 오래된 값으로 덮어쓰지 않는다', () => {
    edit('U001', 'content', '오래된 값');
    at(500);
    // 테스트 전용: 다른 경로로 더 최신 revision이 저장된 상황을 만든다
    engine.internals.db.transaction({ label: 'test: newer row' }, (t) => t.update('block_live_state', { block_id: 'B001' }, { revision: 9, content: { body: '최신', style: { fontSize: 16, color: '#000000' } } }));
    at(1030);
    expect(saves()[0]).toMatchObject({ result: 'FAILED', payload: expect.objectContaining({ error: expect.stringContaining('stale revision') }) });
    expect(liveRow()).toMatchObject({ revision: 9, content: { body: '최신' } });
  });
});

describe('실패 주입', () => {
  it('설정한 횟수만큼만 실제 트랜잭션이 실패한다 (scope = any)', () => {
    engine.setFailureInjection(3);
    edit('U001', 'content', 'x');
    engine.runUntilIdle();
    const failed = world().dbTransactions.filter((t) => t.status === 'ROLLED_BACK');
    expect(failed).toHaveLength(3);
    expect(failed.every((t) => t.injected)).toBe(true);
    expect(world().injection).toMatchObject({ configured: 3, triggered: 3, remaining: 0 });
    expect(liveRow().revision).toBe(1);
  });

  it('scope를 지정하면 해당 종류의 트랜잭션에만 적용된다', () => {
    engine.setFailureInjection(1, 'version');
    edit('U001', 'content', 'x');
    engine.runUntilIdle(); // debounce flush는 영향 없음
    expect(liveRow().revision).toBe(1);
    expect(world().injection.triggered).toBe(0);
    port.dispatch('U001', { type: 'save', templateId: 'T001' });
    engine.runUntilIdle();
    expect(world().dbTransactions.at(-1)).toMatchObject({ kind: 'version', status: 'ROLLED_BACK', injected: true });
    expect(world().events.find((e) => e.name === 'TEMPLATE_SAVE_REJECTED')!.payload).toMatchObject({ code: 'DB_WRITE_FAILED', stage: 'transaction' });
  });

  it('실행 중 해제(count 0)하면 이후 트랜잭션은 성공하고 FAULT_INJECTION으로 기록된다', () => {
    engine.setFailureInjection(5, 'debounce');
    edit('U001', 'content', 'x');
    at(1030);
    engine.setFailureInjection(0);
    at(2030);
    expect(saves().map((e) => e.result)).toEqual(['FAILED', 'OK']);
    expect(world().events.filter((e) => e.name === 'FAULT_INJECTION').map((e) => (e.payload as { enabled: boolean }).enabled)).toEqual([true, false]);
  });

  it('Fixture 트랜잭션은 실패 주입 대상이 아니다', () => {
    engine.setFailureInjection(1);
    expect(engine.loadFixture('K')).toBe(true);
    expect(world().injection.remaining).toBe(1);
  });
});

describe('재시도 불가 오류는 즉시 DEAD (§8.12.2)', () => {
  const testWrite = (fn: Parameters<SimulationEngine['internals']['db']['transaction']>[1]) =>
    engine.internals.db.transaction({ label: 'test: 다른 경로의 저장' }, fn);

  it('revision 보호 실패(STALE_REVISION): 첫 시도에서 DEAD, 자동 재시도 예약 없음', () => {
    edit('U001', 'content', '오래된 값');
    at(500);
    testWrite((t) => t.update('block_live_state', { block_id: 'B001' }, { revision: 9 }));
    at(1030);
    expect(saves()).toHaveLength(1);
    expect(saves()[0]).toMatchObject({ result: 'FAILED', payload: expect.objectContaining({ attempt: 1, retryCount: 0, errorCode: 'STALE_REVISION', retryable: false, status: 'DEAD', nextRetryAt: null }) });
    expect(debounce()).toMatchObject({ status: 'DEAD', attempt: 1, retryCount: 0, nextRetryAt: null, lastErrorCode: 'STALE_REVISION', retryable: false });
    expect(world().timers.some((t) => t.label.startsWith('debounce retry'))).toBe(false);
    engine.advanceBy(60_000);
    expect(saves()).toHaveLength(1);
    expect(liveRow().revision).toBe(9); // 최신 데이터 보존
    expect(world().events.filter((e) => e.name === 'PROPERTY_PERSIST_FAILED').at(-1)!.payload).toMatchObject({ status: 'DEAD', retryable: false });
  });

  it('속성 revision 보호 실패도 STALE_REVISION으로 즉시 DEAD', () => {
    edit('U001', 'content', 'x');
    at(500);
    testWrite((t) =>
      t.insert('block_property_state', { block_id: 'B001', property_path: 'content', revision: 7, persisted_revision: 7, last_fencing_token: 0, updated_at: '2026-01-01 14:00:00.000' }),
    );
    at(1030);
    expect(debounce()).toMatchObject({ status: 'DEAD', attempt: 1, lastErrorCode: 'STALE_REVISION' });
    expect(world().timers.some((t) => t.label.startsWith('debounce retry'))).toBe(false);
  });

  it('Fencing token 불일치(FENCING_TOKEN_STALE): 즉시 DEAD, PostgreSQL 변경 없음', () => {
    edit('U001', 'content', 'x'); // fencingToken 1
    at(500);
    testWrite((t) =>
      t.insert('block_property_state', { block_id: 'B001', property_path: 'content', revision: 0, persisted_revision: 0, last_fencing_token: 99, updated_at: '2026-01-01 14:00:00.000' }),
    );
    at(1030);
    expect(saves()[0].payload).toMatchObject({ errorCode: 'FENCING_TOKEN_STALE', retryable: false, status: 'DEAD', nextRetryAt: null });
    expect(debounce()).toMatchObject({ status: 'DEAD', attempt: 1, retryCount: 0 });
    expect(liveRow()).toMatchObject({ revision: 0, content: { body: '안녕하세요' } });
    engine.advanceBy(60_000);
    expect(saves()).toHaveLength(1);
  });

  it('일반 DB 오류 재시도 중에 재시도 불가 오류가 나면 그 시점에 DEAD (남은 재시도 없음)', () => {
    engine.setFailureInjection(1, 'debounce');
    edit('U001', 'content', 'x');
    at(1030); // 일반 오류 → FAILED, 재시도 2030
    expect(debounce()).toMatchObject({ status: 'FAILED', attempt: 1, retryable: true, lastErrorCode: 'WRITE_FAILED' });
    testWrite((t) => t.update('block_live_state', { block_id: 'B001' }, { revision: 5 }));
    at(2030);
    expect(saves().map((e) => [e.result, (e.payload as { errorCode: string }).errorCode, (e.payload as { status: string }).status])).toEqual([
      ['FAILED', 'WRITE_FAILED', 'FAILED'],
      ['FAILED', 'STALE_REVISION', 'DEAD'],
    ]);
    expect(debounce()).toMatchObject({ status: 'DEAD', attempt: 2, retryCount: 1 });
    engine.advanceBy(60_000);
    expect(saves()).toHaveLength(2);
  });

  it('재시도 불가 DEAD도 수동 재시도는 가능하며, 원인이 그대로면 다시 DEAD', () => {
    edit('U001', 'content', 'x');
    at(500);
    testWrite((t) => t.update('block_live_state', { block_id: 'B001' }, { revision: 9 }));
    at(1030);
    expect(engine.manualRetry(KEY)).toBe(true);
    expect(saves().at(-1)!.payload).toMatchObject({ trigger: 'manual', errorCode: 'STALE_REVISION', status: 'DEAD', attempt: 2 });
    expect(world().timers.some((t) => t.label.startsWith('debounce retry'))).toBe(false);
  });

  it('일반 DB 쓰기 실패(WRITE_FAILED)는 기존과 같이 1s · 2s · 4s 재시도', () => {
    engine.setFailureInjection(3, 'debounce');
    edit('U001', 'content', 'x');
    engine.runUntilIdle();
    expect(saves().map((e) => [e.timestamp, (e.payload as { errorCode?: string }).errorCode ?? null, (e.payload as { status: string }).status])).toEqual([
      [1030, 'WRITE_FAILED', 'FAILED'],
      [2030, 'WRITE_FAILED', 'FAILED'],
      [4030, 'WRITE_FAILED', 'FAILED'],
      [8030, null, 'PERSISTED'],
    ]);
  });
});
