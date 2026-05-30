import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { TagCloud } from "./TagCloud";

const sampleTags = [
  { id: "t1", label: "javascript" },
  { id: "t2", label: "react" },
  { id: "t3", label: "css" },
];

const meta = {
  component: TagCloud,
  tags: ["ai-generated"],
  args: {
    tags: sampleTags,
  },
} satisfies Meta<typeof TagCloud>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <TagCloud tags={sampleTags} />,
};

export const WithSelection: Story = {
  render: () => {
    const [selectedIds, setSelectedIds] = useState<string[]>(["t2"]);

    return (
      <TagCloud
        tags={sampleTags}
        selectedIds={selectedIds}
        onTagToggle={(tagId) => {
          setSelectedIds((current) =>
            current.includes(tagId)
              ? current.filter((id) => id !== tagId)
              : [...current, tagId],
          );
        }}
        onClearAll={() => {
          setSelectedIds([]);
        }}
      />
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "javascript" }));
    await expect(
      canvas.getByRole("button", { name: "javascript" }),
    ).toHaveAttribute("aria-pressed", "true");
  },
};
