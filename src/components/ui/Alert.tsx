import { useId, useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import {
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/20/solid";

import { Button } from "./Button";
import "./Alert.css";

export type AlertVariant = "success" | "error" | "warning" | "info";

export interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICONS: Record<AlertVariant, IconComponent> = {
  success: CheckIcon,
  error: XMarkIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
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
  const Icon = ICONS[variant];

  return (
    <div
      role="alert"
      aria-live={politeness}
      className={`Alert Alert--${variant} ${className}`.trim()}
    >
      <span className="Alert-icon" aria-hidden="true">
        <Icon className="Alert-iconSvg" />
      </span>
      <div className="Alert-content">{children}</div>
      {dismissible && (
        <Button
          variant="ghost"
          className="Alert-dismiss"
          onClick={handleDismiss}
          aria-labelledby={dismissLabelId}
        >
          <span id={dismissLabelId} className="visually-hidden">
            Dismiss alert
          </span>
          <XMarkIcon className="Alert-dismissIcon" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

