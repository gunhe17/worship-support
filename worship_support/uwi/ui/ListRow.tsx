"use client";

import Link from "next/link";

import { cx } from "@/lib/cx";
import Icon from "@/ui/Icon";

export default function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2 text-name font-semibold">{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-detail text-sub">{subtitle}</span> : null}
      </span>
      {trailing}
      {href ? <Icon name="chevronRight" size={22} className="shrink-0 text-faint" /> : null}
    </>
  );
  const base = cx("flex min-h-row w-full items-center gap-4 py-2 text-left", className);
  if (href) {
    return (
      <Link href={href} className={cx(base, "press")}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cx(base, "press")}>
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

export function Name({ name, email, duplicate }: { name: string; email?: string | null; duplicate?: boolean }) {
  return (
    <>
      <span className="truncate">{name}</span>
      {duplicate && email ? <span className="min-w-0 truncate text-detail font-normal text-sub">{email}</span> : null}
    </>
  );
}
