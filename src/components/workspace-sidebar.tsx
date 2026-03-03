interface WorkspaceSidebarProps {
  width: number;
  children: React.ReactNode;
}

interface WorkspaceSidebarSectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function WorkspaceSidebar({ width, children }: WorkspaceSidebarProps) {
  return (
    <section
      className="overflow-auto border-y border-l border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900"
      style={{ width }}
    >
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

export function WorkspaceSidebarDivider() {
  return (
    <div className="my-3 px-2">
      <div className="h-px bg-gray-200 dark:bg-white/10" />
    </div>
  );
}

export function WorkspaceSidebarSection({
  title,
  action,
  children,
}: WorkspaceSidebarSectionProps) {
  return (
    <div className="px-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="select-none text-[10px] font-medium text-gray-500 dark:text-gray-400">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}
