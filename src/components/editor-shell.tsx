interface EditorResizeHandleProps {
  ariaLabel: string;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
}

interface EditorPanelHeaderProps {
  title: string;
  trailing?: React.ReactNode;
}

interface EditorSectionBlockProps {
  title: string;
  children: React.ReactNode;
}

interface EditorLabeledFieldRowProps {
  label: string;
  required?: boolean;
  highlighted?: boolean;
  bordered?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface EditorFloatingMenuProps {
  top: number;
  left: number;
  width: number;
  menuRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children: React.ReactNode;
}

interface EditorIconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "muted";
}

interface EditorTinyOutlineButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  block?: boolean;
}

export function EditorResizeHandle({
  ariaLabel,
  onPointerDown,
}: EditorResizeHandleProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className="group relative -mx-px w-0 shrink-0 cursor-col-resize"
    >
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-indigo-400 dark:bg-white/15 dark:group-hover:bg-indigo-500" />
      <span className="absolute inset-y-0 -left-[6px] w-3" />
    </button>
  );
}

export function EditorPanelHeader({ title, trailing }: EditorPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-4">
      <p className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {trailing}
    </div>
  );
}

export function EditorSectionBlock({ title, children }: EditorSectionBlockProps) {
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{title}</p>
      {children}
    </div>
  );
}

export function EditorLabeledFieldRow({
  label,
  required = false,
  highlighted = false,
  bordered = false,
  className,
  children,
}: EditorLabeledFieldRowProps) {
  const base =
    "flex h-7 items-center gap-3 rounded-md px-2 transition-colors hover:bg-gray-100 focus-within:bg-gray-100 dark:hover:bg-white/10 dark:focus-within:bg-white/15";
  const borderClass = bordered ? "border" : "";
  const stateClass = highlighted
    ? "border-red-300 bg-red-50/40 dark:border-red-400/60 dark:bg-red-500/10"
    : bordered
      ? "border-transparent"
      : "";

  return (
    <label className={[base, borderClass, stateClass, className].filter(Boolean).join(" ")}>
      <span className="block w-12 shrink-0 truncate text-[10px] text-gray-500 dark:text-gray-400">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

export function EditorFloatingMenu({
  top,
  left,
  width,
  menuRef,
  className,
  children,
}: EditorFloatingMenuProps) {
  return (
    <div
      ref={menuRef}
      className={[
        "fixed z-40 overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-gray-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ top, left, width }}
    >
      {children}
    </div>
  );
}

export const EditorIconButton = forwardRef<HTMLButtonElement, EditorIconButtonProps>(
  function EditorIconButton({ className, tone = "default", ...props }, ref) {
    const toneClass =
      tone === "muted"
        ? "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200";

    return (
      <button
        ref={ref}
        className={[
          "inline-flex h-5 w-5 items-center justify-center rounded",
          toneClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  }
);

export const EditorTinyOutlineButton = forwardRef<
  HTMLButtonElement,
  EditorTinyOutlineButtonProps
>(function EditorTinyOutlineButton({ className, block = false, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={[
        block ? "h-7 w-full" : "h-7 shrink-0",
        "rounded border border-gray-200 px-2 text-[10px] font-medium text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
import { forwardRef } from "react";
