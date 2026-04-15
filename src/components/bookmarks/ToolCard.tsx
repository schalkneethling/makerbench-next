import { useId } from "react";
import { TagBadge } from "../tags";
import {
  getGithubUsernameFromProfileUrl,
  isValidGithubProfileUrl,
} from "../../lib/github";

import "./ToolCard.css";

export interface ToolCardProps {
  /** Tool URL */
  url: string;
  /** Tool title */
  title: string;
  /** Tool description */
  description?: string;
  /** Screenshot or OG image URL */
  imageUrl?: string;
  /** Optional submitter name */
  submitterName?: string;
  /** Optional submitter GitHub profile URL */
  submitterGithubUrl?: string;
  /** Tags associated with the tool */
  tags?: Array<{ id: string; name: string }>;
  /** Tag click handler for in-app filtering */
  onTagClick?: (tagId: string) => void;
  /** Additional className */
  className?: string;
}

/** Fallback image path */
const FALLBACK_IMAGE = "/makerbench-fallback.png";
const LEGACY_FALLBACK_IMAGE = "/social-media-tile.png";

function getToolImageSrc(imageUrl?: string): string {
  if (!imageUrl || imageUrl === LEGACY_FALLBACK_IMAGE) {
    return FALLBACK_IMAGE;
  }

  return imageUrl;
}

/**
 * Builds a URL that applies a tag filter while preserving current search query.
 */
function buildTagFilterUrl(tagName: string): string {
  const params = new URLSearchParams(window.location.search);
  const currentTagNames = params
    .get("tags")
    ?.split(",")
    .map((name) => name.trim())
    .filter(Boolean) ?? [];

  if (!currentTagNames.includes(tagName)) {
    currentTagNames.push(tagName);
  }

  params.delete("tag"); // Legacy param kept for backward compatibility cleanup
  params.set("tags", currentTagNames.join(","));

  const hasQuery = (params.get("q") ?? "").trim() !== "";
  params.set("mode", hasQuery ? "search-filter" : "filter");

  return `/?${params.toString()}`;
}

/**
 * Card component displaying a tool/bookmark with image, title, description, and tags.
 */
export function ToolCard({
  url,
  title,
  description,
  imageUrl,
  submitterName,
  submitterGithubUrl,
  tags = [],
  onTagClick,
  className = "",
}: ToolCardProps) {
  const titleId = useId();
  const imageSrc = getToolImageSrc(imageUrl);
  // Extract hostname for display
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const hasValidGithubProfile =
    submitterGithubUrl !== undefined &&
    isValidGithubProfileUrl(submitterGithubUrl);
  const githubUsername =
    hasValidGithubProfile && submitterGithubUrl
      ? getGithubUsernameFromProfileUrl(submitterGithubUrl)
      : null;

  return (
    <article className={`ToolCard ${className}`.trim()}>
      <a href={url} className="ToolCard-link" aria-labelledby={titleId}>
        <div className="ToolCard-imageWrapper">
          <img
            src={imageSrc}
            alt=""
            className="ToolCard-image"
            loading="lazy"
            onError={(event) => {
              if (event.currentTarget.src.endsWith(FALLBACK_IMAGE)) {
                return;
              }

              event.currentTarget.src = FALLBACK_IMAGE;
            }}
          />
        </div>

        <div className="ToolCard-content">
          <h3 id={titleId} className="ToolCard-title heading-base">{title}</h3>
          <p className="ToolCard-hostname ui-caption">{hostname}</p>

          {description && (
            <p className="ToolCard-description body-sm">{description}</p>
          )}
        </div>
      </a>

      {(submitterName || githubUsername) && (
        <p className="ToolCard-submitter ui-caption">
          Submitted by{" "}
          {submitterName && hasValidGithubProfile && submitterGithubUrl ? (
            <a
              href={submitterGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ToolCard-submitterLink"
            >
              {submitterName}
            </a>
          ) : (
            submitterName
          )}
          {submitterName && githubUsername ? " · " : ""}
          {githubUsername && submitterGithubUrl && (
            <a
              href={submitterGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ToolCard-submitterLink"
            >
              @{githubUsername}
            </a>
          )}
        </p>
      )}

      {tags.length > 0 && (
        <div className="ToolCard-tags">
          {tags.map((tag) => (
            <TagBadge
              key={tag.id}
              label={tag.name}
              onClick={() => {
                if (onTagClick) {
                  onTagClick(tag.id);
                  return;
                }
                window.location.assign(buildTagFilterUrl(tag.name));
              }}
            />
          ))}
        </div>
      )}
    </article>
  );
}
