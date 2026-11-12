"use client";

import Icon from "@/ui/Icon";

export default function Notice({
  icon,
  count,
  title,
  action,
  onAction,
  onClose,
}: {
  icon: string;
  count?: number;
  title: string;
  action: string;
  onAction: () => void;
  onClose: () => void;
}) {
  return (
    <div className="enter-fade flex items-center gap-4 rounded-surface border border-line bg-page px-4 py-4">
      <span className="relative inline-flex size-icon shrink-0 items-center justify-center rounded-full bg-surface text-faint">
        <Icon name={icon} />
        {count ? (
          <span className="absolute -top-1 -right-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-badge font-bold text-white">
            {count}
          </span>
        ) : null}
      </span>
      <button type="button" onClick={onAction} className="press min-w-0 flex-1 text-left">
        <span className="block truncate text-group font-bold">{title}</span>
        <span className="block text-detail text-sub">{action} ›</span>
      </button>
      <button type="button" onClick={onClose} aria-label="닫기" className="press -mr-2 inline-flex size-11 items-center justify-center text-faint">
        <Icon name="close" size={22} />
      </button>
    </div>
  );
}
