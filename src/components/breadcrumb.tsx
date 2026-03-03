import { ChevronRightIcon } from "@radix-ui/react-icons";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-x-1 text-sm/6">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-x-1">
              {index > 0 && (
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
              )}
              {isLast || !item.href ? (
                <span
                  className={
                    isLast
                      ? "font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-500 dark:text-gray-400"
                  }
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
