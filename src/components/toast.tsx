"use client";

import { useEffect } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";

export function Toast({
  open,
  message,
  onClose,
  variant = "success",
  duration = 2200,
}: {
  open: boolean;
  message: string | null;
  onClose: () => void;
  variant?: "success" | "error";
  duration?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const timeoutId = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeoutId);
  }, [duration, onClose, open]);

  if (!open || !message) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[100]">
      <div className="inline-flex min-w-[220px] max-w-sm items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-lg dark:border-gray-700 dark:bg-white dark:text-gray-900">
        <span
          className={`inline-block size-2 shrink-0 rounded-full ${
            variant === "success" ? "bg-green-500" : "bg-red-500"
          }`}
          aria-hidden="true"
        />
        <p className="flex-1">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="토스트 닫기"
        >
          <Cross2Icon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
