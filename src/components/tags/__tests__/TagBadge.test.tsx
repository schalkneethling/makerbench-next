import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagBadge } from "../TagBadge";

describe("TagBadge", () => {
  it("sets aria-pressed true when selected", () => {
    render(<TagBadge label="TypeScript" isSelected />);
    expect(screen.getByRole("button", { name: "TypeScript" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sets aria-pressed false when not selected", () => {
    render(<TagBadge label="TypeScript" isSelected={false} />);
    expect(screen.getByRole("button", { name: "TypeScript" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("applies selected class when isSelected", () => {
    render(<TagBadge label="CSS" isSelected />);
    expect(
      screen.getByRole("button", { name: "CSS" }).parentElement,
    ).toHaveClass("TagBadge--selected");
  });

  it("renders remove button only when onRemove provided", () => {
    const { rerender } = render(<TagBadge label="HTML" />);
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();

    rerender(<TagBadge label="HTML" onRemove={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Remove HTML" }),
    ).toBeInTheDocument();
  });

  it("remove button uses aria-labelledby with visually-hidden text", () => {
    render(<TagBadge label="Vue" onRemove={() => {}} />);
    const removeButton = screen.getByRole("button", { name: "Remove Vue" });

    // Verify aria-labelledby points to element with correct text
    const labelledById = removeButton.getAttribute("aria-labelledby");
    expect(labelledById).toBeTruthy();

    const labelElement = document.getElementById(labelledById!);
    expect(labelElement).toHaveTextContent("Remove Vue");
    expect(labelElement).toHaveClass("visually-hidden");
  });

  it("merges custom className", () => {
    render(<TagBadge label="Test" className="custom-class" />);
    expect(
      screen.getByRole("button", { name: "Test" }).parentElement,
    ).toHaveClass("TagBadge", "custom-class");
  });
});
