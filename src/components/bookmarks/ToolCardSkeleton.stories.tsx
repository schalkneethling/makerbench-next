import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ToolCardSkeleton } from "./ToolCardSkeleton";

const meta = {
  component: ToolCardSkeleton,
  tags: ["ai-generated"],
} satisfies Meta<typeof ToolCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const skeleton = canvasElement.querySelector(".ToolCardSkeleton");
    await expect(skeleton).not.toBeNull();
  },
};

export const Grid: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(2, 1fr)" }}>
      <ToolCardSkeleton />
      <ToolCardSkeleton />
    </div>
  ),
};
