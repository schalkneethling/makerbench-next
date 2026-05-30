import type { Resource } from "../../api";
import { ToolCardSkeleton } from "../bookmarks";
import { ResourceCard } from "./ResourceCard";

import "./ResourceGrid.css";

interface ResourceGridProps {
  resources: Resource[];
  isLoading?: boolean;
  onTagClick?: (tagName: string) => void;
}

export function ResourceGrid({ resources, isLoading = false, onTagClick }: ResourceGridProps) {
  if (isLoading) {
    return (
      <div className="ResourceGrid" aria-live="polite" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => (
          <ToolCardSkeleton key={`resource-skeleton-${index}`} />
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="ResourceGrid-empty">
        <h2 className="ResourceGrid-emptyTitle heading-lg">No resources found</h2>
        <p className="ResourceGrid-emptyDescription body-base">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="ResourceGrid" aria-live="polite" aria-busy="false">
      {resources.map((resource) => (
        <ResourceCard
          key={`${resource.kind}-${resource.id}`}
          resource={resource}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}
