"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { on } from "@/lib/events";
import Icon from "@/ui/Icon";

export default function Bell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () =>
      api
        .notifications()
        .then((data) => setUnread(data.unread))
        .catch(() => undefined);
    void load();
    return on("notifications", load);
  }, []);

  return (
    <Link href="/notifications" aria-label={unread ? `알림 ${unread}개 안 읽음` : "알림"} className="press relative -mr-2 inline-flex size-11 items-center justify-center">
      <Icon name="bell" size={26} />
      {unread ? (
        <span className="absolute top-0 right-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-badge font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
