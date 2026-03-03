interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="grid min-h-64 place-items-center px-6 py-24 sm:py-32 lg:px-8">
      <div className="text-center">
        {icon && <div className="flex justify-center text-indigo-600 dark:text-gray-300">{icon}</div>}
        <h3 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        {description && (
          <p className="mt-2 text-sm/6 text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        {actions && (
          <div className="mt-6 flex items-center justify-center gap-x-4">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
