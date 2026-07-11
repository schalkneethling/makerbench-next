import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api")>();
  return {
    ...actual,
    getResources: vi.fn(),
  };
});

import { getResources, type Resource, type ResourcesResponse } from "../../api";
import { useResources } from "../useResources";

const approvedResource: Resource = {
  id: "resource-1",
  url: "https://example.com/resource-1",
  title: "Resource One",
  description: "A public resource",
  tags: [{ id: "reference", name: "reference" }],
  createdAt: "2026-07-11T10:00:00.000Z",
  kind: "resource",
};

const mockedGetResources = vi.mocked(getResources);

function createResponse(resources: Resource[]): ResourcesResponse {
  return {
    resources,
    pagination: {
      total: resources.length,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetResources.mockResolvedValue(createResponse([approvedResource]));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useResources", () => {
  it("performs one successful initial fetch through Strict Mode replay", async () => {
    const { result } = renderHook(() => useResources(), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => {
      expect(result.current.resources).toEqual([approvedResource]);
    });

    expect(mockedGetResources).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("does not start the queued initial fetch after unmount", () => {
    const scheduledCallbacks: VoidFunction[] = [];
    const queueMicrotaskSpy = vi
      .spyOn(globalThis, "queueMicrotask")
      .mockImplementation((callback) => {
        scheduledCallbacks.push(callback);
      });

    const { unmount } = renderHook(() => useResources());
    expect(scheduledCallbacks).toHaveLength(1);

    unmount();
    act(() => {
      scheduledCallbacks[0]();
    });

    expect(mockedGetResources).not.toHaveBeenCalled();
    queueMicrotaskSpy.mockRestore();
  });

  it("aborts an active initial request on unmount", async () => {
    const pendingRequest = createDeferred<ResourcesResponse>();
    let requestSignal: AbortSignal | undefined;
    mockedGetResources.mockImplementation((_params, options) => {
      requestSignal = options?.signal;
      return pendingRequest.promise;
    });

    const { unmount } = renderHook(() => useResources());
    await waitFor(() => {
      expect(mockedGetResources).toHaveBeenCalledTimes(1);
    });

    expect(requestSignal?.aborted).toBe(false);
    unmount();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("ignores an older response after a newer fetch starts", async () => {
    const { result } = renderHook(() => useResources());
    await waitFor(() => {
      expect(result.current.resources).toEqual([approvedResource]);
    });

    const olderRequest = createDeferred<ResourcesResponse>();
    const newerRequest = createDeferred<ResourcesResponse>();
    let olderSignal: AbortSignal | undefined;
    mockedGetResources
      .mockImplementationOnce((_params, options) => {
        olderSignal = options?.signal;
        return olderRequest.promise;
      })
      .mockImplementationOnce(() => newerRequest.promise);

    act(() => {
      void result.current.fetch({ offset: 20 });
    });
    act(() => {
      void result.current.fetch({ offset: 40 });
    });

    expect(olderSignal?.aborted).toBe(true);

    const newerResource = {
      ...approvedResource,
      id: "resource-newer",
      title: "Newer Resource",
    };
    await act(async () => {
      newerRequest.resolve(createResponse([newerResource]));
      await newerRequest.promise;
    });

    expect(result.current.resources).toEqual([newerResource]);

    await act(async () => {
      olderRequest.resolve(
        createResponse([
          {
            ...approvedResource,
            id: "resource-older",
            title: "Older Resource",
          },
        ]),
      );
      await olderRequest.promise;
    });

    expect(result.current.resources).toEqual([newerResource]);
  });
});
