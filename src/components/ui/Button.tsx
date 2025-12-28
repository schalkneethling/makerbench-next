import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Show loading spinner and disable interaction */
  isLoading?: boolean;
  /** Button content */
  children: ReactNode;
}

/**
 * Reusable button component with primary/secondary variants.
 * Supports loading and disabled states with appropriate focus styles.
 */
export function Button({
  variant = "primary",
  isLoading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  const variantClass = `Button--${variant}`;
  const stateClass = isLoading ? "Button--loading" : "";

  return (
    <button
      className={`Button ${variantClass} ${stateClass} ${className}`.trim()}
      disabled={isDisabled}
      {...props}
    >
      {isLoading && <span className="Button-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
