"use client";

import { Avatar } from "./avatar";
import { Dropdown } from "./dropdown";

interface AppTopBarProps {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function AppTopBar({ leftSlot, rightSlot }: AppTopBarProps) {
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center justify-between pt-1">
      <div>{leftSlot}</div>
      <div className="flex items-center gap-3 shrink-0">
        {rightSlot}
        <Dropdown
          align="right"
          trigger={
            <button
              type="button"
              className="inline-flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-100/90 dark:hover:text-gray-100"
            >
              <Avatar size="md" />
              <span className="sr-only">프로필 메뉴</span>
            </button>
          }
          items={[{ label: "로그아웃", onClick: signOut }]}
        />
      </div>
    </div>
  );
}
