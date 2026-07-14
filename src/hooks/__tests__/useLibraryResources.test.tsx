import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    getLibraryResources: vi.fn(),
    inspectLibraryResource: vi.fn(),
  };
});

import {
  getLibraryResources,
  inspectLibraryResource,
  type LibraryInspection,
} from "../../api";
import { useLibraryResources } from "../useLibraryResources";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useLibraryResources inspection cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLibraryResources).mockResolvedValue({ resources: [] });
  });

  it("invalidates an in-flight inspection when the access token changes", async () => {
    const pendingInspection = deferred<LibraryInspection>();
    vi.mocked(inspectLibraryResource).mockReturnValue(
      pendingInspection.promise,
    );
    const { result, rerender } = renderHook(
      ({ accessToken }) => useLibraryResources(accessToken),
      { initialProps: { accessToken: "first-token" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let inspectionPromise!: Promise<LibraryInspection | null>;
    act(() => {
      inspectionPromise = result.current.inspectResource(
        "https://example.com/resource",
      );
    });
    rerender({ accessToken: "second-token" });
    pendingInspection.resolve({ title: "Stale", description: null });

    await expect(inspectionPromise).resolves.toBeNull();
  });

  it("invalidates an in-flight inspection on unmount", async () => {
    const pendingInspection = deferred<LibraryInspection>();
    vi.mocked(inspectLibraryResource).mockReturnValue(
      pendingInspection.promise,
    );
    const { result, unmount } = renderHook(() =>
      useLibraryResources("verified-token"),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let inspectionPromise!: Promise<LibraryInspection | null>;
    act(() => {
      inspectionPromise = result.current.inspectResource(
        "https://example.com/resource",
      );
    });
    unmount();
    pendingInspection.resolve({ title: "Stale", description: null });

    await expect(inspectionPromise).resolves.toBeNull();
  });
});
