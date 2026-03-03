import type { ComponentType, SVGProps } from "react";

export type IconSize = "xs" | "sm" | "md" | "lg";

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Heroicon (or compatible SVG component) to render */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Semantic icon size variant */
  size?: IconSize;
}

/**
 * Shared SVG icon wrapper to standardize sizing/display across components.
 */
export function Icon({
  icon: SvgIcon,
  size = "md",
  className = "",
  ...props
}: IconProps) {
  return (
    <SvgIcon
      className={`Icon Icon--${size} ${className}`.trim()}
      {...props}
    />
  );
}
