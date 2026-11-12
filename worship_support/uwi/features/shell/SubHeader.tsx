"use client";

import { useRouter } from "next/navigation";

import Icon from "@/ui/Icon";

export default function SubHeader({ title, description, back = "/" }: { title: string; description?: React.ReactNode; back?: string }) {
  const router = useRouter();
  return (
    <header className="px-gutter pt-3">
      <button
        type="button"
        aria-label="뒤로"
        onClick={() => (window.history.length > 1 ? router.back() : router.push(back))}
        className="press -ml-3 inline-flex size-11 items-center justify-center"
      >
        <Icon name="chevronLeft" size={26} />
      </button>
      <h1 className="mt-4 text-title font-bold">{title}</h1>
      {description ? <p className="mt-1 text-detail text-sub">{description}</p> : null}
    </header>
  );
}
