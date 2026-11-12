import { cx } from "@/lib/cx";

export default function SpaceIcon({ name, pending, size = 48 }: { name: string; pending?: boolean; size?: number }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-space bg-page text-group font-bold",
        pending ? "border border-dashed border-faint text-sub" : "border border-line text-ink",
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {Array.from(name.trim())[0] ?? ""}
    </span>
  );
}
