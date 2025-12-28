import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "../TagInput";

describe("TagInput", () => {
  const defaultProps = {
    label: "Tags",
    tags: [],
    onTagsChange: vi.fn(),
  };

  it("adds tag on Enter key", async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput {...defaultProps} onTagsChange={onTagsChange} />);

    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.type(input, "JavaScript{Enter}");

    expect(onTagsChange).toHaveBeenCalledWith(["JavaScript"]);
  });

  it("adds tag on comma key", async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput {...defaultProps} onTagsChange={onTagsChange} />);

    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.type(input, "TypeScript,");

    expect(onTagsChange).toHaveBeenCalledWith(["TypeScript"]);
  });

  it("does not add empty tags", async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();
    render(<TagInput {...defaultProps} onTagsChange={onTagsChange} />);

    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.type(input, "   {Enter}");

    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("does not add duplicate tags", async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TagInput
        {...defaultProps}
        tags={["React"]}
        onTagsChange={onTagsChange}
      />
    );

    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.type(input, "react{Enter}");

    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("removes tag when remove button clicked", async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TagInput
        {...defaultProps}
        tags={["React", "Vue"]}
        onTagsChange={onTagsChange}
      />
    );

    const removeButton = screen.getByRole("button", { name: "Remove React" });
    await user.click(removeButton);

    expect(onTagsChange).toHaveBeenCalledWith(["Vue"]);
  });

  it("removes last tag on Backspace with empty input", async () => {
    const onTagsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TagInput
        {...defaultProps}
        tags={["React", "Vue"]}
        onTagsChange={onTagsChange}
      />
    );

    const input = screen.getByRole("textbox", { name: "Tags" });
    await user.click(input);
    await user.keyboard("{Backspace}");

    expect(onTagsChange).toHaveBeenCalledWith(["React"]);
  });

  it("disables input when max tags reached", () => {
    render(<TagInput {...defaultProps} tags={["a", "b", "c"]} maxTags={3} />);

    const input = screen.getByRole("textbox", { name: "Tags" });
    expect(input).toBeDisabled();
  });

  it("shows tag count", () => {
    render(<TagInput {...defaultProps} tags={["React", "Vue"]} maxTags={10} />);

    expect(screen.getByText("2/10 tags")).toBeInTheDocument();
  });

  it("displays error message with aria-invalid", () => {
    render(<TagInput {...defaultProps} error="At least one tag required" />);

    const input = screen.getByRole("textbox", { name: "Tags" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "At least one tag required"
    );
  });

  it("remove button uses aria-labelledby with visually-hidden text", () => {
    render(<TagInput {...defaultProps} tags={["CSS"]} />);

    const removeButton = screen.getByRole("button", { name: "Remove CSS" });
    const labelledById = removeButton.getAttribute("aria-labelledby");
    expect(labelledById).toBeTruthy();

    const labelElement = document.getElementById(labelledById!);
    expect(labelElement).toHaveTextContent("Remove CSS");
    expect(labelElement).toHaveClass("visually-hidden");
  });

  it("renders tags in a list with label", () => {
    render(<TagInput {...defaultProps} tags={["React", "Vue"]} />);

    const tagList = screen.getByRole("list", { name: "Selected tags" });
    expect(tagList).toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
  });
});

