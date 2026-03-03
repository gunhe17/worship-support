import type { InputHTMLAttributes } from "react";
import { CheckIcon, DividerHorizontalIcon } from "@radix-ui/react-icons";

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export function FormCheckbox({ label, description, id, ...props }: FormCheckboxProps) {
  const descriptionId = description && id ? `${id}-description` : undefined;

  return (
    <div className="flex gap-3">
      <div className="flex h-6 shrink-0 items-center">
        <div className="group grid size-4 grid-cols-1">
          <input
            id={id}
            type="checkbox"
            aria-describedby={descriptionId}
            className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-indigo-600 checked:bg-indigo-600 indeterminate:border-indigo-600 indeterminate:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-200 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:checked:border-gray-500 dark:checked:bg-gray-600 dark:indeterminate:border-gray-500 dark:indeterminate:bg-gray-600 dark:focus-visible:outline-gray-400 dark:disabled:border-gray-700 dark:disabled:bg-gray-800/70 forced-colors:appearance-auto"
            {...props}
          />
          <CheckIcon className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center text-white opacity-0 group-has-checked:opacity-100 group-has-disabled:text-white/25" />
          <DividerHorizontalIcon className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center text-white opacity-0 group-has-indeterminate:opacity-100 group-has-disabled:text-white/25" />
        </div>
      </div>
      <div className="text-sm/6">
        <label htmlFor={id} className="font-medium text-gray-900 dark:text-gray-100">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
