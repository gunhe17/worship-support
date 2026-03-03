import type { InputHTMLAttributes } from "react";
import { FileIcon } from "@radix-ui/react-icons";

interface FileUploadProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
}

export function FileUpload({
  label = "파일 업로드",
  description = "PNG, JPG, GIF (최대 10MB)",
  id = "file-upload",
  ...props
}: FileUploadProps) {
  return (
    <div className="flex justify-center rounded-lg border border-dashed border-gray-300 px-6 py-10 dark:border-gray-600">
      <div className="text-center">
        <FileIcon
          aria-hidden="true"
          className="mx-auto size-12 text-gray-300 dark:text-gray-500"
        />
        <div className="mt-4 flex text-sm/6 text-gray-600 dark:text-gray-400">
          <label
            htmlFor={id}
            className="relative cursor-pointer rounded-md font-semibold text-indigo-600 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-indigo-600 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <span>{label}</span>
            <input id={id} type="file" className="sr-only" {...props} />
          </label>
          <p className="pl-1">또는 드래그 앤 드롭</p>
        </div>
        <p className="text-xs/5 text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
}
