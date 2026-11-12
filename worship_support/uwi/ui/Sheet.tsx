"use client";

import { createPortal } from "react-dom";

import { cx } from "@/lib/cx";
import Icon from "@/ui/Icon";
import useEscape from "@/ui/useEscape";
import usePresence from "@/ui/usePresence";

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  stickyFooter,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  stickyFooter?: boolean;
}) {
  const { mounted, leaving } = usePresence(open, null);
  useEscape(open, onClose);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="닫기"
        tabIndex={-1}
        onClick={onClose}
        className={cx("absolute inset-0 bg-scrim", leaving ? "exit-fade" : "enter-fade")}
      />
      <div
        className={cx(
          "relative flex max-h-[92dvh] w-full max-w-[480px] flex-col rounded-t-sheet bg-page",
          leaving ? "exit-rise" : "enter-rise",
        )}
      >
        <div className="flex items-start gap-3 px-gutter pt-6 pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-title font-bold">{title}</h2>
            {description ? <p className="mt-1 text-detail text-sub">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="press -mr-2 inline-flex size-11 items-center justify-center">
            <Icon name="close" size={26} />
          </button>
        </div>
        <div className={cx("min-h-0 px-gutter", stickyFooter ? "flex-1 overflow-y-auto" : "overflow-y-auto")}>
          {children}
          {footer && !stickyFooter ? <div className="pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">{footer}</div> : null}
          {!footer ? <div className="h-[max(20px,env(safe-area-inset-bottom))]" /> : null}
        </div>
        {footer && stickyFooter ? (
          <div className="border-t border-line px-gutter pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function SheetActions({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[1fr_2fr] gap-3">{children}</div>;
}
