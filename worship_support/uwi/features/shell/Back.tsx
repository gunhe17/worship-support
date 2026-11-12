"use client";

import { useRouter } from "next/navigation";

import Icon from "@/ui/Icon";

export default function Back() {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="뒤로"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="press -ml-3 inline-flex size-11 shrink-0 items-center justify-center"
    >
      <Icon name="chevronLeft" size={26} />
    </button>
  );
}
