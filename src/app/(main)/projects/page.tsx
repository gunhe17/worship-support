import Link from "next/link";
import { AppTopBar } from "@/components";
import { createClient } from "@/lib/supabase/server";
import { restoreProject } from "./actions";
import { CreateProjectModal } from "./create-project-modal";
import {
  type ProjectSortBy,
  type ProjectSortDir,
  isValidProjectSortBy,
  isValidProjectSortDir,
} from "./projects-list-utils";
import { ProjectsTable } from "./projects-table";
import { ProjectsTablePagination } from "./projects-table-pagination";

const PAGE_SIZE = 10;

type ProjectsPageSearchParams = {
  q?: string;
  page?: string;
  view?: string;
  sortBy?: string;
  sortDir?: string;
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<ProjectsPageSearchParams>;
}) {
  const { q, page, view, sortBy, sortDir } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const isTrashView = view === "trash";
  const normalizedSortBy = isValidProjectSortBy(sortBy) ? sortBy : undefined;
  const normalizedSortDir: ProjectSortDir = isValidProjectSortDir(sortDir) ? sortDir : "none";

  async function restoreProjectAction(formData: FormData) {
    "use server";
    await restoreProject({ error: null, success: null }, formData);
  }

  function createSortHref(nextSortBy: ProjectSortBy, nextSortDir: ProjectSortDir) {
    const params = new URLSearchParams({
      ...(q?.trim() ? { q: q.trim() } : {}),
      ...(isTrashView ? { view: "trash" } : {}),
      ...(nextSortDir !== "none" ? { sortBy: nextSortBy, sortDir: nextSortDir } : {}),
    });

    return `/projects${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function createPageHref(nextPage: number) {
    const params = new URLSearchParams({
      ...(q?.trim() ? { q: q.trim() } : {}),
      ...(isTrashView ? { view: "trash" } : {}),
      ...(normalizedSortBy && normalizedSortDir !== "none"
        ? { sortBy: normalizedSortBy, sortDir: normalizedSortDir }
        : {}),
      page: String(nextPage),
    });

    return `/projects?${params.toString()}`;
  }

  const supabase = await createClient();
  let query = supabase
    .from("project")
    .select("id, name, created_at, updated_at, deleted_at", { count: "exact" });

  query = isTrashView ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);

  if (q && q.trim()) {
    query = query.ilike("name", `%${q.trim()}%`);
  }

  if (normalizedSortBy && normalizedSortDir !== "none") {
    query =
      normalizedSortBy === "status"
        ? query.order("deleted_at", { ascending: normalizedSortDir === "asc" })
        : query.order(normalizedSortBy, { ascending: normalizedSortDir === "asc" });
  } else {
    query = isTrashView
      ? query.order("deleted_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  }

  const { data: projects, count } = await query.range(offset, offset + PAGE_SIZE - 1);

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, totalCount);
  const emptyMessage = q
    ? "검색 결과가 없습니다."
    : isTrashView
      ? "삭제된 프로젝트가 없습니다."
      : "프로젝트가 없습니다.";

  return (
    <section className="mx-auto max-w-5xl">
      <AppTopBar
        leftSlot={
          <Link
            href="/home"
            className="inline-flex items-center px-3 py-1.5 text-base font-semibold text-gray-800 dark:text-gray-100"
          >
            Worship Support
          </Link>
        }
      />

      <div className="mt-14">
        <div className="bg-white dark:bg-gray-950/90">
          <div className="flex items-start justify-between px-6 py-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isTrashView ? "Deleted Projects" : "Projects"}
              </h2>
              <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
                {isTrashView
                  ? "삭제된 프로젝트를 확인하고 필요 시 복구하세요."
                  : "프로젝트 목록에서 상세 페이지로 이동해 관리하세요."}
              </p>
            </div>
            <div className="flex items-center gap-2">{!isTrashView && <CreateProjectModal />}</div>
          </div>

          <ProjectsTable
            projects={projects ?? []}
            isTrashView={isTrashView}
            normalizedSortBy={normalizedSortBy}
            normalizedSortDir={normalizedSortDir}
            createSortHref={createSortHref}
            restoreProjectAction={restoreProjectAction}
            emptyMessage={emptyMessage}
          />

          <ProjectsTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            createPageHref={createPageHref}
          />
        </div>
      </div>
    </section>
  );
}
