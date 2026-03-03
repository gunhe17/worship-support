interface DescriptionItem {
  term: string;
  detail: React.ReactNode;
}

interface DescriptionListProps {
  items: DescriptionItem[];
}

export function DescriptionList({ items }: DescriptionListProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <dl className="divide-y divide-gray-200 dark:divide-gray-700">
        {items.map((item) => (
          <div key={item.term} className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
            <dt className="text-sm/6 font-medium text-gray-900 dark:text-gray-100">
              {item.term}
            </dt>
            <dd className="mt-1 text-sm/6 text-gray-700 dark:text-gray-400 sm:col-span-2 sm:mt-0">
              {item.detail}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
