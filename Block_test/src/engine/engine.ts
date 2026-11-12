import { buildDocumentView } from '../editor/model/documentModel';
import type { LocalStatePatch } from '../editor/model/intents';
import type { ReplicaState } from '../editor/model/replica';
import { createStore, type Store } from './store';
import type { PropertyUpdateOp } from '../editor/model/ops';
import { ClientRuntime, type ClientState, type OpRejection } from './client/clientRuntime';
import { VirtualClock, type TimerInfo } from './clock';
import type { EngineContext } from './context';
import { MockDatabase, type CrudChange, type FailureInjection, type InjectionScope, type TxRecord } from './db/mockDatabase';
import { IdGenerator, SEED_ID_COUNTERS } from './ids';
import { EventLogger, type SimEvent } from './logger';
import { MockWebSocket, type ConnectionInfo, type InflightMessage } from './net/mockWebSocket';
import type { AssignedIds, VersionOutcome, ChangeEnvelope, DownMessage, PresenceInfo, StructureOp, TargetKey, UpMessage } from './protocol';
import { MockRedis, type RedisCommandLog, type RedisValue } from './redis/mockRedis';
import { createSeedTables } from './seed';
import type { Broadcast, Delivery, PublishOptions } from './server/broadcaster';
import { bootstrapLiveState, liveRevisionOf, targetsOfTemplate } from './server/liveState';
import { applyFixture, type FixtureName, type FixtureSource } from './fixtures';
import { presenceKeyOf } from './server/presenceKeys';
import { WsServer } from './server/wsServer';
import type { Json, SimUser, Tables, UserId } from './types';
import { SIM_USERS } from './users';

/**
 * SimulationEngine (CLAUDE_PROMPT §6, §14.2).
 * VirtualClock · MockDatabase · MockRedis · MockWebSocket · EventLogger · WS Server · Client Replica를 하나로 묶는다.
 * UI는 store(WorldState 스냅샷)만 읽고, 상태 변경은 엔진 메서드로만 요청한다.
 */

export const INITIAL_TEMPLATE_ID = 'T001';
export const SPEEDS = [0.25, 0.5, 1, 2, 4, 10] as const;

export interface WorldState {
  users: readonly SimUser[];
  /** 전체 초기화 세대 (0 = 최초) */
  generation: number;
  /** 마지막 전체 초기화 정보 (realTime은 표시용 실제 시각) */
  lastReset: { generation: number; fixtures: string[]; label: string; realTime: number } | null;
  /** 실패 주입 상태 */
  injection: FailureInjection;
  /** 시뮬레이션 경과 ms */
  now: number;
  running: boolean;
  speed: number;
  timers: TimerInfo[];
  /* PostgreSQL */
  tables: Tables;
  dbChanges: readonly CrudChange[];
  dbTransactions: readonly TxRecord[];
  injectedFailures: number;
  /* Redis */
  redis: Readonly<Record<string, RedisValue>>;
  redisLog: readonly RedisCommandLog[];
  channels: Readonly<Record<string, string[]>>;
  /* WebSocket */
  connections: Readonly<Record<UserId, ConnectionInfo>>;
  inflight: readonly InflightMessage[];
  latencyMs: number;
  /* 이벤트 */
  events: readonly SimEvent[];
  presenceEvents: readonly SimEvent[];
  broadcasts: readonly Broadcast[];
  deliveries: Readonly<Record<string, Delivery>>;
  /* 클라이언트 */
  clients: Readonly<Record<UserId, ClientState>>;
}

export interface EngineOptions {
  users?: readonly SimUser[];
  seed?: Tables;
  latencyMs?: number;
  /** 초기화 시 적용할 Fixture (시나리오 실행기 경로, Console과 같은 applyFixture 사용) */
  fixtures?: { name: FixtureName; source?: FixtureSource }[];
  /** 사용자별 초기 보는 템플릿 (기본 T001) */
  viewing?: Partial<Record<UserId, string>>;
  /** 초기 구간 표시 (시나리오 precondition) */
  initialSection?: SimEvent['section'];
}

