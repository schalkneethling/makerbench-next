import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoadMoreButton } from "../LoadMoreButton";

describe("LoadMoreButton", () => {
  it("renders when hasMore is true", () => {
    render(<LoadMoreButton hasMore={true} />);

    expect(
      screen.getByRole("button", { name: /load more/i })
    ).toBeInTheDocument();
  });

  it("is hidden when hasMore is false and not loading", () => {
    const { container } = render(<LoadMoreButton hasMore={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("remains visible during loading even when hasMore is false", () => {
    render(<LoadMoreButton hasMore={false} isLoading={true} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows loading state with spinner", () => {
    render(<LoadMoreButton hasMore={true} isLoading={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-label", "Loading more tools");
  });

  it("displays custom load count", () => {
    render(<LoadMoreButton hasMore={true} loadCount={10} />);

    expect(screen.getByRole("button", { name: /load 10 more/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<LoadMoreButton hasMore={true} onClick={handleClick} />);

    await user.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("uses secondary button variant", () => {
    render(<LoadMoreButton hasMore={true} />);

    expect(screen.getByRole("button")).toHaveClass("Button--secondary");
  });

  it("applies custom className", () => {
    render(<LoadMoreButton hasMore={true} className="custom-class" />);

    expect(screen.getByRole("button")).toHaveClass(
      "LoadMoreButton",
      "custom-class"
    );
  });
});

