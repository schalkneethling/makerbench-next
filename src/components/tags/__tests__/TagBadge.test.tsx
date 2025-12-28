import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagBadge } from "../TagBadge";

describe("TagBadge", () => {
  it("renders with label", () => {
    render(<TagBadge label="JavaScript" />);
    expect(
      screen.getByRole("button", { name: "JavaScript" }),
    ).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<TagBadge label="React" onClick={handleClick} />);
    await user.click(screen.getByRole("button", { name: "React" }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows selected state with aria-pressed", () => {
    render(<TagBadge label="TypeScript" isSelected />);
    expect(screen.getByRole("button", { name: "TypeScript" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows unselected state with aria-pressed false", () => {
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

  it("shows remove button when onRemove provided", () => {
    render(<TagBadge label="HTML" onRemove={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Remove HTML" }),
    ).toBeInTheDocument();
  });

  it("does not show remove button when onRemove not provided", () => {
    render(<TagBadge label="HTML" />);
    expect(
      screen.queryByRole("button", { name: /remove/i }),
    ).not.toBeInTheDocument();
  });

  it("calls onRemove when remove button clicked", async () => {
    const handleRemove = vi.fn();
    const user = userEvent.setup();

    render(<TagBadge label="Vue" onRemove={handleRemove} />);
    await user.click(screen.getByRole("button", { name: "Remove Vue" }));

    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("remove button has accessible label", () => {
    render(<TagBadge label="Svelte" onRemove={() => {}} />);
    const removeButton = screen.getByRole("button", { name: "Remove Svelte" });
    expect(removeButton).toHaveAccessibleName("Remove Svelte");
  });

  it("merges custom className", () => {
    render(<TagBadge label="Test" className="custom-class" />);
    expect(
      screen.getByRole("button", { name: "Test" }).parentElement,
    ).toHaveClass("TagBadge", "custom-class");
  });

  it("is keyboard accessible", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<TagBadge label="A11y" onClick={handleClick} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "A11y" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
