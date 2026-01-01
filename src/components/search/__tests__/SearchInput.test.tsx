import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "../SearchInput";

/**
 * Wrapper that manages state for controlled SearchInput testing.
 */
function ControlledSearchInput({
  initialValue = "",
  onSearchChange,
}: {
  initialValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  function handleChange(newValue: string) {
    setValue(newValue);
    onSearchChange?.(newValue);
  }

  return (
    <SearchInput
      label="Search"
      value={value}
      onSearchChange={handleChange}
      placeholder="Search..."
    />
  );
}

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

  it("calls onSearchChange on input change", async () => {
    const handleSearchChange = vi.fn();
    const user = userEvent.setup();

    render(<ControlledSearchInput onSearchChange={handleSearchChange} />);

    const input = screen.getByRole("searchbox");
    await user.type(input, "test");

    expect(handleSearchChange).toHaveBeenCalledTimes(4);
    expect(handleSearchChange).toHaveBeenLastCalledWith("test");
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

    expect(
      screen.queryByRole("button", { name: /clear search/i }),
    ).not.toBeInTheDocument();

    rerender(
      <SearchInput
        label="Search"
        value="test"
        onSearchChange={handleSearchChange}
      />,
    );

    expect(
      screen.getByRole("button", { name: /clear search/i }),
    ).toBeInTheDocument();
  });

  it("calls onSearchChange with empty string when clear clicked", async () => {
    const handleSearchChange = vi.fn();
    const user = userEvent.setup();

    render(<ControlledSearchInput initialValue="test" onSearchChange={handleSearchChange} />);

    const clearButton = screen.getByRole("button", { name: /clear search/i });
    await user.click(clearButton);

    expect(handleSearchChange).toHaveBeenCalledWith("");
  });

  it("displays value prop in input", () => {
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

