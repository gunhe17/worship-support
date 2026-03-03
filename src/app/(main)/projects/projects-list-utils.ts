export type ProjectSortBy = "name" | "created_at" | "updated_at" | "status";
export type ProjectSortDir = "asc" | "desc" | "none";
export type VisiblePage = number | "ellipsis";

export function isValidProjectSortBy(value: string | undefined): value is ProjectSortBy {
  return (
    value === "name" ||
    value === "created_at" ||
    value === "updated_at" ||
    value === "status"
  );
}

export function isValidProjectSortDir(value: string | undefined): value is ProjectSortDir {
  return value === "asc" || value === "desc" || value === "none";
}

export function currentSortDirFor(
  column: ProjectSortBy,
  normalizedSortBy: ProjectSortBy | undefined,
  normalizedSortDir: ProjectSortDir
): ProjectSortDir {
  if (normalizedSortBy !== column) return "none";
  return normalizedSortDir;
}

export function nextSortDirFor(
  column: ProjectSortBy,
  normalizedSortBy: ProjectSortBy | undefined,
  normalizedSortDir: ProjectSortDir
): ProjectSortDir {
  const current = currentSortDirFor(column, normalizedSortBy, normalizedSortDir);
  if (current === "none") return "asc";
  if (current === "asc") return "desc";
  return "none";
}

export function sortIconClass(
  column: ProjectSortBy,
  normalizedSortBy: ProjectSortBy | undefined,
  normalizedSortDir: ProjectSortDir
) {
  const current = currentSortDirFor(column, normalizedSortBy, normalizedSortDir);
  if (current === "asc") {
    return "opacity-100 translate-y-0 rotate-0";
  }
  if (current === "desc") {
    return "opacity-100 translate-y-0 rotate-180";
  }
  return "opacity-100 translate-y-0 rotate-0";
}

export function getVisiblePages(total: number, current: number): VisiblePage[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) {
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}
