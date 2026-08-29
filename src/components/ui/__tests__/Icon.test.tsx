import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { XMarkIcon } from "@heroicons/react/20/solid";

import { Icon } from "../Icon";

describe("Icon", () => {
  it("renders shared Icon classes", () => {
    render(<Icon icon={XMarkIcon} aria-label="Close icon" />);

    const icon = screen.getByLabelText("Close icon");
    expect(icon).toHaveClass("Icon");
    expect(icon).toHaveClass("Icon--md");
  });

  it("applies provided size variant", () => {
    render(<Icon icon={XMarkIcon} size="sm" aria-label="Small close icon" />);

    const icon = screen.getByLabelText("Small close icon");
    expect(icon).toHaveClass("Icon--sm");
  });

  it("merges custom className", () => {
    render(
      <Icon
        icon={XMarkIcon}
        className="CustomIcon"
        aria-label="Custom close icon"
      />,
    );

    const icon = screen.getByLabelText("Custom close icon");
    expect(icon).toHaveClass("Icon");
    expect(icon).toHaveClass("CustomIcon");
  });
});
