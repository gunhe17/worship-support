interface StackedListItem {
  id: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
}

interface StackedListProps {
  items: StackedListItem[];
}

export function StackedList({ items }: StackedListProps) {
  return (
    <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-800">
      {items.map((item) => {
        const content = (
          <div className="flex min-w-0 items-center gap-x-4">
            {item.leading}
            <div className="min-w-0 flex-auto">
              <p className="text-sm/6 font-semibold text-gray-900 dark:text-gray-100">
                {item.primary}
              </p>
              {item.secondary && (
                <p className="mt-1 truncate text-xs/5 text-gray-500 dark:text-gray-400">
                  {item.secondary}
                </p>
              )}
            </div>
          </div>
        );

        return (
          <li key={item.id} className="flex items-center justify-between gap-x-6 py-5">
            {item.href ? (
              <a href={item.href} className="min-w-0 flex-auto">
                {content}
              </a>
            ) : (
              <div className="min-w-0 flex-auto">{content}</div>
            )}
            {item.trailing && (
              <div className="hidden shrink-0 sm:flex sm:items-center sm:gap-x-4">
                {item.trailing}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
