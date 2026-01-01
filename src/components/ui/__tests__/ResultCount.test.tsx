import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultCount } from "../ResultCount";

describe("ResultCount", () => {
  it("displays visible and total counts", () => {
    render(<ResultCount visible={10} total={42} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText(/tools/i)).toBeInTheDocument();
  });

  it("announces changes to screen readers via aria-live", () => {
    render(<ResultCount visible={5} total={20} />);

    const element = screen.getByRole("paragraph");
    expect(element).toHaveAttribute("aria-live", "polite");
  });

  it("emphasizes counts with strong elements", () => {
    render(<ResultCount visible={3} total={15} />);

    const strongElements = document.querySelectorAll("strong");
    expect(strongElements).toHaveLength(2);
    expect(strongElements[0]).toHaveTextContent("3");
    expect(strongElements[1]).toHaveTextContent("15");
  });

  it("applies custom className", () => {
    render(<ResultCount visible={1} total={5} className="custom-class" />);

    const element = screen.getByRole("paragraph");
    expect(element).toHaveClass("ResultCount", "custom-class");
  });

  it("handles zero values", () => {
    render(<ResultCount visible={0} total={0} />);

    const zeros = screen.getAllByText("0");
    expect(zeros).toHaveLength(2);
  });
});

