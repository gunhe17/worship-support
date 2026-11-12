"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { say } from "@/lib/messages";
import { cx } from "@/lib/cx";
import Button from "@/ui/Button";
import useEscape from "@/ui/useEscape";
import usePresence from "@/ui/usePresence";

export type Confirm = {
  title: string;
  detail?: string;
  action: string;
  danger?: boolean;
  run: () => Promise<void>;
};

export default function Popup({ confirm, onClose }: { confirm: Confirm | null; onClose: () => void }) {
  const { mounted, leaving, content } = usePresence(confirm !== null, confirm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscape(confirm !== null && !busy, onClose);
  if (!mounted || !content || typeof document === "undefined") return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await content.run();
      onClose();
    } catch (failure) {
      setError(say(failure));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-gutter" role="alertdialog" aria-modal="true" aria-label={content.title}>
      <div className={cx("absolute inset-0 bg-scrim", leaving ? "exit-fade" : "enter-fade")} onClick={busy ? undefined : onClose} />
      <div className={cx("relative w-full max-w-[360px] rounded-popup bg-page p-6", leaving ? "exit-pop" : "enter-pop")}>
        <h2 className="text-group font-bold">{content.title}</h2>
        {content.detail ? <p className="mt-2 text-detail text-sub">{content.detail}</p> : null}
        {error ? <p className="mt-3 text-body text-danger">{error}</p> : null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button tone="line" size="sheet" full onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button tone={content.danger ? "danger" : "fill"} size="sheet" full onClick={run} busy={busy}>
            {content.action}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
