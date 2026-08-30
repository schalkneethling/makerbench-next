import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { sanitizeHar, validateSanitizedHar, writeSanitizedHar } from "../har";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function createHar() {
  return {
    log: {
      version: "1.2",
      creator: {
        name: "Playwright",
        version: "1.60.0",
      },
      pages: [
        {
          title: "Potentially private page title",
        },
      ],
      entries: [
        {
          startedDateTime: "2026-07-26T10:00:00.000Z",
          time: 123.5,
          request: {
            method: "GET",
            url: "https://user:password@example.com/search?q=css&Api_Key=top-secret&OAuth_Code=private&Ocp-Apim-Subscription-Key=another-secret#token=fragment-secret",
            httpVersion: "HTTP/2",
            headers: [
              { name: "AcCePt", value: "text/html" },
              { name: "CoOkIe", value: "session=private-cookie" },
              { name: "AUTHORIZATION", value: "Bearer private-token" },
              { name: "X-aPi-KeY", value: "private-api-key" },
              { name: "X-Unlisted", value: "private-unlisted-value" },
            ],
            cookies: [{ name: "session", value: "private-cookie" }],
            queryString: [
              { name: "q", value: "css" },
              { name: "Api_Key", value: "top-secret" },
            ],
            postData: {
              mimeType: "application/json",
              text: '{"token":"private-body-token"}',
            },
            headersSize: 200,
            bodySize: 20,
          },
          response: {
            status: 200,
            statusText: "OK",
            httpVersion: "HTTP/2",
            headers: [
              { name: "Cache-Control", value: "public, max-age=3600" },
              { name: "CACHE-STATUS", value: "hit" },
              { name: "sErVeR-TiMiNg", value: "app;dur=12" },
              { name: "SeT-CoOkIe", value: "session=private-response-cookie" },
              { name: "X-Internal-Token", value: "private-response-token" },
            ],
            cookies: [{ name: "session", value: "private-response-cookie" }],
            content: {
              size: 1_024,
              mimeType: "text/html",
              compression: 256,
              text: "<html>private response body</html>",
              encoding: "base64",
              _file: "private-response-body.txt",
            },
            redirectURL: "https://example.com/?token=private-redirect-token",
            headersSize: 300,
            bodySize: 768,
            _transferSize: 1_068,
          },
          cache: {
            beforeRequest: {
              eTag: "private-cache-data",
            },
          },
          timings: {
            blocked: 1,
            dns: 2,
            connect: 3,
            ssl: 1.5,
            send: 4,
            wait: 100,
            receive: 13.5,
            comment: "private timing comment",
          },
          comment: "private entry comment",
        },
      ],
    },
  };
}

describe("sanitizeHar", () => {
  it("retains sanitized first-party and third-party entries", () => {
    const har = createHar();
    const thirdPartyEntry = har.log.entries[0];
    if (!thirdPartyEntry) {
      throw new Error("HAR fixture must contain an entry.");
    }

    har.log.entries.push({
      ...thirdPartyEntry,
      request: {
        ...thirdPartyEntry.request,
        url: "https://makerbench.schalkneethling.com/assets/app.js",
      },
    });

    expect(
      sanitizeHar(har).log.entries.map((entry) => entry.request.url),
    ).toEqual([
      "https://example.com/search?q=css",
      "https://makerbench.schalkneethling.com/assets/app.js",
    ]);
  });

  it("retains performance evidence and only allowlisted headers", () => {
    const result = sanitizeHar(createHar());
    const [entry] = result.log.entries;

    expect(entry).toMatchObject({
      startedDateTime: "2026-07-26T10:00:00.000Z",
      time: 123.5,
      request: {
        method: "GET",
        url: "https://example.com/search?q=css",
        headers: [{ name: "accept", value: "text/html" }],
        headersSize: 200,
        bodySize: 20,
      },
      response: {
        status: 200,
        headers: [
          { name: "cache-control", value: "public, max-age=3600" },
          { name: "cache-status", value: "hit" },
          { name: "server-timing", value: "app;dur=12" },
        ],
        content: {
          size: 1_024,
          mimeType: "text/html",
          compression: 256,
        },
        headersSize: 300,
        bodySize: 768,
        transferSize: 1_068,
      },
      timings: {
        blocked: 1,
        dns: 2,
        connect: 3,
        ssl: 1.5,
        send: 4,
        wait: 100,
        receive: 13.5,
      },
    });
  });

  it("does not allow sensitive fields or values to survive odd casing", () => {
    const serialized = JSON.stringify(sanitizeHar(createHar()));

    expect(serialized).not.toMatch(
      /private|cookie|authorization|api[_-]?key|postData|response body|set-cookie/i,
    );
    expect(serialized).not.toContain('"text":');
    expect(serialized).not.toContain("OAuth_Code");
    expect(serialized).not.toContain("#");
  });

  it("derives transfer size when Playwright does not provide an extension", () => {
    const har = createHar();
    Reflect.deleteProperty(har.log.entries[0].response, "_transferSize");

    expect(sanitizeHar(har).log.entries[0].response.transferSize).toBe(1_068);
  });

  it("normalizes Playwright negative size calculations to unknown", () => {
    const har = createHar();
    har.log.entries[0].response.bodySize = -675;

    const sanitized = sanitizeHar(har);

    expect(sanitized.log.entries[0].response.bodySize).toBe(-1);
  });

  it("fails closed for malformed HAR input", () => {
    expect(() =>
      sanitizeHar({ log: { version: "1.2", entries: [{}] } }),
    ).toThrow("request must be an object");
    expect(() => sanitizeHar({ log: { version: "1.2" } })).toThrow(
      "entries must be an array",
    );
  });
});

