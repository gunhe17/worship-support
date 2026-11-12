import { cx } from "@/lib/cx";

export default function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-surface bg-surface p-5", className)}>{children}</div>;
}
