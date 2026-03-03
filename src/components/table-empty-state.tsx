import { FileTextIcon } from "@radix-ui/react-icons";

export function TableEmptyState({
  message = "조회할 데이터가 없습니다.",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-md px-2 py-6 text-gray-400 dark:text-gray-500">
      <FileTextIcon className="h-5 w-5" aria-hidden="true" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
