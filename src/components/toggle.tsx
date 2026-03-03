"use client";

import { Switch } from "@headlessui/react";

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ enabled, onChange, label, description }: ToggleProps) {
  return (
    <Switch.Group as="div" className="flex items-center justify-between">
      {(label || description) && (
        <span className="flex grow flex-col">
          {label && (
            <Switch.Label as="span" className="text-sm/6 font-medium text-gray-900 dark:text-gray-100" passive>
              {label}
            </Switch.Label>
          )}
          {description && (
            <Switch.Description as="span" className="text-sm/6 text-gray-500 dark:text-gray-400">
              {description}
            </Switch.Description>
          )}
        </span>
      )}
      <Switch
        checked={enabled}
        onChange={onChange}
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 data-[checked]:bg-indigo-600 dark:bg-gray-800/70 dark:focus-visible:ring-gray-400 dark:focus-visible:ring-offset-gray-900 dark:data-[checked]:bg-gray-600"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-data-[checked]:trangray-x-5"
        />
      </Switch>
    </Switch.Group>
  );
}
