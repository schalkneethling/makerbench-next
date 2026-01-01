import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagCloud, type Tag } from "../TagCloud";

const mockTags: Tag[] = [
  { id: "1", label: "JavaScript" },
  { id: "2", label: "TypeScript" },
  { id: "3", label: "React" },
];

describe("TagCloud", () => {
  it("renders all tags", () => {
    render(<TagCloud tags={mockTags} />);

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
  });

  it("renders nothing when tags array is empty", () => {
    const { container } = render(<TagCloud tags={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks selected tags", () => {
    render(<TagCloud tags={mockTags} selectedIds={["1", "3"]} />);

    const jsButton = screen.getByRole("button", { name: "JavaScript" });
    const tsButton = screen.getByRole("button", { name: "TypeScript" });
    const reactButton = screen.getByRole("button", { name: "React" });

    expect(jsButton).toHaveAttribute("aria-pressed", "true");
    expect(tsButton).toHaveAttribute("aria-pressed", "false");
    expect(reactButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onTagToggle when tag is clicked", async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();

    render(<TagCloud tags={mockTags} onTagToggle={handleToggle} />);

    await user.click(screen.getByRole("button", { name: "TypeScript" }));

    expect(handleToggle).toHaveBeenCalledWith("2");
  });

  it("shows clear all button when tags are selected", () => {
    const handleClear = vi.fn();

    render(
      <TagCloud
        tags={mockTags}
        selectedIds={["1"]}
        onClearAll={handleClear}
      />
    );

    expect(
      screen.getByRole("button", { name: /clear all/i })
    ).toBeInTheDocument();
  });

  it("hides clear all when no tags selected", () => {
    const handleClear = vi.fn();

    render(<TagCloud tags={mockTags} selectedIds={[]} onClearAll={handleClear} />);

    expect(screen.queryByRole("button", { name: /clear all/i })).not.toBeInTheDocument();
  });

  it("calls onClearAll when clear button clicked", async () => {
    const user = userEvent.setup();
    const handleClear = vi.fn();

    render(
      <TagCloud
        tags={mockTags}
        selectedIds={["1", "2"]}
        onClearAll={handleClear}
      />
    );

    await user.click(screen.getByRole("button", { name: /clear all/i }));

    expect(handleClear).toHaveBeenCalledOnce();
  });

  it("has accessible group with label", () => {
    render(<TagCloud tags={mockTags} label="Categories" />);

    expect(screen.getByRole("group", { name: "Categories" })).toBeInTheDocument();
  });

  it("uses list semantics for tags", () => {
    render(<TagCloud tags={mockTags} />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(3);
  });

  it("applies custom className", () => {
    render(<TagCloud tags={mockTags} className="custom-class" />);

    expect(screen.getByRole("group")).toHaveClass("TagCloud", "custom-class");
  });
});

