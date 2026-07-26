import { describe, expect, it } from "vitest";

import { mergeSanitizedHars, parseCaptureOptions } from "../capture.ts";
import { sanitizeHar } from "../har.ts";

function createRawHar(url: string) {
  return {
    log: {
      version: "1.2",
      entries: [
        {
          startedDateTime: "2026-07-26T12:00:00.000Z",
          time: 100,
          request: {
            method: "GET",
            url,
            headers: [],
            headersSize: 100,
            bodySize: 0,
          },
          response: {
            status: 200,
            headers: [],
            content: {
              size: 200,
              mimeType: "text/html",
            },
            headersSize: 100,
            bodySize: 200,
            _transferSize: 300,
          },
          timings: {
            send: 1,
            wait: 90,
            receive: 9,
          },
        },
      ],
    },
  };
}

describe("parseCaptureOptions", () => {
  it("uses the production five-run defaults", () => {
    const options = parseCaptureOptions([]);

    expect(options.target.toString()).toBe(
      "https://makerbench.schalkneethling.com/",
    );
    expect(options.runCount).toBe(5);
    expect(options.baselineDate).toBeUndefined();
  });

  it("accepts bounded overrides and rejects unsafe targets", () => {
    expect(
      parseCaptureOptions([
        "--",
        "--target=https://example.com",
        "--runs=2",
        "--baseline=2026-07-26",
      ]),
    ).toMatchObject({
      runCount: 2,
      baselineDate: "2026-07-26",
    });

    expect(() =>
      parseCaptureOptions(["--target=https://user:secret@example.com"]),
    ).toThrow("without credentials");
    expect(() => parseCaptureOptions(["--runs=0"])).toThrow("between 1 and 20");
    expect(() => parseCaptureOptions(["--baseline=2026-02-30"])).toThrow(
      "real calendar date",
    );
  });
});

describe("mergeSanitizedHars", () => {
  it("combines validated context entries for one device", () => {
    const merged = mergeSanitizedHars([
      sanitizeHar(createRawHar("https://example.com/first")),
      sanitizeHar(createRawHar("https://example.com/second")),
    ]);

    expect(merged.log.entries.map((entry) => entry.request.url)).toEqual([
      "https://example.com/first",
      "https://example.com/second",
    ]);
  });

  it("rejects an empty device capture", () => {
    expect(() => mergeSanitizedHars([])).toThrow("At least one sanitized HAR");
  });
});
