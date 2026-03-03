interface PageHeaderProps {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, meta, actions }: PageHeaderProps) {
  return (
    <div className="lg:flex lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl/7 font-bold text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
          {title}
        </h2>
        {meta && (
          <div className="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div className="mt-5 flex gap-3 lg:mt-0 lg:ml-4">
          {actions}
        </div>
      )}
    </div>
  );
}
