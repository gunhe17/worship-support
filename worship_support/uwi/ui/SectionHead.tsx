import { cx } from "@/lib/cx";

export default function SectionHead({
  title,
  count,
  large,
  trailing,
  className,
}: {
  title: string;
  count?: number;
  large?: boolean;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center justify-between gap-3", className)}>
      <h2 className={large ? "text-group font-bold" : "text-head font-semibold text-sub"}>
        {title}
        {count !== undefined ? <span className={cx("ml-1.5", large ? "font-medium text-sub" : "")}>{count}</span> : null}
      </h2>
      {trailing}
    </div>
  );
}
