import type { TextareaHTMLAttributes } from "react";

interface FormTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  description?: string;
}

export function FormTextarea({ label, description, id, ...props }: FormTextareaProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
        {label}
      </label>
      <div className="mt-2">
        <textarea
          id={id}
          className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-gray-800/60 dark:text-gray-100 dark:outline-gray-700 dark:placeholder:text-gray-500 dark:focus:outline-gray-400 sm:text-sm/6"
          {...props}
        />
      </div>
      {description && (
        <p className="mt-3 text-sm/6 text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
}
