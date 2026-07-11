import { describe, expect, it } from "vitest";

import {
  dependencyUnavailable,
  methodNotAllowed,
  ok,
  tooManyRequests,
} from "../responses";

describe("JSON response headers", () => {
  it.each([
    ["success", () => ok({ ready: true })],
    ["rate limited", tooManyRequests],
    ["dependency unavailable", dependencyUnavailable],
    ["method not allowed", () => methodNotAllowed(["POST"])],
  ])("sets nosniff for %s responses", (_name, createResponse) => {
    const response = createResponse();

    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
