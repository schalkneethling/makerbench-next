import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { server } from "../../test/mocks/server";
import {
  createSubmissionBlocklistRule,
  deleteSubmissionBlocklistRule,
  getSubmissionBlocklist,
} from "../admin";

const API_BASE = "http://localhost:8888";
const entry = {
  id: "11111111-1111-4111-8111-111111111111",
  matchType: "domain",
  value: "www.example.com",
  normalizedValue: "example.com",
  createdAt: "2026-07-14T08:00:00.000Z",
};
const recentEvent = {
  id: "22222222-2222-4222-8222-222222222222",
  normalizedUrl: "https://example.com/blocked",
  matchedType: "domain",
  matchedValue: "example.com",
  createdAt: "2026-07-14T08:30:00.000Z",
};

beforeEach(() => {
  server.use(
    http.get(`${API_BASE}/api/admin/blocklist`, () =>
      HttpResponse.json({
        success: true,
        data: { entries: [entry], recentEvents: [recentEvent] },
      }),
    ),
    http.post(`${API_BASE}/api/admin/blocklist`, () =>
      HttpResponse.json({ success: true, data: entry }, { status: 201 }),
    ),
    http.delete(`${API_BASE}/api/admin/blocklist`, () =>
      HttpResponse.json({ success: true, data: { id: entry.id } }),
    ),
  );
});

afterEach(() => server.resetHandlers());

describe("submission blocklist API", () => {
  it("lists and validates blocklist entries", async () => {
    await expect(getSubmissionBlocklist("admin-token")).resolves.toEqual({
      entries: [entry],
      recentEvents: [recentEvent],
    });
  });

  it("sends authenticated create requests", async () => {
    let authorization: string | null = null;
    let requestBody: unknown;
    server.use(
      http.post(`${API_BASE}/api/admin/blocklist`, async ({ request }) => {
        authorization = request.headers.get("Authorization");
        requestBody = await request.json();
        return HttpResponse.json(
          { success: true, data: entry },
          { status: 201 },
        );
      }),
    );

    await createSubmissionBlocklistRule("admin-token", {
      matchType: "domain",
      value: "www.example.com",
    });

    expect(authorization).toBe("Bearer admin-token");
    expect(requestBody).toEqual({
      matchType: "domain",
      value: "www.example.com",
    });
  });

  it("throws a typed error when creating a rule fails", async () => {
    server.use(
      http.post(`${API_BASE}/api/admin/blocklist`, () =>
        HttpResponse.json(
          { success: false, error: "This blocklist rule already exists" },
          { status: 409 },
        ),
      ),
    );

    await expect(
      createSubmissionBlocklistRule("admin-token", {
        matchType: "domain",
        value: "example.com",
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "This blocklist rule already exists",
    });
  });

  it("sends authenticated delete requests", async () => {
    let authorization: string | null = null;
    let requestBody: unknown;
    server.use(
      http.delete(`${API_BASE}/api/admin/blocklist`, async ({ request }) => {
        authorization = request.headers.get("Authorization");
        requestBody = await request.json();
        return HttpResponse.json({ success: true, data: { id: entry.id } });
      }),
    );

    await deleteSubmissionBlocklistRule("admin-token", entry.id);

    expect(authorization).toBe("Bearer admin-token");
    expect(requestBody).toEqual({ id: entry.id });
  });

  it("rejects malformed success responses", async () => {
    server.use(
      http.get(`${API_BASE}/api/admin/blocklist`, () =>
        HttpResponse.json({
          success: true,
          data: { entries: [{ id: "invalid" }] },
        }),
      ),
    );

    await expect(getSubmissionBlocklist("admin-token")).rejects.toMatchObject({
      status: 500,
      message: "Invalid response from server",
    });
  });
});
