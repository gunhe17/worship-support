import Link from "next/link";
import { ChevronUpIcon } from "@radix-ui/react-icons";
import {
  type ProjectSortBy,
  type ProjectSortDir,
  currentSortDirFor,
  sortIconClass,
} from "./projects-list-utils";

export function ProjectsTableSortLink({
  column,
  label,
  href,
  normalizedSortBy,
  normalizedSortDir,
  nextSortDir,
}: {
  column: ProjectSortBy;
  label: string;
  href: string;
  normalizedSortBy: ProjectSortBy | undefined;
  normalizedSortDir: ProjectSortDir;
  nextSortDir: ProjectSortDir;
}) {
  const currentSortDir = currentSortDirFor(column, normalizedSortBy, normalizedSortDir);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-1 py-0.5 text-gray-700 transition-colors duration-200 hover:text-indigo-600 hover:[text-shadow:0_0_4px_rgba(79,70,229,0.2)] dark:text-gray-300 dark:hover:text-indigo-300 dark:hover:[text-shadow:0_0_4px_rgba(129,140,248,0.25)]"
      aria-label={`${label} 정렬 ${nextSortDir}`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex w-3 items-center justify-center ${
          currentSortDir !== "none"
            ? "text-indigo-600 dark:text-indigo-300"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {currentSortDir === "none" ? null : (
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
  );
}