export interface ResetOptions {
  fixtures?: EngineOptions['fixtures'];
  viewing?: EngineOptions['viewing'];
  initialSection?: EngineOptions['initialSection'];
  label?: string;
}

export interface SimulationEngine {
  readonly store: Store<WorldState>;
  readonly users: readonly SimUser[];

  /* 시계 */
  /** UI 프레임 구동: 실행 중일 때만 realMs × speed 만큼 진행 */
  tick(realMs: number): void;
  setRunning(running: boolean): void;
  setSpeed(speed: number): void;
  /** 다음 예약 작업 1개 실행 */
  step(): TimerInfo | null;
  advanceBy(ms: number): void;
  runUntilIdle(): void;

  /* 클라이언트 (어댑터와 Simulation Console용) */
  updateReplica(userId: UserId, fn: (r: ReplicaState) => ReplicaState): void;
  updateLocal(userId: UserId, patch: LocalStatePatch): void;
  connect(userId: UserId): boolean;
  disconnect(userId: UserId): boolean;
  /** 속성 변경 제출 (Optimistic: pendingOps 추가 → Lock → PROPERTY_UPDATE) */
  submitOp(userId: UserId, op: PropertyUpdateOp, undo?: { direction: 'undo' | 'redo'; expectedCurrent: Json }): void;
  /** 구조 변경 제출 (Optimistic: pendingOps 추가 → STRUCTURE_COMMAND) */
  submitStructure(userId: UserId, op: StructureOp, undo?: { direction: 'undo' | 'redo'; expectedIndex?: number }): void;
  /** ELEMENT_CREATE 승인 시 임시 ID → 서버 ID 알림 구독 */
  onIdAssigned(listener: (userId: UserId, a: AssignedIds) => void): () => void;
  /** 명시적 저장 (§7.7) */
  requestSave(userId: UserId, templateId: string): void;
  /** 과거 버전 복원 (§7.8) */
  requestRestore(userId: UserId, templateId: string, versionId: string): void;
  onVersionResult(listener: (userId: UserId, o: VersionOutcome, phase: 'final' | 'mismatch') => void): () => void;
  /**
   * 시나리오 FIXTURE 추가 (§1.1 예외: 명령이 아닌 초기 데이터 추가). 이미 있으면 false.
   * K: T002(경력 템플릿, E101 → B001 공유)
   */
  loadFixture(name: FixtureName, source?: FixtureSource): boolean;
  /** 편집 종료: 보유 Lock 명시적 해제 */
  endEdit(userId: UserId): void;

  /* 시뮬레이터 제어 (Phase 6) */
  /** PostgreSQL 쓰기 트랜잭션 실패 주입. count = 0이면 해제. FAULT_INJECTION 이벤트 기록 */
  setFailureInjection(count: number, scope?: InjectionScope, error?: string): void;
  /** DEAD 상태 Debounce 키의 수동 재시도 */
  manualRetry(debounceKey: string): boolean;
  /**
   * 전체 초기화: MockDatabase · MockRedis · MockWebSocket · VirtualClock(예약 작업 포함) · EventLogger ·
   * Lock · Debounce · 재시도 · Client Replica · Presence를 Seed 상태로 다시 만든다. 이전 예약 작업은 실행되지 않는다.
   */
  reset(opts?: ResetOptions): void;
  onReset(listener: (generation: number) => void): () => void;
  /** 이후 기록되는 이벤트의 구간 (PRECONDITION 등) */
  setSection(section: SimEvent['section']): void;
  /**
   * 현재 상태 스냅샷을 즉시 만든다. store는 처리 단위(batch)가 끝날 때 갱신되므로,
   * VirtualClock 작업 안에서 최신 상태가 필요하면(시나리오 검증) 이것을 쓴다.
   */
  snapshotNow(): WorldState;
  /** 현재 세대의 VirtualClock에 작업 예약 (초기화 후에는 실행되지 않음) */
  scheduleAfter(ms: number, label: string, fn: () => void): number;
  /** Optimistic 작업 거부 알림 구독 */
  onRejection(listener: (r: OpRejection) => void): () => void;

