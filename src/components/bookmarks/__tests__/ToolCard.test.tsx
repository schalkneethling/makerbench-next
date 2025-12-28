import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCard } from "../ToolCard";

describe("ToolCard", () => {
  const defaultProps = {
    url: "https://example.com/tool",
    title: "Example Tool",
  };

  it("renders as article element", () => {
    render(<ToolCard {...defaultProps} />);
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("displays title as heading", () => {
    render(<ToolCard {...defaultProps} />);
    expect(
      screen.getByRole("heading", { name: "Example Tool" })
    ).toBeInTheDocument();
  });

  it("displays hostname from URL", () => {
    render(<ToolCard {...defaultProps} url="https://www.github.com/repo" />);
    expect(screen.getByText("github.com")).toBeInTheDocument();
  });

  it("displays description when provided", () => {
    render(
      <ToolCard {...defaultProps} description="A helpful development tool" />
    );
    expect(screen.getByText("A helpful development tool")).toBeInTheDocument();
  });

  it("links to tool URL", () => {
    render(<ToolCard {...defaultProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/tool");
  });

  it("link accessible name is the title via aria-labelledby", () => {
    render(<ToolCard {...defaultProps} />);
    // Link should be accessible by title name, not all content
    const link = screen.getByRole("link", { name: "Example Tool" });
    expect(link).toBeInTheDocument();
  });

  it("renders tag badges when tags provided", () => {
    render(
      <ToolCard
        {...defaultProps}
        tags={[
          { id: "1", name: "React" },
          { id: "2", name: "TypeScript" },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: "React" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "TypeScript" })
    ).toBeInTheDocument();
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

  it("has empty alt text on decorative image", () => {
    // Images with alt="" are decorative and correctly have role="presentation"
    const { container } = render(<ToolCard {...defaultProps} />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });

  it("navigates to tag filter when tag clicked", async () => {
    const user = userEvent.setup();
    // Mock window.location
    const originalLocation = window.location;
    // @ts-expect-error - Mocking window.location for test
    delete window.location;
    window.location = { ...originalLocation, href: "" };

    render(<ToolCard {...defaultProps} tags={[{ id: "1", name: "React" }]} />);
    await user.click(screen.getByRole("button", { name: "React" }));

    expect(window.location.href).toBe("/?tag=React");

    window.location = originalLocation;
  });
});

