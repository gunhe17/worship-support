import type { Json, JsonObject } from '../../engine/types';

/** "style.fontSize" 같은 점 경로로 값 읽기 */
export function getAtPath(obj: Json | undefined, path: string): Json | undefined {
  let cur: Json | undefined = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as JsonObject)[key];
  }
  return cur;
}

/** 불변 방식으로 점 경로에 값 쓰기 (중간 객체가 없으면 생성) */
export function setAtPath<T extends JsonObject>(obj: T, path: string, value: Json): T {
  const [head, ...rest] = path.split('.');
  if (rest.length === 0) return { ...obj, [head]: value };
  const child = obj[head];
  const base: JsonObject =
    child !== null && typeof child === 'object' && !Array.isArray(child) ? child : {};
  return { ...obj, [head]: setAtPath(base, rest.join('.'), value) };
}

export function jsonEqual(a: Json | undefined, b: Json | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