  /* 서버 내부 (Phase 3 명령 처리에서 사용) */
  readonly server: {
    publishChange(input: Omit<ChangeEnvelope, 'streamSeq'>, opts?: PublishOptions): Broadcast;
    audienceOf(target: TargetKey): UserId[];
    liveRevisionOf(target: TargetKey): number;
    nextRequestId(): string;
  };

  /** 테스트·디버그용 내부 접근 */
  readonly internals: EngineContext & { server: WsServer; clients: ClientRuntime };
}

/** 엔진 한 세대의 구성 요소. 전체 초기화(reset)는 이 묶음을 통째로 새로 만든다 */
interface Core {
  ctx: EngineContext;
  server: WsServer;
  clients: ClientRuntime;
}

interface Listeners {
  rejection: Set<(r: OpRejection) => void>;
  id: Set<(userId: UserId, a: AssignedIds) => void>;
  version: Set<(userId: UserId, o: VersionOutcome, phase: 'final' | 'mismatch') => void>;
  reset: Set<(generation: number) => void>;
}

function buildCore(opts: EngineOptions, users: readonly SimUser[], listeners: Listeners): Core {
  const clock = new VirtualClock();
  const ids = new IdGenerator(SEED_ID_COUNTERS);
  const seed = opts.seed ?? createSeedTables();
  const db = new MockDatabase(clock, ids, seed);
  const redis = new MockRedis(clock);
  const ws = new MockWebSocket<UpMessage, DownMessage>(clock, ids, users.map((u) => u.userId), opts.latencyMs ?? 10);
  const logger = new EventLogger(clock, users);
  const ctx: EngineContext = { users, clock, ids, db, redis, ws, logger };

  // 초기화 Fixture: 클라이언트·live 구성 전에 DB에 반영 (live는 아래 bootstrapLiveState가 일괄 생성)
  if (opts.initialSection) logger.setSection(opts.initialSection);
  for (const f of opts.fixtures ?? []) applyFixture(ctx, f.name, f.source ?? 'ScenarioRunner', { bootstrapLive: false });

  const server = new WsServer(ctx);
  const clients = new ClientRuntime(ctx, buildDocumentView(db.tables), INITIAL_TEMPLATE_ID);
  clients.setReports({
    deliveryApplied: (deliveryId) => server.deliveryApplied(deliveryId),
    syncApplied: (userId, requestId) => server.syncApplied(userId, requestId),
    opRejected: (r) => listeners.rejection.forEach((l) => l(r)),
    idAssigned: (userId, a) => listeners.id.forEach((l) => l(userId, a)),
    versionResult: (userId, o, phase) => listeners.version.forEach((l) => l(userId, o, phase)),
  });

  // 초기 상태: Redis live:* 구성, 4명 모두 접속·참여 (이벤트 없이)
  bootstrapLiveState(db, redis);
  for (const u of users) {
    const templateId = opts.viewing?.[u.userId] ?? INITIAL_TEMPLATE_ID;
    if (templateId !== INITIAL_TEMPLATE_ID) clients.updateReplica(u.userId, (r) => ({ ...r, viewingTemplateId: templateId }));
    const connectionId = ws.open(u.userId);
    server.bootstrapJoin(u.userId, connectionId, templateId, clients.presenceFields(u.userId));
  }
  for (const u of users) {
    const templateId = clients.clients[u.userId].replica.viewingTemplateId;
    clients.bootstrapConnected(u.userId, redis.hgetall(presenceKeyOf(templateId)) as unknown as Record<UserId, PresenceInfo>);
  }
  return { ctx, server, clients };
}

