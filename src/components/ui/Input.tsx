import type { InputHTMLAttributes, Ref } from "react";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "ref" | "aria-label"> {
  /** Ref to input element (React 19 style ref prop) */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Low-level shared input primitive for text-like fields.
 * Higher-level components (TextInput, SearchInput, TagInput) compose this.
 * Labels should be provided with a <label htmlFor="..."> or aria-labelledby.
 */
export function Input({ className = "", ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={`Input ${className}`.trim()}
      {...props}
    />
  );
}
