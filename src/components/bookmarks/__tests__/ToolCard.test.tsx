import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("maps the legacy social media tile path to the shipped fallback image", () => {
    const { container } = render(
      <ToolCard {...defaultProps} imageUrl="/social-media-tile.png" />
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "/makerbench-fallback.png");
  });

  it("falls back to the MakerBench image when the provided image fails to load", () => {
    const { container } = render(
      <ToolCard {...defaultProps} imageUrl="https://cdn.example.com/broken.jpg" />
    );
    const img = container.querySelector("img");

    expect(img).toHaveAttribute("src", "https://cdn.example.com/broken.jpg");

    fireEvent.error(img!);

    expect(img).toHaveAttribute("src", "/makerbench-fallback.png");
  });

  it("calls onTagClick with tag id when a tag badge is clicked", async () => {
    const user = userEvent.setup();
    const handleTagClick = vi.fn();

    render(
      <ToolCard
        {...defaultProps}
        tags={[{ id: "t-react", name: "react" }]}
        onTagClick={handleTagClick}
      />
    );

    await user.click(screen.getByRole("button", { name: "react" }));

    expect(handleTagClick).toHaveBeenCalledWith("t-react");
  });

  it("renders submitter name when provided", () => {
    render(<ToolCard {...defaultProps} submitterName="Jane Developer" />);
    expect(screen.getByText("Submitted by Jane Developer")).toBeInTheDocument();
  });

  it("renders submitter GitHub username extracted from URL", () => {
    render(
      <ToolCard
        {...defaultProps}
        submitterGithubUrl="https://github.com/octocat"
      />
    );
    expect(screen.getByText(/^Submitted by$/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "@octocat" }),
    ).toHaveAttribute("href", "https://github.com/octocat");
  });

  it("links submitter name to GitHub profile when URL is valid", () => {
    render(
      <ToolCard
        {...defaultProps}
        submitterName="Octo Cat"
        submitterGithubUrl="https://github.com/octocat"
      />
    );

    expect(screen.getByRole("link", { name: "Octo Cat" })).toHaveAttribute(
      "href",
      "https://github.com/octocat",
    );
  });

  it("does not render a profile link for invalid GitHub URLs", () => {
    render(
      <ToolCard
        {...defaultProps}
        submitterGithubUrl="https://bit.ly/octocat"
      />
    );

    expect(screen.queryByText("Submitted by")).not.toBeInTheDocument();
  });
});
