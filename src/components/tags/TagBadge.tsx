import { useId, type ButtonHTMLAttributes } from "react";

export interface TagBadgeProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Tag label text */
  label: string;
  /** Whether the tag is currently selected/active */
  isSelected?: boolean;
  /** Optional remove handler - shows remove button when provided */
  onRemove?: () => void;
}

/**
 * Interactive tag badge for filtering and categorization.
 * Clickable for filtering, with optional remove functionality.
 */
export function TagBadge({
  label,
  isSelected = false,
  onRemove,
  className = "",
  onClick,
  ...props
}: TagBadgeProps) {
  const removeLabelId = useId();

  return (
    <span
      className={`TagBadge ${isSelected ? "TagBadge--selected" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="TagBadge-label"
        aria-pressed={isSelected}
        onClick={onClick}
        {...props}
      >
        {label}
      </button>
      {onRemove && (
        <button
          type="button"
          className="TagBadge-remove"
          onClick={onRemove}
          aria-labelledby={removeLabelId}
        >
          <span id={removeLabelId} className="visually-hidden">
            Remove {label}
          </span>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </span>
  );
}
