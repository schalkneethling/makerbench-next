import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookmarkApiError } from "../../api";
import { useAuth } from "../../hooks/useAuth";
import { useLibraryResources } from "../../hooks/useLibraryResources";
import { LibraryPage } from "../../pages/LibraryPage";

vi.mock("../../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../hooks/useLibraryResources", () => ({
  useLibraryResources: vi.fn(),
}));

const addResource = vi.fn();
const inspectResource = vi.fn();
const dismissInspectionError = vi.fn();
const resetInspection = vi.fn();

const authDefaults = {
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
  session: null,
  accessToken: "verified-token",
  isAdmin: false,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  signInWithGoogle: vi.fn(),
  signInWithGitHub: vi.fn(),
  signOut: vi.fn(),
  refreshIdentity: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(authDefaults);
  vi.mocked(useLibraryResources).mockReturnValue({
    resources: [],
    isLoading: false,
    isSaving: false,
    error: null,
    isInspecting: false,
    inspectionError: null,
    addResource,
    inspectResource,
    dismissInspectionError,
    resetInspection,
    refresh: vi.fn(),
  });
  addResource.mockResolvedValue(true);
});

describe("LibraryPage metadata inspection", () => {
  it("prefills editable metadata and sends edited values as save overrides", async () => {
    inspectResource.mockResolvedValue({
      title: "Extracted title",
      description: "Extracted description",
    });
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.type(
      screen.getByRole("textbox", { name: "Resource URL" }),
      "https://example.com/resource",
    );
    await user.click(screen.getByRole("button", { name: "Inspect URL" }));

    expect(inspectResource).toHaveBeenCalledWith(
      "https://example.com/resource",
    );
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue(
      "Extracted title",
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue(
      "Extracted description",
    );

    await user.clear(screen.getByRole("textbox", { name: "Title" }));
    await user.type(
      screen.getByRole("textbox", { name: "Title" }),
      "  Edited title  ",
    );
    await user.clear(screen.getByRole("textbox", { name: "Description" }));
    await user.type(
      screen.getByRole("textbox", { name: "Description" }),
      "  Edited description  ",
    );
    await user.type(
      screen.getByRole("textbox", { name: /^tags/i }),
      "research{Enter}",
    );
    await user.click(screen.getByRole("button", { name: "Save Resource" }));

    expect(addResource).toHaveBeenCalledWith({
      url: "https://example.com/resource",
      tags: ["research"],
      notes: undefined,
      title: "Edited title",
      description: "Edited description",
    });
  });

  it("omits unchanged inspected metadata from the save request", async () => {
    inspectResource.mockResolvedValue({
      title: "Extracted title",
      description: "Extracted description",
    });
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.type(
      screen.getByRole("textbox", { name: "Resource URL" }),
      "https://example.com/resource",
    );
    await user.click(screen.getByRole("button", { name: "Inspect URL" }));
    await user.type(
      screen.getByRole("textbox", { name: /^tags/i }),
      "research{Enter}",
    );
    await user.click(screen.getByRole("button", { name: "Save Resource" }));

    expect(addResource).toHaveBeenCalledWith({
      url: "https://example.com/resource",
      tags: ["research"],
      notes: undefined,
    });
  });

  it("sends empty overrides when the user clears inspected metadata", async () => {
    inspectResource.mockResolvedValue({
      title: "Extracted title",
      description: "Extracted description",
    });
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.type(
      screen.getByRole("textbox", { name: "Resource URL" }),
      "https://example.com/resource",
    );
    await user.click(screen.getByRole("button", { name: "Inspect URL" }));
    await user.clear(screen.getByRole("textbox", { name: "Title" }));
    await user.clear(screen.getByRole("textbox", { name: "Description" }));
    await user.type(
      screen.getByRole("textbox", { name: /^tags/i }),
      "research{Enter}",
    );
    await user.click(screen.getByRole("button", { name: "Save Resource" }));

    expect(addResource).toHaveBeenCalledWith({
      url: "https://example.com/resource",
      tags: ["research"],
      notes: undefined,
      title: "",
      description: "",
    });
  });

  it("shows inspection failures without preventing the resource from being saved", async () => {
    inspectResource.mockResolvedValue(null);
    vi.mocked(useLibraryResources).mockReturnValue({
      resources: [],
      isLoading: false,
      isSaving: false,
      error: null,
      isInspecting: false,
      inspectionError: new BookmarkApiError(
        "The page did not expose usable metadata.",
        422,
      ),
      addResource,
      inspectResource,
      dismissInspectionError,
      resetInspection,
      refresh: vi.fn(),
    });
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.type(
      screen.getByRole("textbox", { name: "Resource URL" }),
      "https://example.com/resource",
    );
    await user.click(screen.getByRole("button", { name: "Inspect URL" }));

    const inspectionAlert = await screen.findByRole("alert");
    expect(inspectionAlert).toHaveTextContent(/couldn’t inspect this URL/i);
    expect(inspectionAlert).toHaveTextContent(
      "The page did not expose usable metadata.",
    );
    expect(screen.getByRole("button", { name: "Save Resource" })).toBeEnabled();

    await user.type(
      screen.getByRole("textbox", { name: /^tags/i }),
      "research{Enter}",
    );
    await user.click(screen.getByRole("button", { name: "Save Resource" }));

    expect(addResource).toHaveBeenCalledWith({
      url: "https://example.com/resource",
      tags: ["research"],
      notes: undefined,
    });
  });

  it("blocks inspection client-side when the URL is invalid", async () => {
    const user = userEvent.setup();
    render(<LibraryPage />);

    await user.type(
      screen.getByRole("textbox", { name: "Resource URL" }),
      "not-a-url",
    );
    await user.click(screen.getByRole("button", { name: "Inspect URL" }));

    expect(inspectResource).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "Resource URL" }),
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Please enter a valid URL")).toBeInTheDocument();
  });
});
