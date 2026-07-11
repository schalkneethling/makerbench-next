import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SubmitPage } from "../../pages/SubmitPage";
import { server } from "../../test/mocks/server";
import { useAuth } from "../../hooks/useAuth";

vi.mock("../../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const authDefaults = {
  identity: null,
  session: null,
  accessToken: null,
  isAdmin: false,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  signInWithGoogle: vi.fn(),
  signInWithGitHub: vi.fn(),
  signOut: vi.fn(),
  refreshIdentity: vi.fn(),
};

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(authDefaults);
});

describe("SubmitPage", () => {
  it("holds attribution requirements until auth resolves to a signed-in identity", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...authDefaults,
      isLoading: true,
    });
    const { rerender } = render(<SubmitPage />);

    expect(screen.getByRole("status")).toHaveTextContent("Checking your session…");
    expect(screen.getByRole("form", { name: "Submit a Resource" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Tool" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit Resource" })).toBeDisabled();
    expect(screen.queryByRole("textbox", { name: "Your name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "GitHub username" })).not.toBeInTheDocument();

    vi.mocked(useAuth).mockReturnValue({
      ...authDefaults,
      identity: {
        user: {
          id: "user-1",
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          githubUsername: "ada-lovelace",
          avatarUrl: null,
        },
        isAdmin: false,
      },
      accessToken: "verified-token",
      isAuthenticated: true,
      isLoading: false,
    });
    rerender(<SubmitPage />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Submit a Resource" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(screen.getByRole("radio", { name: "Tool" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Submit Resource" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Your name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "GitHub username" })).not.toBeInTheDocument();
  });

  it("requires a binary type and anonymous attribution", async () => {
    const user = userEvent.setup();
    render(<SubmitPage />);

    expect(screen.getByRole("heading", { name: "Submit a Resource" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tool" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Resource" })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: /article/i })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your name" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "GitHub username" })).toBeRequired();

    await user.click(screen.getByRole("button", { name: "Submit Resource" }));

    expect(screen.getByText("Please select a content type")).toBeInTheDocument();
    expect(screen.getByText("Your name is required")).toBeInTheDocument();
    expect(screen.getByText("GitHub username is required")).toBeInTheDocument();
  });

  it("submits a resource with anonymous attribution", async () => {
    let requestBody: unknown;
    server.use(
      http.post("/api/submissions", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          {
            success: true,
            data: {
              submittedItemId: "11111111-1111-4111-8111-111111111111",
              type: "resource",
              status: "pending",
              message: "Resource submitted.",
            },
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    render(<SubmitPage />);

    await user.click(screen.getByRole("radio", { name: "Resource" }));
    await user.type(screen.getByRole("textbox", { name: "URL" }), "https://example.com/guide");
    await user.type(screen.getByRole("textbox", { name: /^tags/i }), "testing{Enter}");
    await user.type(screen.getByRole("textbox", { name: "Your name" }), "Ada Lovelace");
    await user.type(screen.getByRole("textbox", { name: "GitHub username" }), "ada-lovelace");
    await user.click(screen.getByRole("button", { name: "Submit Resource" }));

    expect(await screen.findByText(/submission received/i)).toBeInTheDocument();
    expect(requestBody).toEqual({
      type: "resource",
      url: "https://example.com/guide",
      tags: ["testing"],
      submitterName: "Ada Lovelace",
      submitterGithubUsername: "ada-lovelace",
    });
  });

  it("hides a verified name and sends the access token", async () => {
    let authorization: string | null = null;
    let requestBody: unknown;
    vi.mocked(useAuth).mockReturnValue({
      ...authDefaults,
      identity: {
        user: {
          id: "user-1",
          email: "ada@example.com",
          displayName: "Ada Lovelace",
          githubUsername: "ada-lovelace",
          avatarUrl: null,
        },
        isAdmin: false,
      },
      accessToken: "verified-token",
      isAuthenticated: true,
    });
    server.use(
      http.post("/api/submissions", async ({ request }) => {
        authorization = request.headers.get("Authorization");
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

    expect(screen.queryByRole("textbox", { name: "Your name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "GitHub username" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Tool" }));
    await user.type(screen.getByRole("textbox", { name: "URL" }), "https://example.com/tool");
    await user.type(screen.getByRole("textbox", { name: /^tags/i }), "testing{Enter}");
    await user.click(screen.getByRole("button", { name: "Submit Resource" }));

    await screen.findByText(/submission received/i);
    expect(authorization).toBe("Bearer verified-token");
    expect(requestBody).toEqual({
        type: "tool",
        url: "https://example.com/tool",
        tags: ["testing"],
      });
  });

  it("asks a signed-in user for a missing verified name", () => {
    vi.mocked(useAuth).mockReturnValue({
      ...authDefaults,
      identity: {
        user: {
          id: "user-1",
          email: null,
          displayName: null,
          githubUsername: null,
          avatarUrl: null,
        },
        isAdmin: false,
      },
      accessToken: "verified-token",
      isAuthenticated: true,
    });

    render(<SubmitPage />);

    expect(screen.getByRole("textbox", { name: "Your name" })).toBeRequired();
    expect(screen.getByText(/account does not include a name/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole("radio", { name: "Tool" }));
    await user.type(screen.getByRole("textbox", { name: "URL" }), "https://example.com/tool");
    await user.type(screen.getByRole("textbox", { name: /^tags/i }), "testing{Enter}");
    await user.type(screen.getByRole("textbox", { name: "Your name" }), "Ada Lovelace");
    await user.type(screen.getByRole("textbox", { name: "GitHub username" }), "ada-lovelace");
    await user.click(screen.getByRole("button", { name: "Submit Resource" }));

    expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
    expect(screen.getByText(/url: this domain is blocked/i)).toBeInTheDocument();
  });
});
