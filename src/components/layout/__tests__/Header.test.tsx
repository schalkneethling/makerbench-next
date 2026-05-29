import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { Header } from "../Header";
import { useAuth } from "../../../hooks";

vi.mock("../../../hooks", () => ({
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

function renderHeader(authOverrides = {}) {
  vi.mocked(useAuth).mockReturnValue({
    ...authDefaults,
    ...authOverrides,
  });

  render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header", () => {
  it("renders sign-in actions for guests", () => {
    renderHeader();

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Library" })).not.toBeInTheDocument();
  });

  it("renders library navigation and admin state for admin users", () => {
    renderHeader({
      identity: {
        user: {
          id: "user-1",
          email: "test@example.com",
          displayName: "Test User",
          avatarUrl: null,
        },
        isAdmin: true,
      },
      isAdmin: true,
      isAuthenticated: true,
    });

    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute(
      "href",
      "/library",
    );
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });
});
