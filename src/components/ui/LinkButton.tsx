import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { ButtonVariant } from "./Button";

import "./Button.css";

export interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}

/** Link styled as a button for navigation actions. */
export function LinkButton({
  to,
  variant = "primary",
  children,
  className = "",
}: LinkButtonProps) {
  const variantClass = `Button--${variant}`;

  return (
    <Link to={to} className={`Button ${variantClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}

