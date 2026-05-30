import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { ResultCount } from "./ResultCount";

const meta = {
  component: ResultCount,
  tags: ["ai-generated"],
} satisfies Meta<typeof ResultCount>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTotal: Story = {
  args: {
    count: 12,
    total: 48,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/showing/i)).toHaveTextContent("12");
    await expect(canvas.getByText(/showing/i)).toHaveTextContent("48");
  },
};

export const WithoutTotal: Story = {
  args: {
    count: 5,
  },
};
