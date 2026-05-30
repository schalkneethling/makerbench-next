import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { TagBadge } from "./TagBadge";

const meta = {
  component: TagBadge,
  tags: ["ai-generated"],
} satisfies Meta<typeof TagBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "javascript",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "javascript" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  },
};

export const Selected: Story = {
  args: {
    label: "react",
    isSelected: true,
  },
};

export const Removable: Story = {
  args: {
    label: "typescript",
    onRemove: () => {},
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /remove typescript/i })).toBeVisible();
  },
};
