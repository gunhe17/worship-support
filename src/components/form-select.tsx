import type { SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  options: Array<{ value: string; label: string }>;
}

export function FormSelect({ label, options, id, ...props }: FormSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm/6 font-medium text-gray-900 dark:text-gray-100">
        {label}
      </label>
      <div className="mt-2 grid grid-cols-1">
        <select
          id={id}
          className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-gray-800/60 dark:text-gray-100 dark:outline-gray-700 dark:*:bg-gray-800 dark:focus:outline-gray-400 sm:text-sm/6"
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 dark:text-gray-400 sm:size-4"
        />
      </div>
    </div>
  );
}
