import Link from "next/link";
import { TableEmptyState } from "@/components";
import { ArrowRightIcon, FileTextIcon } from "@radix-ui/react-icons";

interface ProjectItem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface HomeProjectListProps {
  projects: ProjectItem[];
}

export function HomeProjectList({ projects }: HomeProjectListProps) {
  return (
    <section className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-1.5 py-1 text-base/6 font-medium text-gray-600 dark:text-gray-300">
          <FileTextIcon className="size-5 text-gray-500 dark:text-gray-400" />
          <span>프로젝트</span>
        </div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm/5 font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
        >
          전체보기
          <ArrowRightIcon className="size-[18px]" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950/90">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <tr key={project.id} className="text-sm">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-gray-100">{project.name}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(project.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/project/${project.id}`}
                        aria-label={`${project.name} 상세로 이동`}
                        className="inline-flex items-center justify-center rounded-full p-0.5 text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-indigo-600 dark:text-gray-200 dark:hover:bg-gray-800/60 dark:hover:text-indigo-300"
                      >
                        <ArrowRightIcon className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-6">
                    <TableEmptyState message="프로젝트가 없습니다." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
