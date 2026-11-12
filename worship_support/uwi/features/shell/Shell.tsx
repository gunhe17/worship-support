"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import Switcher from "@/features/shell/Switcher";
import TabBar from "@/ui/TabBar";

const bare = ["/login", "/new-space", "/join", "/friend-link", "/design-check"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "/";
  const router = useRouter();
  const tabbed = !bare.some((prefix) => path.startsWith(prefix));

  useEffect(() => {
    const handler = () => {
      if (window.location.pathname.startsWith("/login")) return;
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?next=${next}`);
    };
    window.addEventListener("worship:auth", handler);
    return () => window.removeEventListener("worship:auth", handler);
  }, [router]);

  return (
    <div className="mx-auto min-h-dvh max-w-[480px] bg-page">
      <div className={tabbed ? "pb-[calc(var(--spacing-tab)+env(safe-area-inset-bottom))]" : ""}>{children}</div>
      {tabbed ? <TabBar /> : null}
      <Switcher />
    </div>
  );
}
