import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { SubmitPage } from "../../pages/SubmitPage";
import { server } from "../../test/mocks/server";

describe("SubmitPage", () => {
  it("submits the existing tool form through the public submission endpoint", async () => {
    let requestBody: unknown;
    server.use(
      http.post("/api/submissions", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: {
              submittedItemId: "11111111-1111-4111-8111-111111111111",
              type: "tool",
              status: "pending",
              message: "Tool submitted.",
            },
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    render(<SubmitPage />);

    await user.type(
      screen.getByRole("textbox", { name: /tool url/i }),
      "https://example.com/tool",
    );
    await user.type(
      screen.getByRole("textbox", { name: /^tags/i }),
      "testing{Enter}",
    );
    await user.click(screen.getByRole("button", { name: "Submit Tool" }));

    expect(
      await screen.findByText(/tool submitted successfully/i),
    ).toBeInTheDocument();
    expect(requestBody).toEqual({
      type: "tool",
      url: "https://example.com/tool",
      tags: ["testing"],
    });
  });

  it("renders structured server validation details", async () => {
    server.use(
      http.post("/api/submissions", () =>
        HttpResponse.json(
          {
            success: false,
            error: "Validation failed",
            details: { url: ["This domain is blocked"] },
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<SubmitPage />);

    await user.type(
      screen.getByRole("textbox", { name: /tool url/i }),
      "https://example.com/tool",
    );
    await user.type(
      screen.getByRole("textbox", { name: /^tags/i }),
      "testing{Enter}",
    );
    await user.click(screen.getByRole("button", { name: "Submit Tool" }));

    expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/url: this domain is blocked/i),
    ).toBeInTheDocument();
  });
});
