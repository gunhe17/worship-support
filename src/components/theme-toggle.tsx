"use client";

import { useSyncExternalStore, useState } from "react";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  if (!hydrated) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-gray-200 p-2.5 shadow-lg transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
    >
      {isDark ? (
        <SunIcon aria-hidden="true" className="h-5 w-5 text-yellow-400" />
      ) : (
        <MoonIcon aria-hidden="true" className="h-5 w-5 text-gray-700" />
      )}
    </button>
  );
}
