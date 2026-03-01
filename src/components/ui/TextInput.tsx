import { useId, type InputHTMLAttributes } from "react";
import { Input } from "./Input";

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Label text for the input */
  label: string;
  /** Error message to display */
  error?: string;
  /** Additional description/hint text */
  hint?: string;
  /** Optional semantic ID base (defaults to auto-generated) */
  id?: string;
  /** Ref to the input element */
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Text input with integrated label, error state, and accessibility features.
 * React 19: refs are regular props, no forwardRef needed.
 */
export function TextInput({
  label,
  error,
  hint,
  required,
  className = "",
  id: providedId,
  ref,
  ...props
}: TextInputProps) {
  const autoId = useId();
  const id = providedId || autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`TextInput ${error ? "TextInput--error" : ""} ${className}`.trim()}
    >
      <label htmlFor={id} className="TextInput-label">
        {label}
        {required && (
          <span className="TextInput-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="TextInput-hint">
          {hint}
        </p>
      )}

      <Input
        ref={ref}
        id={id}
        className="TextInput-field"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        aria-required={required}
        {...props}
      />

      {error && (
        <p id={errorId} className="TextInput-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
