import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolCard } from "../ToolCard";

/**
 * Unit tests for ToolCard component logic.
 * Structural and accessibility tests are in e2e/tool-card.spec.ts
 */
describe("ToolCard", () => {
  const defaultProps = {
    url: "https://example.com/tool",
    title: "Example Tool",
  };

  it("extracts hostname from URL without www prefix", () => {
    render(<ToolCard {...defaultProps} url="https://www.github.com/repo" />);
    expect(screen.getByText("github.com")).toBeInTheDocument();
  });

  it("uses fallback image when imageUrl not provided", () => {
    const { container } = render(<ToolCard {...defaultProps} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/makerbench-fallback.png");
  });

  it("uses provided imageUrl", () => {
    const { container } = render(
      <ToolCard {...defaultProps} imageUrl="https://cdn.example.com/image.jpg" />
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/image.jpg");
  });
});

