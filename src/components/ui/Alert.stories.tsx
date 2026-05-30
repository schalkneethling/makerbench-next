import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";

import { Alert } from "./Alert";

const meta = {
  component: Alert,
  tags: ["ai-generated"],
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    variant: "info",
    children: "Your bookmark was saved successfully.",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  },
};

export const Error: Story = {
  args: {
    variant: "error",
    children: "Something went wrong. Please try again.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "This URL has already been submitted.",
  },
};

export const Dismissible: Story = {
  args: {
    variant: "success",
    dismissible: true,
    children: "Tool submitted for review.",
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /dismiss alert/i }),
    );
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
