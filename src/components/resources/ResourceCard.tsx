import { useId } from "react";

import type { Resource } from "../../api";
import { TagBadge } from "../tags";

import "./ResourceCard.css";

interface ResourceCardProps {
  resource: Resource;
  onTagClick?: (tagName: string) => void;
}

function getHostname(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

export function ResourceCard({ resource, onTagClick }: ResourceCardProps) {
  const titleId = useId();
  const isStack = resource.kind === "stack";

  return (
    <article className="ResourceCard">
      <div className="ResourceCard-main">
        {/* TODO: Rework the card-click pattern so the full card is clickable without wrapping all content in one anchor. */}
        <a href={resource.url} className="ResourceCard-link" aria-labelledby={titleId}>
          <span className="ResourceCard-kind ui-caption">
            {isStack ? "Stack" : "Resource"}
          </span>
          <h3 id={titleId} className="ResourceCard-title heading-base">
            {resource.title}
          </h3>
          <p className="ResourceCard-hostname ui-caption">
            {getHostname(resource.url)}
          </p>
          {resource.description && (
            <p className="ResourceCard-description body-sm">
              {resource.description}
            </p>
          )}
        </a>

        {resource.tags.length > 0 && (
          <div className="ResourceCard-tags">
            {resource.tags.map((tag) => (
              <TagBadge
                key={tag.id}
                label={tag.name}
                onClick={() => onTagClick?.(tag.name)}
              />
            ))}
          </div>
        )}
      </div>

      {isStack && resource.children && resource.children.length > 0 && (
        <details className="ResourceCard-stack">
          <summary className="ResourceCard-stackSummary">
            {resource.children.length} resources in this stack
          </summary>
          <ul className="ResourceCard-stackList reset-list">
            {resource.children.map((child) => (
              <li key={child.id} className="ResourceCard-stackItem">
                <a href={child.url} className="ResourceCard-stackLink">
                  {child.title}
                </a>
                <span className="ResourceCard-stackHost ui-caption">
                  {getHostname(child.url)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
