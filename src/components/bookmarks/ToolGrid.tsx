import { ToolCard, type ToolCardProps } from "./ToolCard";
import { ToolCardSkeleton } from "./ToolCardSkeleton";

import "./ToolGrid.css";

export interface ToolGridProps {
  tools?: Array<ToolCardProps & { id: string }>;
  onTagClick?: (tagId: string) => void;
  isLoading?: boolean;
  skeletonCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

/**
 * Responsive grid displaying ToolCards with loading and empty states.
 * Uses aria-live region with aria-busy for accessible loading announcements.
 */
export function ToolGrid({
  tools = [],
  onTagClick,
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

    return tools.map((tool) => (
      <ToolCard key={tool.id} {...tool} onTagClick={onTagClick} />
    ));
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
