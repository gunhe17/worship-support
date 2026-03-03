interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showLogo?: boolean;
  boxed?: boolean;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  showLogo = true,
  boxed = true,
}: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col justify-center overflow-hidden bg-gray-50 px-6 py-12 dark:bg-gray-950 lg:px-8">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 hidden transform-gpu overflow-hidden blur-3xl dark:block sm:-top-80"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-gray-600 to-gray-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-288.75" />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        {showLogo && (
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-gray-200 ring-1 ring-gray-300 dark:bg-gray-800 dark:ring-gray-700">
            <span className="text-sm font-bold tracking-wide text-gray-700 dark:text-gray-100">WS</span>
          </div>
        )}
        <h2
          className={`text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-gray-100 ${
            showLogo ? "mt-8" : "mt-2"
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-center text-sm/6 text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        {boxed ? (
          <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-200 dark:bg-gray-900/70 dark:ring-gray-700 dark:backdrop-blur-sm sm:p-8">
            {children}
          </div>
        ) : (
          <div>{children}</div>
        )}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
