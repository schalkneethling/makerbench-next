import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { PublicSubmissionApiError } from "../../api";
import { server } from "../../test/mocks/server";
import { usePublicSubmission } from "../usePublicSubmission";

const submittedItemId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  server.use(
    http.post("/api/submissions", async ({ request }) => {
      const body = (await request.json()) as { url?: string; type?: string };
      if (!body.url) {
        return HttpResponse.json(
          {
            success: false,
            error: "Validation failed",
            details: { url: ["URL is required"] },
          },
          { status: 422 },
        );
      }

      return HttpResponse.json(
        {
          success: true,
          data: {
            submittedItemId,
            type: body.type,
            status: "pending",
            message: "Submission received for review.",
          },
        },
        { status: 201 },
      );
    }),
  );
});

describe("usePublicSubmission", () => {
  it("submits successfully and stores the response", async () => {
    const { result } = renderHook(() => usePublicSubmission());

    await act(async () => {
      await result.current.submit({
        type: "resource",
        url: "https://example.com/reference",
        tags: ["accessibility"],
      });
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.response).toMatchObject({
      submittedItemId,
      type: "resource",
      status: "pending",
    });
  });

  it("stores typed validation errors and details", async () => {
    const { result } = renderHook(() => usePublicSubmission());

    await act(async () => {
      await result.current.submit({ type: "tool", url: "", tags: ["testing"] });
    });

    expect(result.current.error).toBeInstanceOf(PublicSubmissionApiError);
    expect(result.current.error).toMatchObject({
      status: 422,
      details: { url: ["URL is required"] },
    });
    expect(result.current.response).toBeNull();
  });

  it("aborts an active request when reset without surfacing an error", async () => {
    server.use(
      http.post("/api/submissions", async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    const { result } = renderHook(() => usePublicSubmission());
    let submission!: Promise<unknown>;

    act(() => {
      submission = result.current.submit({
        type: "tool",
        url: "https://example.com/tool",
        tags: ["testing"],
      });
    });

    expect(result.current.isSubmitting).toBe(true);

    act(() => {
      result.current.reset();
    });

    await act(async () => {
      await submission;
    });
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.response).toBeNull();
  });
});