export function createSimulationEngine(opts: EngineOptions = {}): SimulationEngine {
  const users = opts.users ?? SIM_USERS;
  const listeners: Listeners = { rejection: new Set(), id: new Set(), version: new Set(), reset: new Set() };
  let core = buildCore(opts, users, listeners);
  let generation = 0;
  let lastReset: WorldState['lastReset'] = null;

  let running = true;
  let speed = 1;
  let carry = 0;

  const snapshot = (): WorldState => {
    const { clock, db, redis, ws, logger } = core.ctx;
    return {
      users,
      generation,
      lastReset,
      now: clock.now,
      running,
      speed,
      timers: clock.pending(),
      tables: db.tables,
      dbChanges: db.changes,
      dbTransactions: db.transactions,
      injectedFailures: db.injectedFailures,
      injection: db.injection,
      redis: redis.data,
      redisLog: redis.commandLog,
      channels: redis.channels,
      connections: ws.connections,
      inflight: ws.inflight,
      latencyMs: ws.latencyMs,
      events: logger.events,
      presenceEvents: logger.presenceEvents,
      broadcasts: core.server.broadcaster.broadcasts,
      deliveries: core.server.broadcaster.deliveries,
      clients: core.clients.clients,
    };
  };

  const store = createStore<WorldState>(snapshot());

  // 변경된 모듈이 있을 때만 새 스냅샷을 만든다. timers 배열은 시계 버전이 바뀔 때만 다시 만든다.
  const versionKey = () => {
    const { clock, db, redis, ws, logger } = core.ctx;
    return [generation, clock.version, clock.now, db.version, redis.version, ws.version, logger.version, core.server.broadcaster.version, core.clients.version, running, speed].join('|');
  };
  let lastKey = versionKey();
  let lastClockVersion = core.ctx.clock.version;
  let lastGeneration = generation;
  let depth = 0;

  const publish = () => {
    const key = versionKey();
    if (key === lastKey) return;
    lastKey = key;
    store.setState((prev) => {
      const next = snapshot();
      if (generation === lastGeneration && core.ctx.clock.version === lastClockVersion) next.timers = prev.timers;
      lastClockVersion = core.ctx.clock.version;
      lastGeneration = generation;
      return next;
    });
  };

  function batch<T>(fn: () => T): T {
    depth++;
    try {
      return fn();
    } finally {
      depth--;
      if (depth === 0) publish();
    }
  }

  const engine: SimulationEngine = {
    store,
    users,

    tick(realMs) {
      if (!running || realMs <= 0) return;
      batch(() => {
        // 소수 ms 누적 (저속 재생 시 진행 손실 방지)
        const total = realMs * speed + carry;
        const whole = Math.floor(total);
        carry = total - whole;
        if (whole > 0) core.ctx.clock.advanceBy(whole);
      });
    },
    setRunning(value) {
      batch(() => {
        running = value;
        carry = 0;
      });
    },
    setSpeed(value) {
      batch(() => {
        speed = value;
      });
    },
    step: () => batch(() => core.ctx.clock.step()),
    advanceBy: (ms) => batch(() => void core.ctx.clock.advanceBy(ms)),
    runUntilIdle: () => batch(() => void core.ctx.clock.runUntilIdle()),

    updateReplica: (userId, fn) => batch(() => core.clients.updateReplica(userId, fn)),
    updateLocal: (userId, patch) => batch(() => core.clients.updateLocal(userId, patch)),
    connect: (userId) => batch(() => core.clients.connect(userId)),
    disconnect: (userId) => batch(() => core.clients.disconnect(userId)),
    submitOp: (userId, op, undo) => batch(() => core.clients.submit(userId, op, undo)),
    endEdit: (userId) => batch(() => core.clients.endEdit(userId)),
    submitStructure: (userId, op, undo) => batch(() => core.clients.submitStructure(userId, op, undo)),
    loadFixture: (name, source = 'SimulationConsole') => batch(() => applyFixture(core.ctx, name, source, { bootstrapLive: true }).ok),
    requestSave: (userId, templateId) => batch(() => core.clients.requestVersion(userId, 'save', templateId)),
    requestRestore: (userId, templateId, versionId) => batch(() => core.clients.requestVersion(userId, 'restore', templateId, versionId)),

    setFailureInjection: (count, scope = 'any', error) =>
      batch(() => {
        const { db, logger } = core.ctx;
        db.failNextWrites(count, { scope, error });
        const inj = db.injection;
        logger.log({
          name: 'FAULT_INJECTION',
          category: 'system',
          from: 'PG',
          to: [],
          target: 'postgresql',
          payload: { count: inj.configured, scope: inj.scope, error: inj.error, enabled: inj.configured > 0 },
          result: 'INFO',
          resultDetail: inj.configured > 0 ? `다음 ${inj.configured}회 ${inj.scope} 쓰기 트랜잭션 실패 (${inj.error})` : '실패 주입 해제',
        });
      }),
    manualRetry: (key) => batch(() => core.server.edits.manualRetry(key)),

    reset: (resetOpts = {}) =>
      batch(() => {
        // 이전 세대의 시계·예약 작업·연결·상태를 모두 버리고 Seed 기준으로 다시 만든다
        core = buildCore({ ...opts, ...resetOpts }, users, listeners);
        generation += 1;
        carry = 0;
        lastReset = {
          generation,
          fixtures: (resetOpts.fixtures ?? opts.fixtures ?? []).map((f) => f.name),
          label: resetOpts.label ?? '전체 초기화',
          realTime: Date.now(),
        };
        listeners.reset.forEach((l) => l(generation));
      }),
    onReset: (listener) => {
      listeners.reset.add(listener);
      return () => listeners.reset.delete(listener);
    },
    setSection: (section) => core.ctx.logger.setSection(section),
    snapshotNow: () => snapshot(),
    scheduleAfter: (ms, label, fn) => {
      const gen = generation;
      return core.ctx.clock.schedule(ms, label, () => {
        if (gen === generation) fn();
      });
    },

    onVersionResult: (listener) => {
      listeners.version.add(listener);
      return () => listeners.version.delete(listener);
    },
    onIdAssigned: (listener) => {
      listeners.id.add(listener);
      return () => listeners.id.delete(listener);
    },
    onRejection: (listener) => {
      listeners.rejection.add(listener);
      return () => listeners.rejection.delete(listener);
    },

    server: {
      publishChange: (input, o) => batch(() => core.server.broadcaster.publishChange(input, o).broadcast),
      audienceOf: (target) => core.server.broadcaster.audienceOf(target),
      liveRevisionOf: (target) => liveRevisionOf(core.ctx.redis, target),
      nextRequestId: () => core.ctx.ids.next('REQ'),
    },

    get internals() {
      return { ...core.ctx, server: core.server, clients: core.clients };
    },
  };
  return engine;
}

