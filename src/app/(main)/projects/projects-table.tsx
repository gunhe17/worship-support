import Link from "next/link";
import {
  ArrowRightIcon,
  RotateCounterClockwiseIcon,
} from "@radix-ui/react-icons";
import { TableEmptyState } from "@/components";
import { ProjectsTableSortLink } from "./projects-table-sort-link";
import {
  type ProjectSortBy,
  type ProjectSortDir,
  nextSortDirFor,
} from "./projects-list-utils";

type ProjectRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export function ProjectsTable({
  projects,
  isTrashView,
  normalizedSortBy,
  normalizedSortDir,
  createSortHref,
  restoreProjectAction,
  emptyMessage,
}: {
  projects: ProjectRow[];
  isTrashView: boolean;
  normalizedSortBy: ProjectSortBy | undefined;
  normalizedSortDir: ProjectSortDir;
  createSortHref: (nextSortBy: ProjectSortBy, nextSortDir: ProjectSortDir) => string;
  restoreProjectAction: (formData: FormData) => Promise<void>;
  emptyMessage?: string;
}) {
  return (
    <div className="min-h-[260px]">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
              <th className="px-6 py-3">
                <ProjectsTableSortLink
                  column="name"
                  label="Name"
                  href={createSortHref(
                    "name",
                    nextSortDirFor("name", normalizedSortBy, normalizedSortDir)
                  )}
                  normalizedSortBy={normalizedSortBy}
                  normalizedSortDir={normalizedSortDir}
                  nextSortDir={nextSortDirFor(
                    "name",
                    normalizedSortBy,
                    normalizedSortDir
                  )}
                />
              </th>
              <th className="px-6 py-3">
                <ProjectsTableSortLink
                  column="status"
                  label="Status"
                  href={createSortHref(
                    "status",
                    nextSortDirFor("status", normalizedSortBy, normalizedSortDir)
                  )}
                  normalizedSortBy={normalizedSortBy}
                  normalizedSortDir={normalizedSortDir}
                  nextSortDir={nextSortDirFor(
                    "status",
                    normalizedSortBy,
                    normalizedSortDir
                  )}
                />
              </th>
              <th className="px-6 py-3">
                <ProjectsTableSortLink
                  column="created_at"
                  label="Created"
                  href={createSortHref(
                    "created_at",
                    nextSortDirFor("created_at", normalizedSortBy, normalizedSortDir)
                  )}
                  normalizedSortBy={normalizedSortBy}
                  normalizedSortDir={normalizedSortDir}
                  nextSortDir={nextSortDirFor(
                    "created_at",
                    normalizedSortBy,
                    normalizedSortDir
                  )}
                />
              </th>
              <th className="px-6 py-3">
                <ProjectsTableSortLink
                  column="updated_at"
                  label="Updated"
                  href={createSortHref(
                    "updated_at",
                    nextSortDirFor("updated_at", normalizedSortBy, normalizedSortDir)
                  )}
                  normalizedSortBy={normalizedSortBy}
                  normalizedSortDir={normalizedSortDir}
                  nextSortDir={nextSortDirFor(
                    "updated_at",
                    normalizedSortBy,
                    normalizedSortDir
                  )}
                />
              </th>
              <th className="px-6 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {projects.length > 0 ? (
              projects.map((project) => (
                <tr key={project.id} className="text-sm">
                  <td className="px-6 py-3 font-semibold text-gray-900 dark:text-gray-100">
                    {project.name}
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                    {project.deleted_at ? "Deleted" : "Active"}
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(project.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-6 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(project.updated_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {isTrashView ? (
                      <form action={restoreProjectAction}>
                        <input type="hidden" name="id" value={project.id} />
                        <button
                          type="submit"
                          className="inline-flex size-8 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800/60"
                          aria-label={`${project.name} 복구`}
                        >
                          <RotateCounterClockwiseIcon className="size-4" />
                        </button>
                      </form>
                    ) : (
                      <Link
                        href={`/project/${project.id}`}
                        aria-label={`${project.name} 상세로 이동`}
                        className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-200 dark:hover:bg-gray-800/60 dark:hover:text-indigo-300"
                      >
                        <ArrowRightIcon className="size-4" />
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-6">
                  <TableEmptyState message={emptyMessage ?? "조회할 데이터가 없습니다."} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
