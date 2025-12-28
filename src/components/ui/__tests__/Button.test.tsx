import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(button).not.toHaveClass("Button--secondary");
  });

  it("applies secondary variant when specified", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Button--secondary");
    expect(button).not.toHaveClass("Button--primary");
  });

  it("is disabled when loading", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading state with spinner and visible text", () => {
    render(<Button isLoading>Saving...</Button>);
    const button = screen.getByRole("button", { name: "Saving..." });
    expect(button).toHaveClass("Button--loading");
    expect(button.querySelector(".Button-spinner")).toBeInTheDocument();
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("Button", "custom-class");
  });
});
