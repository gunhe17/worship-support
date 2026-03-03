import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: React.ReactNode;
};

type AsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps> & {
    href?: undefined;
  };

type AsLink = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps> & {
    href: string;
  };

export type ButtonProps = AsButton | AsLink;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus-visible:outline-gray-400",
  secondary:
    "bg-white text-gray-900 shadow-xs ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:bg-gray-800/70 dark:text-gray-100 dark:ring-gray-700 dark:hover:bg-gray-700/70",
  ghost:
    "text-indigo-600 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-gray-200",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "rounded-md px-2.5 py-1.5 text-xs font-semibold",
  md: "rounded-md px-3 py-2 text-sm font-semibold",
  lg: "rounded-md px-3.5 py-2.5 text-sm font-semibold",
};

export function Button({
  variant = "primary",
  size = "md",
  leadingIcon,
  children,
  ...props
}: ButtonProps) {
  const className = [
    "inline-flex items-center justify-center gap-x-1.5 disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
  ].join(" ");

  if ("href" in props && props.href) {
    const { href, ...rest } = props as AsLink;
    return (
      <a href={href} className={className} {...rest}>
        {leadingIcon}
        {children}
      </a>
    );
  }

  const buttonProps = props as AsButton;
  return (
    <button className={className} {...buttonProps}>
      {leadingIcon}
      {children}
    </button>
  );
}
