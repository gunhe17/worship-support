import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons";
import { AppTopBar, TableEmptyState } from "@/components";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditForm } from "../../projects/[id]/project-edit-form";
import { TemplateCreateTrigger } from "./template-create-trigger";

const PAGE_SIZE = 10;

type SortBy = "name" | "type" | "created_at" | "updated_at";
type SortDir = "asc" | "desc" | "none";

function isValidSortBy(value: string | undefined): value is SortBy {
  return value === "name" || value === "type" || value === "created_at" || value === "updated_at";
}

function isValidSortDir(value: string | undefined): value is SortDir {
  return value === "asc" || value === "desc" || value === "none";
}

function currentSortDirFor(
  column: SortBy,
  normalizedSortBy: SortBy | undefined,
  normalizedSortDir: SortDir
): SortDir {
  if (normalizedSortBy !== column) return "none";
  return normalizedSortDir;
}

function nextSortDirFor(
  column: SortBy,
  normalizedSortBy: SortBy | undefined,
  normalizedSortDir: SortDir
): SortDir {
  const current = currentSortDirFor(column, normalizedSortBy, normalizedSortDir);
  if (current === "none") return "asc";
  if (current === "asc") return "desc";
  return "none";
}

function sortIconClass(
  column: SortBy,
  normalizedSortBy: SortBy | undefined,
  normalizedSortDir: SortDir
) {
  const current = currentSortDirFor(column, normalizedSortBy, normalizedSortDir);
  if (current === "asc") return "opacity-100 translate-y-0 rotate-0";
  if (current === "desc") return "opacity-100 translate-y-0 rotate-180";
  return "opacity-100 translate-y-0 rotate-0";
}

