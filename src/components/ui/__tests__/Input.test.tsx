import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with base Input class", () => {
    render(
      <>
        <label htmlFor="base-input">Base input</label>
        <Input id="base-input" />
      </>,
    );
    expect(screen.getByLabelText("Base input")).toHaveClass("Input");
  });

  it("merges custom className with base class", () => {
    render(
      <>
        <label htmlFor="named-input">Named input</label>
        <Input id="named-input" className="CustomInput" />
      </>,
    );
    expect(screen.getByLabelText("Named input")).toHaveClass("Input");
    expect(screen.getByLabelText("Named input")).toHaveClass("CustomInput");
  });

  it("passes through common input attributes", () => {
    render(
      <>
        <label htmlFor="email-input">Email</label>
        <Input
          id="email-input"
          type="email"
          placeholder="name@example.com"
          disabled
        />
      </>,
    );

    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "name@example.com");
    expect(input).toBeDisabled();
  });
});
