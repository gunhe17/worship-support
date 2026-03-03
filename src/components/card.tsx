interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <div>
        {title && (
          <h3 className="text-base/7 font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        )}
        {description && (
          <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-x-3">{actions}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function CardBody({ children, noPadding }: CardBodyProps) {
  return <div className={noPadding ? "" : "px-6 py-4"}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
}

export function CardFooter({ children }: CardFooterProps) {
  return (
    <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
      {children}
    </div>
  );
}
