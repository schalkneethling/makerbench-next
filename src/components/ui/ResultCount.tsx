export interface ResultCountProps {
  /** Number of items currently displayed */
  count: number;
  /** Total number of items available */
  total: number;
  /** Custom class name */
  className?: string;
}

/**
 * Displays count of items out of total.
 * Updates dynamically as filters/search change results.
 */
export function ResultCount({
  count,
  total,
  className = "",
}: ResultCountProps) {
  return (
    <p className={`ResultCount ${className}`.trim()} aria-live="polite">
      Showing <span className="ResultCount-value">{count}</span> of{" "}
      <span className="ResultCount-value">{total}</span> tools
    </p>
  );
}

