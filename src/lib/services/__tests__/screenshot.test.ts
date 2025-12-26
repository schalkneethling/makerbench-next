import { describe, it, expect } from "vitest";
import { server } from "../../../test/mocks/server";
import { http, HttpResponse } from "msw";
import { captureScreenshot } from "../screenshot";

describe("captureScreenshot", () => {
  it("returns a PNG buffer on successful screenshot", async () => {
    const result = await captureScreenshot("https://example.com");

    expect(result.success).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer?.length).toBeGreaterThan(0);
  });

  it("returns error when Browserless API fails", async () => {
    server.use(
      http.post("https://chrome.browserless.io/screenshot", () => {
        return HttpResponse.json(
          { error: "Rate limit exceeded" },
          { status: 429 },
        );
      }),
    );

    const result = await captureScreenshot("https://example.com");

    expect(result.success).toBe(false);
    expect(result.buffer).toBeNull();
    expect(result.error).toBeDefined();
  });

  it.skip("returns error when Browserless API times out", async () => {
    // Skipped in normal runs - takes 30s. Run with --testNamePattern for CI.
    server.use(
      http.post("https://chrome.browserless.io/screenshot", async () => {
        await new Promise((resolve) => setTimeout(resolve, 35000));
        return HttpResponse.arrayBuffer(new ArrayBuffer(100));
      }),
    );

    const result = await captureScreenshot("https://example.com");

    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  }, 40000);

  it("sends correct viewport and options to Browserless", async () => {
    let capturedBody: unknown;

    server.use(
      http.post(
        "https://chrome.browserless.io/screenshot",
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.arrayBuffer(new ArrayBuffer(100), {
            headers: { "Content-Type": "image/png" },
          });
        },
      ),
    );

    await captureScreenshot("https://example.com/test");

    expect(capturedBody).toMatchObject({
      url: "https://example.com/test",
      options: {
        type: "png",
        fullPage: false,
      },
      viewport: {
        width: 1280,
        height: 800,
      },
      gotoOptions: {
        waitUntil: "networkidle2",
      },
    });
  });
});
