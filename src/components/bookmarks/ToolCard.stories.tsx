import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ToolCard } from "./ToolCard";

const meta = {
  component: ToolCard,
  tags: ["ai-generated"],
} satisfies Meta<typeof ToolCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    url: "https://vitejs.dev",
    title: "Vite",
    description: "Next generation frontend tooling",
    imageUrl: "/makerbench-fallback.png",
    submitterName: "Alex Maker",
    submitterGithubUrl: "https://github.com/alexmaker",
    tags: [
      { id: "t1", name: "build-tools" },
      { id: "t2", name: "javascript" },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Vite" })).toBeVisible();
    await expect(canvas.getByText("vitejs.dev")).toBeVisible();
  },
};

export const Minimal: Story = {
  args: {
    url: "https://example.com",
    title: "Example Tool",
  },
};

export const WithTagsOnly: Story = {
  args: {
    url: "https://example.com/docs",
    title: "Example Docs",
    tags: [{ id: "t3", name: "documentation" }],
  },
};
