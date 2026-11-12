import Crown from "@/ui/Crown";

export default function AdminBadge() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-tint px-2.5 text-badge font-bold text-primary-text">
      <Crown size={14} />
      관리자
    </span>
  );
}
