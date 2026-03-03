"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  pendingText: string;
  children: React.ReactNode;
}

export function SubmitButton({ pendingText, children }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full justify-center rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus-visible:outline-gray-400 disabled:opacity-50"
    >
      {pending ? pendingText : children}
    </button>
  );
}
