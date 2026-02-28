import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextInput } from "../TextInput";

describe("TextInput", () => {
  it("associates error with input via aria-describedby", () => {
    render(<TextInput label="Email" error="Invalid email" />);
    const input = screen.getByLabelText(/email/i);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const errorElement = document.getElementById(describedBy!);
    expect(errorElement).toHaveTextContent("Invalid email");
  });

  it("associates hint with input via aria-describedby", () => {
    render(<TextInput label="Password" hint="Must be 8+ chars" />);
    const input = screen.getByLabelText(/password/i);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();

    const hintElement = document.getElementById(describedBy!);
    expect(hintElement).toHaveTextContent("Must be 8+ chars");
  });

  it("combines hint and error in aria-describedby", () => {
    render(
      <TextInput label="Email" hint="We'll never share" error="Invalid" />,
    );
    const input = screen.getByLabelText(/email/i);
    const describedBy = input.getAttribute("aria-describedby");

    // Should have both IDs space-separated
    expect(describedBy?.split(" ")).toHaveLength(2);
  });

  it("sets aria-invalid only when error present", () => {
    const { rerender } = render(<TextInput label="Email" />);
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute("aria-invalid");

    rerender(<TextInput label="Email" error="Invalid" />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("applies error class to container when error present", () => {
    const { container } = render(
      <TextInput label="Email" error="Invalid email" />,
    );
    expect(container.querySelector(".TextInput")).toHaveClass("TextInput--error");
  });
});
