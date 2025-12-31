import { useId, useState, type ReactNode } from "react";

import "./Alert.css";

export type AlertVariant = "success" | "error" | "warning" | "info";

export interface AlertProps {
  /** Visual style variant */
  variant: AlertVariant;
  /** Alert content */
  children: ReactNode;
  /** Whether alert can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Optional custom className */
  className?: string;
}

const ICONS: Record<AlertVariant, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

/**
 * Alert component for user feedback messages.
 * Uses ARIA live region for screen reader announcements.
 */
export function Alert({
  variant,
  children,
  dismissible = false,
  onDismiss,
  className = "",
}: AlertProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const dismissLabelId = useId();

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Use polite for info/success, assertive for errors/warnings
  const politeness = variant === "error" || variant === "warning" ? "assertive" : "polite";

  return (
    <div
      role="alert"
      aria-live={politeness}
      className={`Alert Alert--${variant} ${className}`.trim()}
    >
      <span className="Alert-icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div className="Alert-content">{children}</div>
      {dismissible && (
        <button
          type="button"
          className="Alert-dismiss"
          onClick={handleDismiss}
          aria-labelledby={dismissLabelId}
        >
          <span id={dismissLabelId} className="visually-hidden">
            Dismiss alert
          </span>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

