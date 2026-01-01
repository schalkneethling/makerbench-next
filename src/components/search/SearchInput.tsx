import { useId, type ChangeEvent } from "react";
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
 * Fully controlled - parent owns the state.
 * Debouncing should be handled by the parent (e.g., useSearch hook).
 */
export function SearchInput({
  label,
  value,
  onSearchChange,
  placeholder = "Search...",
  className = "",
}: SearchInputProps) {
  const id = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onSearchChange(event.target.value);
  }

  function handleClear() {
    onSearchChange("");
  }

  const hasValue = value.length > 0;

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
          value={value}
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
