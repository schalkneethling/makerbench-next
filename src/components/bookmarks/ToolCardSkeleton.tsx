import "./ToolCardSkeleton.css";

export interface ToolCardSkeletonProps {
  /** Show tags section placeholder */
  showTags?: boolean;
  /** Number of tag placeholders to show */
  tagCount?: number;
  /** Additional className */
  className?: string;
}

/**
 * Loading skeleton matching ToolCard dimensions.
 * Animated shimmer effect respects prefers-reduced-motion.
 */
export function ToolCardSkeleton({
  showTags = true,
  tagCount = 3,
  className = "",
}: ToolCardSkeletonProps) {
  return (
    <div
      className={`ToolCardSkeleton ${className}`.trim()}
      aria-hidden="true"
    >
      <div className="ToolCardSkeleton-image" />

      <div className="ToolCardSkeleton-content">
        <hgroup>
          <div className="ToolCardSkeleton-title" />
          <div className="ToolCardSkeleton-hostname" />
        </hgroup>
        <div className="ToolCardSkeleton-description" />
      </div>

      {showTags && (
        <div className="ToolCardSkeleton-tags">
          {Array.from({ length: tagCount }, (_, i) => (
            <div key={i} className="ToolCardSkeleton-tag" />
          ))}
        </div>
      )}
    </div>
  );
}


