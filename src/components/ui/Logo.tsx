import { Link } from "react-router-dom";

export type LogoSize = "sm" | "base" | "lg" | "xl";

export interface LogoProps {
  /** Size variant */
  size?: LogoSize;
  /** Link destination - renders as Link when provided */
  href?: string;
  /** Additional class names */
  className?: string;
}

/**
 * MakerBench logo component.
 * Renders as Link when href provided, otherwise as span.
 */
export function Logo({ size = "base", href, className = "" }: LogoProps) {
  const sizeClass = size !== "base" ? `Logo--${size}` : "";
  const classes = `Logo ${sizeClass} ${className}`.trim();

  const content = (
    <>
      <span className="Logo-maker">Maker</span>
      <span className="Logo-bench">Bench</span>
    </>
  );

  if (href) {
    return (
      <Link to={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <span className={classes}>{content}</span>;
}
