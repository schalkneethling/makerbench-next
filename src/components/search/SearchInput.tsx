import { useId, useState, useEffect, type ChangeEvent } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid";
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
          <MagnifyingGlassIcon className="SearchInput-iconSvg" />
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
            <XMarkIcon className="SearchInput-clearIcon" aria-hidden="true" />
          </button>
        )}
      </div>
    </search>
  );
}
