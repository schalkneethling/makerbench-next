import { useId, useState, useEffect, type ChangeEvent } from "react";
import "./SearchInput.css";

export interface SearchInputProps {
  /** Label text for the search input */
  label: string;
  /** Current search value */
  value: string;
  /** Callback fired when search value changes */
  onSearchChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional className */
  className?: string;
}

/**
 * Search input with integrated search icon and clear button.
 * Note: Debouncing should be handled by the parent (e.g., useSearch hook).
 */
export function SearchInput({
  label,
  value,
  onSearchChange,
  placeholder = "Search...",
  className = "",
}: SearchInputProps) {
  const id = useId();
  const [localValue, setLocalValue] = useState(value);

  // Sync local value when prop changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const newValue = event.target.value;
    setLocalValue(newValue);
    onSearchChange(newValue);
  }

  function handleClear() {
    setLocalValue("");
    onSearchChange("");
  }

  const hasValue = localValue.length > 0;

  return (
    <search className={`SearchInput ${className}`.trim()}>
      <label htmlFor={id} className="SearchInput-label visually-hidden">
        {label}
      </label>
      <div className="SearchInput-wrapper">
        <span className="SearchInput-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM1 9a8 8 0 1 1 14.32 4.906l3.387 3.387a1 1 0 0 1-1.414 1.414l-3.387-3.387A8 8 0 0 1 1 9Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          id={id}
          type="search"
          className="SearchInput-field"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
        />
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="SearchInput-clear"
            aria-labelledby={`${id}-clear-label`}
          >
            <span id={`${id}-clear-label`} className="visually-hidden">
              Clear search
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10 9.293l3.646-3.647a.5.5 0 0 1 .708.708L10.707 10l3.647 3.646a.5.5 0 0 1-.708.708L10 10.707l-3.646 3.647a.5.5 0 0 1-.708-.708L9.293 10 5.646 6.354a.5.5 0 1 1 .708-.708L10 9.293Z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}
      </div>
    </search>
  );
}
