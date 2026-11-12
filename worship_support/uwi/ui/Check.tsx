import { cx } from "@/lib/cx";
import Icon from "@/ui/Icon";

export default function Check({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-150",
        checked ? "border-ink bg-ink text-white" : "border-faint bg-page text-transparent",
      )}
    >
      <Icon name="check" size={18} />
    </span>
  );
}
