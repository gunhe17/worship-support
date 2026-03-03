import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { getVisiblePages } from "./projects-list-utils";

export function ProjectsTablePagination({
  currentPage,
  totalPages,
  totalCount,
  rangeStart,
  rangeEnd,
  createPageHref,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  createPageHref: (nextPage: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(totalPages, currentPage);

  return (
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
  );
}
