import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "../SearchInput";

describe("SearchInput", () => {

  it("renders with label and search icon", () => {
    const handleSearchChange = vi.fn();
    render(
      <SearchInput
        label="Search tools"
        value=""
        onSearchChange={handleSearchChange}
      />,
    );

    const input = screen.getByRole("searchbox", { name: /search tools/i });
    expect(input).toBeInTheDocument();
  });

  it("calls onSearchChange immediately on input change", async () => {
    const handleSearchChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchInput
        label="Search"
        value=""
        onSearchChange={handleSearchChange}
      />,
    );

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");

    // Should be called for each character typed
    expect(handleSearchChange).toHaveBeenCalled();
    expect(handleSearchChange).toHaveBeenLastCalledWith("test");
  });

  it("calls onSearchChange for each character typed", async () => {
    const handleSearchChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchInput
        label="Search"
        value=""
        onSearchChange={handleSearchChange}
      />,
    );

    const input = screen.getByRole("searchbox");

    // Type multiple characters
    await user.type(input, "abc");

    // Should be called for each character
    expect(handleSearchChange).toHaveBeenCalledTimes(3);
    expect(handleSearchChange).toHaveBeenNthCalledWith(1, "a");
    expect(handleSearchChange).toHaveBeenNthCalledWith(2, "ab");
    expect(handleSearchChange).toHaveBeenNthCalledWith(3, "abc");
  });

  it("shows clear button when value is present", () => {
    const handleSearchChange = vi.fn();
    const { rerender } = render(
      <SearchInput
        label="Search"
        value=""
        onSearchChange={handleSearchChange}
      />,
    );

    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();

    rerender(
      <SearchInput
        label="Search"
        value="test"
        onSearchChange={handleSearchChange}
      />,
    );

    expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();
  });

  it("clears value immediately when clear button is clicked", async () => {
    const handleSearchChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchInput
        label="Search"
        value="test"
        onSearchChange={handleSearchChange}
      />,
    );

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearButton);

    expect(handleSearchChange).toHaveBeenCalledWith("");
  });

  it("syncs local value when prop value changes externally", () => {
    const handleSearchChange = vi.fn();
    const { rerender } = render(
      <SearchInput
        label="Search"
        value="initial"
        onSearchChange={handleSearchChange}
      />,
    );

    const input = screen.getByRole("searchbox");
    expect(input).toHaveValue("initial");

    rerender(
      <SearchInput
        label="Search"
        value="updated"
        onSearchChange={handleSearchChange}
      />,
    );

    expect(input).toHaveValue("updated");
  });

  it("uses custom placeholder", () => {
    const handleSearchChange = vi.fn();
    render(
      <SearchInput
        label="Search"
        value=""
        onSearchChange={handleSearchChange}
        placeholder="Type to search..."
      />,
    );

    const input = screen.getByRole("searchbox");
    expect(input).toHaveAttribute("placeholder", "Type to search...");
  });
});

