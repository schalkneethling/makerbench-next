import { Button, type ButtonProps } from "./Button";

export interface LoadMoreButtonProps
  extends Omit<ButtonProps, "children" | "variant"> {
  /** Whether more items are available to load */
  hasMore: boolean;
  /** Number of items that will be loaded */
  loadCount?: number;
}

/**
 * Button for loading additional paginated results.
 * Hidden when no more results available.
 */
export function LoadMoreButton({
  hasMore,
  isLoading = false,
  loadCount,
  className = "",
  ...props
}: LoadMoreButtonProps) {
  if (!hasMore && !isLoading) {
    return null;
  }

  const label = loadCount ? `Load ${loadCount} more` : "Load more";

  return (
    <Button
      variant="secondary"
      isLoading={isLoading}
      className={`LoadMoreButton ${className}`.trim()}
      aria-label={isLoading ? "Loading more tools" : label}
      {...props}
    >
      {isLoading ? "Loading…" : label}
    </Button>
  );
}

