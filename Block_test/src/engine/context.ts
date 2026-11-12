import type { VirtualClock } from './clock';
import type { MockDatabase } from './db/mockDatabase';
import type { IdGenerator } from './ids';
import type { EventLogger } from './logger';
import type { MockWebSocket } from './net/mockWebSocket';
import type { DownMessage, UpMessage } from './protocol';
import type { MockRedis } from './redis/mockRedis';
import type { SimUser } from './types';

/** 엔진 구성 요소 묶음. 모든 서비스는 이 컨텍스트로만 상태에 접근한다. */
export interface EngineContext {
  users: readonly SimUser[];
  clock: VirtualClock;
  ids: IdGenerator;
  db: MockDatabase;
  redis: MockRedis;
  ws: MockWebSocket<UpMessage, DownMessage>;
  logger: EventLogger;
}
