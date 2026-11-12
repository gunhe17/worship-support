"use client";

import { useEffect, useState } from "react";

import { cx } from "@/lib/cx";

type Item = { id: number; text: string; leaving: boolean };

let push: ((text: string) => void) | null = null;
let queued: string[] = [];

export function toast(text: string) {
  if (push) push(text);
  else queued.push(text);
}

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let next = 0;
    push = (text: string) => {
      const id = ++next;
      setItems((current) => [...current.slice(-1), { id, text, leaving: false }]);
      window.setTimeout(() => setItems((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item))), 2600);
      window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 2800);
    };
    queued.forEach((text) => push?.(text));
    queued = [];
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tab)+16px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-gutter" aria-live="polite">
      {items.map((item) => (
        <div
          key={item.id}
          className={cx("rounded-full bg-toast px-5 py-3 text-body font-medium text-white", item.leaving ? "exit-fade" : "enter-toast")}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}
