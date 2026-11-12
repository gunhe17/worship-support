"use client";

import { forwardRef } from "react";

import { cx } from "@/lib/cx";
import Icon from "@/ui/Icon";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  error?: string | null;
  hint?: string;
  label?: string;
  code?: boolean;
  search?: boolean;
  type?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  name?: string;
};

const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { value, onChange, placeholder, maxLength, error, hint, label, code, search, type = "text", autoFocus, onEnter, name },
  ref,
) {
  return (
    <label className="block">
      {label ? <span className="mb-2 block px-2 text-head font-semibold text-sub">{label}</span> : null}
      <span
        className={cx(
          "flex h-field items-center gap-2 rounded-full px-5 transition-colors duration-150",
          search ? "bg-surface" : "border bg-page",
          !search && (error ? "border-danger" : "border-line focus-within:border-primary"),
          code && "h-14",
        )}
      >
        {search ? <Icon name="search" size={20} className="text-faint" /> : null}
        <input
          ref={ref}
          name={name}
          value={value}
          type={type}
          autoFocus={autoFocus}
          maxLength={maxLength}
          placeholder={placeholder}
          inputMode={code ? "numeric" : undefined}
          autoComplete={code ? "one-time-code" : "off"}
          onChange={(event) => onChange(code ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && onEnter) onEnter();
          }}
          aria-invalid={error ? true : undefined}
          className={cx(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint",
            code ? "text-center text-code font-bold tracking-[0.35em]" : "text-body",
          )}
        />
      </span>
      {error ? (
        <span className="mt-2 block px-2 text-body text-danger" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-2 block px-2 text-body text-sub">{hint}</span>
      ) : null}
    </label>
  );
});

export default TextInput;
