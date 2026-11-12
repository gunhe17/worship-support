export type Named = { name: string; email: string | null };

export function duplicated(people: Array<Named | null | undefined>): Set<string> {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (!person) continue;
    counts.set(person.name, (counts.get(person.name) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}
