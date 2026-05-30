import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { SearchInput } from "./SearchInput";

const meta = {
  component: SearchInput,
  tags: ["ai-generated"],
  args: {
    label: "Search tools",
    value: "",
    onSearchChange: () => {},
  },
} satisfies Meta<typeof SearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => {
    const [value, setValue] = useState("");

    return (
      <SearchInput
        label="Search tools"
        value={value}
        onSearchChange={setValue}
        placeholder="Search by title or tag…"
      />
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("searchbox")).toHaveValue("");
  },
};

export const WithValue: Story = {
  render: () => {
    const [value, setValue] = useState("vite");

    return (
      <SearchInput
        label="Search tools"
        value={value}
        onSearchChange={setValue}
      />
    );
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("searchbox")).toHaveValue("vite");
    await userEvent.click(canvas.getByRole("button", { name: /clear search/i }));
    await expect(canvas.getByRole("searchbox")).toHaveValue("");
  },
};
