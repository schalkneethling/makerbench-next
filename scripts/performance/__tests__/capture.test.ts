import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import {
  mergeSanitizedHars,
  parseCaptureOptions,
  writeCaptureFailureEvidence,
  writeSanitizedHarArchive,
} from "../capture.ts";
import { sanitizeHar } from "../har.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

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
            headers: [
              {
                name: "Authorization",
                value: "Bearer private-token",
              },
            ],
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
    expect(parseCaptureOptions(["--artifact=ci_42"])).toMatchObject({
      artifactId: "ci_42",
    });
    expect(() => parseCaptureOptions(["--artifact=../private"])).toThrow(
      "artifact id",
    );
    expect(() =>
      parseCaptureOptions(["--baseline=2026-07-26", "--artifact=ci"]),
    ).toThrow("cannot combine");
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

describe("failure checkpoints", () => {
  it("keeps a sanitized HAR and redacted failure evidence", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "makerbench-capture-failure-"),
    );
    temporaryDirectories.push(directory);

    const rawHar = createRawHar(
      "https://user:password@example.com/?token=private-token&q=css#private",
    );

    const harPath = join(directory, "checkpoints", "desktop-1.har.zip");
    await writeSanitizedHarArchive(harPath, rawHar);
    const archive = unzipSync(await readFile(harPath));
    const serializedHar = strFromU8(
      archive["desktop-1.har"] ?? new Uint8Array(),
    );

    const failurePath = join(directory, "failure.json");
    await writeCaptureFailureEvidence(failurePath, {
      target: new URL("https://example.com"),
      capturedAt: "2026-08-30T10:00:00.000Z",
      runCount: 5,
      completedRunCount: 0,
      stage: "scenario",
      device: "desktop",
      run: 1,
      error: new Error(
        "redirected to https://example.com/?token=private-token",
      ),
    });
    const serializedFailure = await readFile(failurePath, "utf8");

    expect(serializedHar).toContain("https://example.com/?q=css");
    expect(serializedHar).not.toMatch(/private|password|authorization|token/i);
    expect(serializedFailure).toContain('"status": "failed"');
    expect(serializedFailure).toContain('"completedRunCount": 0');
    expect(serializedFailure).not.toMatch(/private-token|redirected to/i);
  });
});
