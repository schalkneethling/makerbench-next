import { delay, http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { server } from "../../test/mocks/server";
import {
  PublicSubmissionApiError,
  submitPublicSubmission,
} from "../submissions";

const API_BASE = "http://localhost:8888";
const submittedItemId = "11111111-1111-4111-8111-111111111111";

function createSubmissionHandler() {
  return http.post(`${API_BASE}/api/submissions`, async ({ request }) => {
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

    if (body.url === "https://example.com/duplicate") {
      return HttpResponse.json(
        { success: false, error: "This URL has already been submitted" },
        { status: 409 },
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
  });
}

beforeEach(() => {
  server.use(createSubmissionHandler());
});

afterEach(() => {
  server.resetHandlers();
});

describe("submitPublicSubmission", () => {
  it("submits a resource and returns validated response data", async () => {
    const result = await submitPublicSubmission({
      type: "resource",
      url: "https://example.com/reference",
      tags: ["accessibility"],
    });

    expect(result).toEqual({
      submittedItemId,
      type: "resource",
      status: "pending",
      message: "Submission received for review.",
    });
  });

  it("sends an access token when provided", async () => {
    let authorization: string | null = null;
    server.use(
      http.post(`${API_BASE}/api/submissions`, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json(
          {
            success: true,
            data: {
              submittedItemId,
              type: "tool",
              status: "pending",
              message: "Tool submitted.",
            },
          },
          { status: 201 },
        );
      }),
    );

    await submitPublicSubmission(
      { type: "tool", url: "https://example.com/tool", tags: ["testing"] },
      { accessToken: "signed-in-token" },
    );

    expect(authorization).toBe("Bearer signed-in-token");
  });

  it("throws a typed validation error with structured details", async () => {
    await expect(
      submitPublicSubmission({ type: "resource", url: "", tags: ["testing"] }),
    ).rejects.toMatchObject({
      name: "PublicSubmissionApiError",
      status: 422,
      message: "Validation failed",
      details: { url: ["URL is required"] },
    });
  });

  it("throws a typed conflict error", async () => {
    await expect(
      submitPublicSubmission({
        type: "tool",
        url: "https://example.com/duplicate",
        tags: ["testing"],
      }),
    ).rejects.toMatchObject({
      name: "PublicSubmissionApiError",
      status: 409,
      message: "This URL has already been submitted",
    });
  });

  it("preserves safe diagnostic codes from unavailable submission responses", async () => {
    server.use(
      http.post(`${API_BASE}/api/submissions`, () =>
        HttpResponse.json(
          { success: false, error: "Service temporarily unavailable" },
          {
            status: 503,
            headers: {
              "X-MakerBench-Error-Code": "submission-rate-limit-store-unavailable",
            },
          },
        ),
      ),
    );

    await expect(
      submitPublicSubmission({
        type: "resource",
        url: "https://example.com/reference",
        tags: ["testing"],
      }),
    ).rejects.toMatchObject({
      name: "PublicSubmissionApiError",
      status: 503,
      message: "Service temporarily unavailable",
      code: "submission-rate-limit-store-unavailable",
    });
  });

  it("rejects malformed success payloads with a typed error", async () => {
    server.use(
      http.post(`${API_BASE}/api/submissions`, () =>
        HttpResponse.json(
          { success: true, data: { type: "article" } },
          { status: 201 },
        ),
      ),
    );

    const submission = submitPublicSubmission({
      type: "resource",
      url: "https://example.com/reference",
      tags: ["testing"],
    });

    await expect(submission).rejects.toEqual(
      expect.any(PublicSubmissionApiError),
    );
    await expect(submission).rejects.toMatchObject({
      status: 500,
      message: "Invalid response from server",
    });
  });

  it("passes abort behavior through without wrapping it", async () => {
    server.use(
      http.post(`${API_BASE}/api/submissions`, async () => {
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    const submission = submitPublicSubmission(
      {
        type: "tool",
        url: "https://example.com/tool",
        tags: ["testing"],
      },
      { signal: controller.signal },
    );

    controller.abort();

    await expect(submission).rejects.toMatchObject({ name: "AbortError" });
  });
});
