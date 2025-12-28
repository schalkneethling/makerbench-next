import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "../TextInput";

describe("TextInput", () => {
  it("renders with label", () => {
    render(<TextInput label="Email" />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("associates label with input", () => {
    render(<TextInput label="Username" />);
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("id");
  });

  it("shows required indicator", () => {
    render(<TextInput label="Email" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("sets aria-required when required", () => {
    render(<TextInput label="Email" required />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  it("displays hint text", () => {
    render(<TextInput label="Password" hint="Must be at least 8 characters" />);
    expect(
      screen.getByText("Must be at least 8 characters"),
    ).toBeInTheDocument();
  });

  it("displays error message", () => {
    render(<TextInput label="Email" error="Invalid email address" />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid email address",
    );
  });

  it("sets aria-invalid when error present", () => {
    render(<TextInput label="Email" error="Invalid" />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("associates error with input via aria-describedby", () => {
    render(<TextInput label="Email" error="Invalid email" />);
    const input = screen.getByLabelText(/email/i);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const errorElement = document.getElementById(describedBy!);
    expect(errorElement).toHaveTextContent("Invalid email");
  });

  it("handles user input", async () => {
    const user = userEvent.setup();
    render(<TextInput label="Name" />);

    const input = screen.getByLabelText("Name");
    await user.type(input, "John Doe");

    expect(input).toHaveValue("John Doe");
  });

  it("calls onChange handler", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<TextInput label="Name" onChange={handleChange} />);
    await user.type(screen.getByLabelText("Name"), "a");

    expect(handleChange).toHaveBeenCalled();
  });

  it("supports disabled state", () => {
    render(<TextInput label="Email" disabled />);
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });

  it("forwards ref to input element", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<TextInput label="Test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through additional input props", () => {
    render(
      <TextInput label="Email" type="email" placeholder="you@example.com" />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("placeholder", "you@example.com");
  });
});