/* ------------------------------------------------------------------ */
/* 파생 조회 (UI·테스트 공용, 순수 함수)                                   */
/* ------------------------------------------------------------------ */

export interface SyncInfo {
  state: 'synced' | 'receiving' | 'catching-up' | 'offline';
  /** 수신 revision < 서버 revision 인 대상 */
  behind: { target: TargetKey; received: number; current: number }[];
}

/**
 * 사용자의 동기화 상태 (§8.3).
 * 연결이 끊겼거나 따라잡기 중이면 동기화된 것으로 표시하지 않는다.
 */
export function syncInfoOf(world: WorldState, userId: UserId): SyncInfo {
  const client = world.clients[userId];
  const redisGet = (key: string) => {
    const v = world.redis[key];
    return v && v.type === 'string' ? (v.value as { revision?: number } | null) : null;
  };
  const templateId = client.replica.viewingTemplateId;
  const live = redisGet(`live:template:${templateId}`) as { elements?: Record<string, { blockId: string }> } | null;
  const blocks = [...new Set(Object.values(live?.elements ?? {}).map((e) => e.blockId))];
  const targets: TargetKey[] = [`template:${templateId}`, ...blocks.map((b) => `block:${b}` as TargetKey)];
  const behind = targets
    .map((target) => ({
      target,
      received: client.replica.lastReceivedRevision[target] ?? 0,
      current: redisGet(`live:${target}`)?.revision ?? 0,
    }))
    .filter((t) => t.received < t.current);

  if (client.sync === 'offline') return { state: 'offline', behind };
  if (client.sync === 'catching-up') return { state: 'catching-up', behind };
  return { state: behind.length ? 'receiving' : 'synced', behind };
}

/** 대상 키 목록 (템플릿 + 배치된 블록) — 엔진 내부 Redis 기준 */
export function engineTargetsOf(engine: SimulationEngine, templateId: string): TargetKey[] {
  return targetsOfTemplate(engine.internals.redis, templateId);
}