describe("validateSanitizedHar", () => {
  it("rejects forbidden headers, cookies, response bodies, and sensitive URLs", () => {
    const valid = sanitizeHar(createHar());
    const entry = valid.log.entries[0];

    const withAuthorization = {
      ...valid,
      log: {
        ...valid.log,
        entries: [
          {
            ...entry,
            request: {
              ...entry.request,
              headers: [{ name: "AuThOrIzAtIoN", value: "Bearer secret" }],
            },
          },
        ],
      },
    };
    const withCookies = {
      ...valid,
      log: {
        ...valid.log,
        entries: [
          {
            ...entry,
            request: {
              ...entry.request,
              cookies: [{ name: "session", value: "secret" }],
            },
          },
        ],
      },
    };
    const withResponseBody = {
      ...valid,
      log: {
        ...valid.log,
        entries: [
          {
            ...entry,
            response: {
              ...entry.response,
              content: {
                ...entry.response.content,
                text: "secret response body",
              },
            },
          },
        ],
      },
    };
    const withSensitiveUrl = {
      ...valid,
      log: {
        ...valid.log,
        entries: [
          {
            ...entry,
            request: {
              ...entry.request,
              url: "https://example.com/?ToKeN=secret",
            },
          },
        ],
      },
    };

    expect(() => validateSanitizedHar(withAuthorization)).toThrow(
      "Invalid sanitized HAR",
    );
    expect(() => validateSanitizedHar(withCookies)).toThrow(
      "Invalid sanitized HAR",
    );
    expect(() => validateSanitizedHar(withResponseBody)).toThrow(
      "Invalid sanitized HAR",
    );
    expect(() => validateSanitizedHar(withSensitiveUrl)).toThrow(
      "Invalid sanitized HAR",
    );
  });
});

describe("writeSanitizedHar", () => {
  it("validates before writing and never overwrites an existing artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "makerbench-har-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "baseline.har");

    await expect(writeSanitizedHar(outputPath, {})).rejects.toThrow(
      "HAR log must be an object",
    );
    await expect(readFile(outputPath, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });

    await writeSanitizedHar(outputPath, createHar());
    const firstArtifact = await readFile(outputPath, "utf8");

    await expect(
      writeSanitizedHar(outputPath, createHar()),
    ).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(outputPath, "utf8")).toBe(firstArtifact);
  });

  it("does not replace a file created outside the sanitizer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "makerbench-har-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "baseline.har");
    await writeFile(outputPath, "existing evidence", "utf8");

    await expect(
      writeSanitizedHar(outputPath, createHar()),
    ).rejects.toMatchObject({
      code: "EEXIST",
    });
    expect(await readFile(outputPath, "utf8")).toBe("existing evidence");
  });
});
