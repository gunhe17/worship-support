import type { InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function FormInput({ label, id, ...props }: FormInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
        {label}
      </label>
      <div className="mt-2">
        <input
          id={id}
          className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-gray-800/60 dark:text-gray-100 dark:outline-gray-700 dark:placeholder:text-gray-500 dark:focus:outline-gray-400 sm:text-sm/6"
          {...props}
        />
      </div>
    </div>
  );
}
