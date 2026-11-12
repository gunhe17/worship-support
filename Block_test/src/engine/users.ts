import type { SimUser } from './types';

/**
 * 시뮬레이션용 초기 사용자 (SIMULATION_SCENARIOS.md §1, v1.2).
 * 회원가입/로그인 없이 생성된다. 배열 확장으로 사용자 수를 늘릴 수 있다.
 */
export const SIM_USERS: readonly SimUser[] = [
  { userId: 'U001', name: '사용자 1', color: '#2f6fed', tint: '#e8effd' },
  { userId: 'U002', name: '사용자 2', color: '#1f9d55', tint: '#e5f5ec' },
  { userId: 'U003', name: '사용자 3', color: '#e8770e', tint: '#fdefe2' },
  { userId: 'U004', name: '사용자 4', color: '#8b4fd8', tint: '#f1e9fb' },
];

export function findUser(userId: string): SimUser {
  const user = SIM_USERS.find((u) => u.userId === userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);
  return user;
}
