import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultCount } from "../ResultCount";

describe("ResultCount", () => {
  it("displays count and total", () => {
    render(<ResultCount count={10} total={42} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText(/tools/i)).toBeInTheDocument();
  });
});
