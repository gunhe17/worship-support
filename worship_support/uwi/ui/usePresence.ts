"use client";

import { useEffect, useRef, useState } from "react";

export default function usePresence<T>(open: boolean, content: T, duration = 200) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const last = useRef(content);
  if (open) last.current = content;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, duration);
    return () => window.clearTimeout(timer);
  }, [open, mounted, duration]);

  return { mounted, leaving, content: last.current };
}
