import "./ToolCardSkeleton.css";

export interface ToolCardSkeletonProps {
  /** Additional className */
  className?: string;
}

/**
 * Loading skeleton matching ToolCard dimensions.
 * Shimmer animation respects prefers-reduced-motion via global reset.
 */
export function ToolCardSkeleton({ className = "" }: ToolCardSkeletonProps) {
  return (
    <div
      className={`ToolCardSkeleton ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="ToolCardSkeleton-image" />

      <div className="ToolCardSkeleton-content">
        <div className="ToolCardSkeleton-title" />
        <div className="ToolCardSkeleton-hostname" />
        <div className="ToolCardSkeleton-description" />
      </div>

      <div className="ToolCardSkeleton-tags">
        <div className="ToolCardSkeleton-tag" />
        <div className="ToolCardSkeleton-tag" />
        <div className="ToolCardSkeleton-tag" />
      </div>
    </div>
  );
}
