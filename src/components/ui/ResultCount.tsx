export interface ResultCountProps {
  /** Number of items currently displayed */
  visible: number;
  /** Total number of items available */
  total: number;
  /** Custom class name */
  className?: string;
}

/**
 * Displays count of visible items out of total.
 * Updates dynamically as filters/search change results.
 */
export function ResultCount({
  visible,
  total,
  className = "",
}: ResultCountProps) {
  return (
    <p className={`ResultCount ${className}`.trim()} aria-live="polite">
      Showing <strong>{visible}</strong> of <strong>{total}</strong> tools
    </p>
  );
}

