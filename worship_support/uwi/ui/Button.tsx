"use client";

import { cx } from "@/lib/cx";

type Tone = "fill" | "line" | "text" | "quiet" | "danger";
type Size = "row" | "screen" | "sheet";

const sizes: Record<Size, string> = {
  row: "h-button-row px-4 text-body",
  screen: "h-button px-5 text-body",
  sheet: "h-button-sheet px-6 text-name",
};

const tones: Record<Tone, string> = {
  fill: "bg-primary text-white font-semibold",
  line: "bg-page text-ink border border-line font-semibold",
  text: "bg-transparent text-primary-text font-semibold px-1",
  quiet: "bg-transparent text-sub underline underline-offset-4 px-0",
  danger: "bg-danger text-white font-semibold",
};

export default function Button({
  tone = "line",
  size = "screen",
  full,
  disabled,
  busy,
  onClick,
  children,
  type = "button",
  label,
  className,
}: {
  tone?: Tone;
  size?: Size;
  full?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  type?: "button" | "submit";
  label?: string;
  className?: string;
}) {
  const off = disabled || busy;
  return (
    <button
      type={type}
      aria-label={label}
      disabled={off}
      onClick={onClick}
      className={cx(
        "press inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-opacity duration-150",
        tone === "text" || tone === "quiet" ? "min-h-11 text-body" : sizes[size],
        off && (tone === "fill" || tone === "danger") ? "bg-disabled text-faint font-semibold" : tones[tone],
        off && tone !== "fill" && tone !== "danger" && "opacity-60",
        full && "w-full",
        className,
      )}
    >
      {children}
    </button>
  );
}
