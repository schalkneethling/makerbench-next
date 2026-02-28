import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with base Input class", () => {
    render(<Input aria-label="Base input" />);
    expect(screen.getByLabelText("Base input")).toHaveClass("Input");
  });

  it("merges custom className with base class", () => {
    render(<Input aria-label="Named input" className="CustomInput" />);
    expect(screen.getByLabelText("Named input")).toHaveClass("Input");
    expect(screen.getByLabelText("Named input")).toHaveClass("CustomInput");
  });

  it("passes through common input attributes", () => {
    render(
      <Input
        aria-label="Email"
        type="email"
        placeholder="name@example.com"
        disabled
      />,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "name@example.com");
    expect(input).toBeDisabled();
  });
});
