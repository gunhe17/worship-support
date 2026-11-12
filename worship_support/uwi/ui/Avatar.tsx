import { cx } from "@/lib/cx";

const palette = [
  "bg-person-0-bg text-person-0-fg",
  "bg-person-1-bg text-person-1-fg",
  "bg-person-2-bg text-person-2-fg",
];

export function tone(id: string): number {
  let sum = 0;
  for (const char of id.replace(/-/g, "")) sum = (sum + parseInt(char, 16)) % 3;
  return sum;
}

export default function Avatar({ id, size = 48 }: { id: string; size?: number }) {
  return (
    <span
      className={cx("inline-flex shrink-0 items-end justify-center overflow-hidden rounded-full", palette[tone(id)])}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width={size} height={size} fill="currentColor">
        <circle cx="24" cy="19" r="8" />
        <path d="M8 48c1.5-9.5 8-14 16-14s14.5 4.5 16 14z" />
      </svg>
    </span>
  );
}
