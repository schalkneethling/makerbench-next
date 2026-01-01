import { TagBadge } from "./TagBadge";
import { Button } from "../ui/Button";

export interface Tag {
  /** Unique tag identifier */
  id: string;
  /** Display label */
  label: string;
}

export interface TagCloudProps {
  /** Available tags to display */
  tags: Tag[];
  /** Currently selected tag IDs */
  selectedIds?: string[];
  /** Called when a tag is toggled */
  onTagToggle?: (tagId: string) => void;
  /** Called when clear all is clicked */
  onClearAll?: () => void;
  /** Label for the tag group */
  label?: string;
  /** Custom class name */
  className?: string;
}

/**
 * Displays available tags with multi-select support.
 * Includes clear all option when tags are selected.
 */
export function TagCloud({
  tags,
  selectedIds = [],
  onTagToggle,
  onClearAll,
  label = "Filter by tag",
  className = "",
}: TagCloudProps) {
  const hasSelection = selectedIds.length > 0;

  if (tags.length === 0) {
    return null;
  }

  return (
    <div
      className={`TagCloud ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      <ul className="TagCloud-list" role="list">
        {tags.map((tag) => (
          <li key={tag.id}>
            <TagBadge
              label={tag.label}
              isSelected={selectedIds.includes(tag.id)}
              onClick={() => onTagToggle?.(tag.id)}
            />
          </li>
        ))}
      </ul>
      {hasSelection && onClearAll && (
        <Button
          variant="ghost"
          className="TagCloud-clear"
          onClick={onClearAll}
          aria-label="Clear all selected tags"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

