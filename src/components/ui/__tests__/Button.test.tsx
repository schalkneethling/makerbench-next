import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("applies primary variant by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Button--primary");
  });

  it("applies secondary variant when specified", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Button--secondary");
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when loading", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading state with screen reader announcement", () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Button--loading");
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("does not fire click when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    await user.click(screen.getByRole("button"));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("does not fire click when loading", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button isLoading onClick={handleClick}>
        Loading
      </Button>,
    );
    await user.click(screen.getByRole("button"));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Button", "custom-class");
  });

  it("passes through additional button attributes", () => {
    render(
      <Button type="submit" data-testid="submit-btn">
        Submit
      </Button>,
    );
    const button = screen.getByTestId("submit-btn");
    expect(button).toHaveAttribute("type", "submit");
  });
});
