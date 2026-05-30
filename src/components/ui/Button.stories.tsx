import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Button } from "./Button";

const meta = {
  component: Button,
  tags: ["ai-generated"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Submit tool",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /submit tool/i })).toBeEnabled();
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Cancel",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Clear all",
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: "Saving…",
  },
};

export const CssCheck: Story = {
  args: {
    children: "Submit",
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: /submit/i });
    // Primary uses --color-primary (oklch workshop red); fails if global CSS did not load.
    await expect(getComputedStyle(button).backgroundColor).toBe("oklch(0.61 0.19 32)");
  },
};
