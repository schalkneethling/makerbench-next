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
 * Uses aria-live region with aria-busy for accessible loading announcements.
 */
export function ToolGrid({
  tools = [],
  isLoading = false,
  skeletonCount = 6,
  emptyTitle = "No tools found",
  emptyDescription = "Try adjusting your search or browse all tools.",
  className = "",
}: ToolGridProps) {
  const renderContent = () => {
    if (isLoading) {
      return Array.from({ length: skeletonCount }, (_, i) => (
        <ToolCardSkeleton key={`skeleton-${i}`} />
      ));
    }

    if (tools.length === 0) {
      return (
        <div className="ToolGrid-empty">
          <h2 className="ToolGrid-emptyTitle">{emptyTitle}</h2>
          <p className="ToolGrid-emptyDescription">{emptyDescription}</p>
        </div>
      );
    }

    return tools.map((tool) => <ToolCard key={tool.id} {...tool} />);
  };

  return (
    <div
      className={`ToolGrid ${className}`.trim()}
      aria-live="polite"
      aria-busy={isLoading}
    >
      {renderContent()}
    </div>
  );
}
