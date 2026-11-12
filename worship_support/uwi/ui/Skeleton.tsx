import { cx } from "@/lib/cx";

export default function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("skeleton block rounded-full", className)} />;
}

export function RowSkeleton({ rows = 3, square }: { rows?: number; square?: boolean }) {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex min-h-row items-center gap-4 py-2">
          <span className={cx("skeleton block size-icon shrink-0", square ? "rounded-space" : "rounded-full")} />
          <span className="flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3.5 w-44" />
          </span>
        </div>
      ))}
    </div>
  );
}
