import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "../../test/mocks/server";
import { useTags } from "../useTags";

const mockTags = [
  { id: "t1", name: "javascript", usageCount: 3 },
  { id: "t2", name: "react", usageCount: 2 },
];

const requestSpy = vi.fn();

beforeEach(() => {
  requestSpy.mockReset();
  server.use(
    http.get("/api/tags", ({ request }) => {
      const url = new URL(request.url);
      requestSpy(url.searchParams.get("limit"));

      return HttpResponse.json({
        success: true,
        data: {
          tags: mockTags,
        },
      });
    }),
  );
});

afterEach(() => {
  server.resetHandlers();
});

describe("useTags", () => {
  it("does not fetch until enabled", () => {
    const { result } = renderHook(() => useTags({ enabled: false, limit: 10 }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tags).toEqual([]);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("fetches tags when enabled and forwards limit", async () => {
    const { result } = renderHook(() => useTags({ enabled: true, limit: 10 }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tags).toEqual(mockTags);
    expect(requestSpy).toHaveBeenCalledWith("10");
  });
});