function getVisiblePages(total: number, current: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) {
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; sortBy?: string; sortDir?: string }>;
}) {
  const { id } = await params;
  const { page, sortBy, sortDir } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const normalizedSortBy = isValidSortBy(sortBy) ? sortBy : undefined;
  const normalizedSortDir: SortDir = isValidSortDir(sortDir) ? sortDir : "none";

  function createSortHref(nextSortBy: SortBy, nextSortDir: SortDir) {
    const paramsValue = new URLSearchParams({
      ...(nextSortDir !== "none" ? { sortBy: nextSortBy, sortDir: nextSortDir } : {}),
    });
    return `/project/${id}${paramsValue.toString() ? `?${paramsValue.toString()}` : ""}`;
  }

  function createPageHref(nextPage: number) {
    const paramsValue = new URLSearchParams({
      ...(normalizedSortBy && normalizedSortDir !== "none"
        ? { sortBy: normalizedSortBy, sortDir: normalizedSortDir }
        : {}),
      page: String(nextPage),
    });
    return `/project/${id}?${paramsValue.toString()}`;
  }

  const supabase = await createClient();
  const [{ data: project }, templatesResult] = await Promise.all([
    supabase
      .from("project")
      .select("id, name, created_at, updated_at")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    (async () => {
      let query = supabase
        .from("template")
        .select("id, name, type, created_at, updated_at", { count: "exact" })
        .eq("project_id", id)
        .is("deleted_at", null);

      if (normalizedSortBy && normalizedSortDir !== "none") {
        query = query.order(normalizedSortBy, { ascending: normalizedSortDir === "asc" });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      return query.range(offset, offset + PAGE_SIZE - 1);
    })(),
  ]);

  if (!project) {
    notFound();
  }

  const { data: templates, count } = templatesResult;
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const visiblePages = getVisiblePages(totalPages, currentPage);
  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + PAGE_SIZE, totalCount);

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
          <ProjectEditForm
            project={{
              id: project.id,
              name: project.name,
              createdAt: project.created_at,
              updatedAt: project.updated_at,
            }}
          />

          <div className="pb-10">
            <div className="flex items-start justify-between px-6 py-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Templates</h2>
                <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
                  프로젝트 템플릿 목록을 확인하고 에디터로 이동하세요.
                </p>
              </div>
              <TemplateCreateTrigger projectId={project.id} />
            </div>

            <div className="min-h-[260px]">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                      {(["name", "type", "created_at", "updated_at"] as const).map((column) => (
                        <th key={column} className="px-6 py-3">
                          <Link
                            href={createSortHref(
                              column,
                              nextSortDirFor(column, normalizedSortBy, normalizedSortDir)
                            )}
                            className="inline-flex items-center gap-1.5 px-1 py-0.5 text-gray-700 transition-colors duration-200 hover:text-indigo-600 hover:[text-shadow:0_0_4px_rgba(79,70,229,0.2)] dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:[text-shadow:0_0_4px_rgba(129,140,248,0.25)]"
                          >
                            <span>
                              {column === "name"
                                ? "Name"
                                : column === "type"
                                  ? "Type"
                                  : column === "created_at"
                                    ? "Created"
                                    : "Updated"}
                            </span>
                            <span
                              className={`inline-flex w-3 items-center justify-center ${
                                currentSortDirFor(column, normalizedSortBy, normalizedSortDir) !==
                                "none"
                                  ? "text-indigo-600 dark:text-indigo-300"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {currentSortDirFor(column, normalizedSortBy, normalizedSortDir) ===
                              "none" ? null : (
                                <ChevronUpIcon
                                  className={`size-3 transform transition-all duration-200 ease-out ${sortIconClass(
                                    column,
                                    normalizedSortBy,
                                    normalizedSortDir
                                  )}`}
                                />
                              )}
                            </span>
                          </Link>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {(templates?.length ?? 0) > 0 ? (
                      (templates ?? []).map((template) => (
                        <tr key={template.id} className="text-sm">
                          <td className="px-6 py-3 font-semibold text-gray-900 dark:text-gray-100">
                            {template.name}
                          </td>
                          <td className="px-6 py-3 text-gray-500 dark:text-gray-400">{template.type}</td>
                          <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                            {new Date(template.created_at).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                            {new Date(template.updated_at).toLocaleDateString("ko-KR")}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <Link
                              href={`/project/${id}/template/${template.id}/editor`}
                              aria-label={`${template.name} 편집기로 이동`}
                              className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-200 dark:hover:bg-gray-800/60 dark:hover:text-indigo-300"
                            >
                              <ArrowRightIcon className="size-4" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-6">
                          <TableEmptyState message="템플릿이 없습니다." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <p className="text-sm/6 text-gray-500 dark:text-gray-400">
                  Showing {rangeStart} to {rangeEnd} of {totalCount} results
                </p>
                <nav className="inline-flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                  {currentPage > 1 ? (
                    <Link
                      href={createPageHref(currentPage - 1)}
                      aria-label="이전 페이지"
                      className="inline-flex h-8 min-w-8 items-center justify-center text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex h-8 min-w-8 items-center justify-center text-gray-300 dark:text-gray-700">
                      <ChevronLeftIcon className="size-4" />
                    </span>
                  )}
                  {visiblePages.map((value, index) =>
                    value === "ellipsis" ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="inline-flex h-8 min-w-8 items-center justify-center border-l border-gray-200 text-sm font-medium text-gray-400 dark:border-gray-700 dark:text-gray-500"
                      >
                        …
                      </span>
                    ) : value === currentPage ? (
                      <span
                        key={value}
                        className="inline-flex h-8 min-w-8 items-center justify-center border-l border-gray-200 bg-indigo-500 px-2 text-sm font-semibold text-white dark:border-gray-700"
                      >
                        {value}
                      </span>
                    ) : (
                      <Link
                        key={value}
                        href={createPageHref(Number(value))}
                        className="inline-flex h-8 min-w-8 items-center justify-center border-l border-gray-200 px-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
                      >
                        {value}
                      </Link>
                    )
                  )}
                  {currentPage < totalPages ? (
                    <Link
                      href={createPageHref(currentPage + 1)}
                      aria-label="다음 페이지"
                      className="inline-flex h-8 min-w-8 items-center justify-center border-l border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-200"
                    >
                      <ChevronRightIcon className="size-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex h-8 min-w-8 items-center justify-center border-l border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-700">
                      <ChevronRightIcon className="size-4" />
                    </span>
                  )}
                </nav>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
