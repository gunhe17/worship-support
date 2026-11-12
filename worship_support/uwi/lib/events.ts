export type Signal = "notifications" | "workspaces" | "friends";

export function emit(signal: Signal): void {
  window.dispatchEvent(new Event(`worship:${signal}`));
}

export function on(signal: Signal, handler: () => void): () => void {
  const name = `worship:${signal}`;
  window.addEventListener(name, handler);
  return () => window.removeEventListener(name, handler);
}
