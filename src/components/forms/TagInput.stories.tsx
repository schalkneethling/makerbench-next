import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { TagInput } from "./TagInput";

const meta = {
  component: TagInput,
  tags: ["ai-generated"],
  args: {
    label: "Tags",
    tags: [],
    onTagsChange: () => {},
  },
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => {
    const [tags, setTags] = useState<string[]>([]);

    return (
      <TagInput
        label="Tags"
        tags={tags}
        onTagsChange={setTags}
        hint="Add up to 10 tags to help others find this tool."
      />
    );
  },
};

export const WithTags: Story = {
  render: () => {
    const [tags, setTags] = useState<string[]>(["react", "typescript"]);

    return <TagInput label="Tags" tags={tags} onTagsChange={setTags} required />;
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: /remove react/i })).toBeVisible();
    await userEvent.type(canvas.getByRole("textbox"), "vite{Enter}");
    await expect(canvas.getByRole("button", { name: /remove vite/i })).toBeVisible();
  },
};

export const WithError: Story = {
  render: () => {
    const [tags, setTags] = useState<string[]>([]);

    return (
      <TagInput
        label="Tags"
        tags={tags}
        onTagsChange={setTags}
        error="Add at least one tag."
        required
      />
    );
  },
};
