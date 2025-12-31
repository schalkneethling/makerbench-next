import { useState, useId, type KeyboardEvent, type ChangeEvent } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";

import "./TagInput.css";

export interface TagInputProps {
  /** Label text for the input */
  label: string;
  /** Current tags array */
  tags: string[];
  /** Callback when tags change */
  onTagsChange: (tags: string[]) => void;
  /** Maximum number of tags allowed */
  maxTags?: number;
  /** Error message to display */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Additional description/hint text */
  hint?: string;
  /** Additional className */
  className?: string;
}

/**
 * Tag input with comma/Enter chip creation, validation, and keyboard accessibility.
 */
export function TagInput({
  label,
  tags,
  onTagsChange,
  maxTags = 10,
  error,
  placeholder = "Type and press Enter or comma",
  required,
  hint,
  className = "",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const tagsId = `${id}-tags`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const canAddMore = tags.length < maxTags;

  /**
   * Adds a tag if valid and not duplicate.
   */
  function addTag(value: string) {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    // Check for duplicates (case-insensitive)
    if (tags.some((tag) => tag.toLowerCase() === trimmedValue.toLowerCase())) {
      return;
    }

    if (!canAddMore) {
      return;
    }

    onTagsChange([...tags, trimmedValue]);
    setInputValue("");
  }

  /**
   * Removes a tag by index.
   */
  function removeTag(index: number) {
    onTagsChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(inputValue);
    } else if (
      event.key === "Backspace" &&
      inputValue === "" &&
      tags.length > 0
    ) {
      // Remove last tag when backspacing with empty input
      removeTag(tags.length - 1);
    }
  }

  /**
   * Adds pending tag when input loses focus (e.g., Tab to next field).
   */
  function handleBlur() {
    addTag(inputValue);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;

    // Handle comma in pasted/typed content
    if (value.includes(",")) {
      const parts = value.split(",");
      const lastPart = parts.pop() ?? "";

      // Collect valid new tags, avoiding duplicates within paste and existing tags
      const newTags: string[] = [];
      const existingLower = tags.map((t) => t.toLowerCase());

      for (const part of parts) {
        const trimmedValue = part.trim();
        if (!trimmedValue) {
          continue;
        }

        const lowerValue = trimmedValue.toLowerCase();
        const isDuplicate =
          existingLower.includes(lowerValue) ||
          newTags.some((t) => t.toLowerCase() === lowerValue);

        if (!isDuplicate && tags.length + newTags.length < maxTags) {
          newTags.push(trimmedValue);
        }
      }

      if (newTags.length > 0) {
        onTagsChange([...tags, ...newTags]);
      }
      setInputValue(lastPart);
    } else {
      setInputValue(value);
    }
  }

  return (
    <div
      className={`TagInput ${error ? "TagInput--error" : ""} ${className}`.trim()}
    >
      <label htmlFor={id} className="TagInput-label">
        {label}
        {required && (
          <span className="TagInput-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="TagInput-hint">
          {hint}
        </p>
      )}

      <div className="TagInput-container">
        {tags.length > 0 && (
          <ul
            id={tagsId}
            className="TagInput-tags reset-list"
            aria-label="Selected tags"
          >
            {tags.map((tag, index) => {
              const removeLabelId = `${id}-remove-${index}`;
              return (
                <li key={`${tag}-${index}`} className="TagInput-tag">
                  <span className="TagInput-tagLabel">{tag}</span>
                  <button
                    type="button"
                    className="TagInput-tagRemove"
                    onClick={() => removeTag(index)}
                    aria-labelledby={removeLabelId}
                  >
                    <span id={removeLabelId} className="visually-hidden">
                      Remove {tag}
                    </span>
                    <XMarkIcon className="TagInput-tagRemoveIcon" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <input
          id={id}
          type="text"
          className="TagInput-field"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={canAddMore ? placeholder : "Maximum tags reached"}
          disabled={!canAddMore}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          aria-required={required}
        />
      </div>

      <p className="TagInput-count" aria-live="polite">
        {tags.length}/{maxTags} tags
      </p>

      {error && (
        <p id={errorId} className="TagInput-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

