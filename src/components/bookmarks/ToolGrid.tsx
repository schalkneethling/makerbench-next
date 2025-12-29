import { ToolCard, type ToolCardProps } from "./ToolCard";
import { ToolCardSkeleton } from "./ToolCardSkeleton";

import "./ToolGrid.css";

export interface ToolGridProps {
  /** Array of tools to display */
  tools?: Array<ToolCardProps & { id: string }>;
  /** Loading state - shows skeleton cards */
  isLoading?: boolean;
  /** Number of skeleton cards to show when loading */
  skeletonCount?: number;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Additional className */
  className?: string;
}

/**
 * Responsive grid displaying ToolCards with loading and empty states.
 * Columns: 1 (mobile) → 2 (tablet) → 3 (desktop) → 4 (wide).
 */
export function ToolGrid({
  tools = [],
  isLoading = false,
  skeletonCount = 6,
  emptyTitle = "No tools found",
  emptyDescription = "Try adjusting your search or browse all tools.",
  className = "",
}: ToolGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        className={`ToolGrid ${className}`.trim()}
        aria-busy="true"
        aria-label="Loading tools"
      >
        {Array.from({ length: skeletonCount }, (_, i) => (
          <ToolCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (tools.length === 0) {
    return (
      <div className={`ToolGrid ${className}`.trim()}>
        <div className="ToolGrid-empty">
          <div className="ToolGrid-emptyIcon" aria-hidden="true">
            🔍
          </div>
          <h2 className="ToolGrid-emptyTitle">{emptyTitle}</h2>
          <p className="ToolGrid-emptyDescription">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  // Tools grid
  return (
    <div className={`ToolGrid ${className}`.trim()}>
      {tools.map((tool) => (
        <ToolCard key={tool.id} {...tool} />
      ))}
    </div>
  );
}

