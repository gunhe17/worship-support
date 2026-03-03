type Status = "online" | "offline" | "away";

interface StatusIndicatorProps {
  status: Status;
  label?: string;
}

const dotStyles: Record<Status, { outer: string; inner: string }> = {
  online: {
    outer: "bg-emerald-500/30",
    inner: "bg-emerald-500",
  },
  offline: {
    outer: "bg-gray-500/30",
    inner: "bg-gray-500",
  },
  away: {
    outer: "bg-yellow-500/30",
    inner: "bg-yellow-500",
  },
};

export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const { outer, inner } = dotStyles[status];
  return (
    <div className="flex items-center gap-x-1.5">
      <div className={`flex-none rounded-full p-1 ${outer}`}>
        <div className={`size-1.5 rounded-full ${inner}`} />
      </div>
      {label && (
        <p className="text-xs/5 text-gray-500 dark:text-gray-400">{label}</p>
      )}
    </div>
  );
}
