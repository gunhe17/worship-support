import type { InputHTMLAttributes } from "react";

interface FormRadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function FormRadio({ label, id, ...props }: FormRadioProps) {
  return (
    <div className="flex items-center gap-x-3">
      <input
        id={id}
        type="radio"
        className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-indigo-600 checked:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:border-gray-200 disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/60 dark:before:bg-gray-100 dark:checked:border-gray-500 dark:checked:bg-gray-600 dark:focus-visible:outline-gray-400 dark:disabled:border-gray-700 dark:disabled:bg-gray-800/70 dark:disabled:before:bg-gray-500/60 forced-colors:appearance-auto forced-colors:before:hidden"
        {...props}
      />
      <label htmlFor={id} className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
        {label}
      </label>
    </div>
  );
}
