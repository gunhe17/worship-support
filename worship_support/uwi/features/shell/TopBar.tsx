import Back from "@/features/shell/Back";
import Bell from "@/features/shell/Bell";

export default function TopBar({ title, logo, extra }: { title?: string; logo?: boolean; extra?: React.ReactNode }) {
  return (
    <header className="flex h-16 items-center justify-between px-gutter pt-2">
      {logo ? (
        <span className="text-home-title font-extrabold tracking-tight">Worship</span>
      ) : (
        <span className="flex min-w-0 items-center gap-1">
          <Back />
          <h1 className="truncate text-home-title font-extrabold">{title}</h1>
        </span>
      )}
      <span className="flex items-center gap-2">
        {extra}
        <Bell />
      </span>
    </header>
  );
}
