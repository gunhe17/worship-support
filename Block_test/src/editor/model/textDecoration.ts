/** ⌘B·⌘I·⌘U·⌘⇧X → 글자 꾸밈 property_path (v1.2.6, DB_SCHEMA §8.6) */
export function decorationShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): string | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null;
  const k = e.key.toLowerCase();
  if (!e.shiftKey && k === 'b') return 'style.bold';
  if (!e.shiftKey && k === 'i') return 'style.italic';
  if (!e.shiftKey && k === 'u') return 'style.underline';
  if (e.shiftKey && k === 'x') return 'style.strikethrough';
  return null;
}
