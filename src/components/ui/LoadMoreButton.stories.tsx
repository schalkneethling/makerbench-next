import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { LoadMoreButton } from "./LoadMoreButton";

const meta = {
  component: LoadMoreButton,
  tags: ["ai-generated"],
} satisfies Meta<typeof LoadMoreButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HasMore: Story = {
  args: {
    hasMore: true,
    loadCount: 12,
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: /load 12 more/i }),
    ).toBeEnabled();
  },
};

export const Loading: Story = {
  args: {
    hasMore: true,
    isLoading: true,
  },
};

export const HiddenWhenDone: Story = {
  args: {
    hasMore: false,
  },
};
