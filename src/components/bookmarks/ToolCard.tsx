import { useState } from "react";
import { TagBadge } from "../tags";

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
  /** Tags associated with the tool */
  tags?: Array<{ id: string; name: string }>;
  /** Additional className */
  className?: string;
}

/** Fallback image path */
const FALLBACK_IMAGE = "/makerbench-fallback.png";

/**
 * Card component displaying a tool/bookmark with image, title, description, and tags.
 */
export function ToolCard({
  url,
  title,
  description,
  imageUrl,
  tags = [],
  className = "",
}: ToolCardProps) {
  const [imgSrc, setImgSrc] = useState(imageUrl || FALLBACK_IMAGE);

  function handleImageError() {
    setImgSrc(FALLBACK_IMAGE);
  }

  // Extract hostname for display
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  return (
    <article className={`ToolCard ${className}`.trim()}>
      <a href={url} className="ToolCard-link">
        <div className="ToolCard-imageWrapper">
          <img
            src={imgSrc}
            alt=""
            className="ToolCard-image"
            loading="lazy"
            onError={handleImageError}
          />
        </div>

        <div className="ToolCard-content">
          <h3 className="ToolCard-title">{title}</h3>
          <p className="ToolCard-hostname">{hostname}</p>

          {description && (
            <p className="ToolCard-description">{description}</p>
          )}
        </div>
      </a>

      {tags.length > 0 && (
        <div className="ToolCard-tags">
          {tags.map((tag) => (
            <TagBadge
              key={tag.id}
              label={tag.name}
              onClick={() => {
                // Navigate to tag filter - will be implemented with router
                window.location.href = `/?tag=${encodeURIComponent(tag.name)}`;
              }}
            />
          ))}
        </div>
      )}
    </article>
  );
}

