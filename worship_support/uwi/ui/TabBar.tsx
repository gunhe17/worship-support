"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/lib/cx";
import Icon from "@/ui/Icon";

const tabs = [
  { href: "/", label: "홈", icon: "home", match: (path: string) => path === "/" || path.startsWith("/notifications") },
  { href: "/space", label: "공간", icon: "spaces", match: (path: string) => path.startsWith("/space") || path.startsWith("/new-space") },
  { href: "/friends", label: "친구", icon: "people", match: (path: string) => path.startsWith("/friends") },
  { href: "/me", label: "내 정보", icon: "person", match: (path: string) => path.startsWith("/me") },
];

export default function TabBar() {
  const path = usePathname() ?? "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-page pb-[env(safe-area-inset-bottom)]" aria-label="주요 메뉴">
      <div className="mx-auto grid h-tab max-w-[480px] grid-cols-4">
        {tabs.map((tab) => {
          const active = tab.match(path);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cx("press flex flex-col items-center justify-center gap-0.5 text-badge", active ? "font-bold text-ink" : "font-medium text-sub")}
            >
              <Icon name={tab.icon} size={26} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
