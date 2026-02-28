import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "../Alert";

describe("Alert", () => {
  it("renders children correctly", () => {
    render(<Alert variant="info">Alert message</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Alert message");
  });

  it("applies correct variant class", () => {
    const { rerender } = render(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("Alert--success");

    rerender(<Alert variant="error">Error</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("Alert--error");

    rerender(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("Alert--warning");

    rerender(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("Alert--info");
  });

  it("uses assertive aria-live for error/warning", () => {
    const { rerender } = render(<Alert variant="error">Error</Alert>);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");

    rerender(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("uses polite aria-live for info/success", () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");

    rerender(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");
  });

  it("shows dismiss button when dismissible", () => {
    render(
      <Alert variant="info" dismissible>
        Dismissible
      </Alert>,
    );
    expect(
      screen.getByRole("button", { name: "Dismiss alert" }),
    ).toBeInTheDocument();
  });

  it("hides dismiss button when not dismissible", () => {
    render(<Alert variant="info">Not dismissible</Alert>);
    expect(
      screen.queryByRole("button", { name: "Dismiss alert" }),
    ).not.toBeInTheDocument();
  });

  it("removes alert when dismissed", async () => {
    const user = userEvent.setup();
    render(
      <Alert variant="info" dismissible>
        Will be dismissed
      </Alert>,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss alert" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onDismiss callback when dismissed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Alert variant="info" dismissible onDismiss={onDismiss}>
        Callback test
      </Alert>,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss alert" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("merges custom className", () => {
    render(
      <Alert variant="info" className="custom-class">
        Custom
      </Alert>,
    );
    expect(screen.getByRole("alert")).toHaveClass("Alert", "custom-class");
  });

  it("displays variant-specific icon", () => {
    const { container, rerender } = render(<Alert variant="success">Success</Alert>);
    expect(container.querySelector(".Alert-icon svg")).toBeInTheDocument();

    rerender(<Alert variant="error">Error</Alert>);
    expect(container.querySelector(".Alert-icon svg")).toBeInTheDocument();

    rerender(<Alert variant="warning">Warning</Alert>);
    expect(container.querySelector(".Alert-icon svg")).toBeInTheDocument();

    rerender(<Alert variant="info">Info</Alert>);
    expect(container.querySelector(".Alert-icon svg")).toBeInTheDocument();
  });
});

