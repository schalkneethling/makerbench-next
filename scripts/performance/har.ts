import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import * as v from "valibot";

const MAX_ENTRY_COUNT = 50_000;
const MAX_HEADER_COUNT = 512;
const MAX_HEADER_LENGTH = 8_192;
const MAX_METHOD_LENGTH = 32;
const MAX_MIME_TYPE_LENGTH = 512;
const MAX_URL_LENGTH = 8_192;
const MAX_VERSION_LENGTH = 32;
const MAX_DATE_LENGTH = 64;
const MAX_METRIC_VALUE = Number.MAX_SAFE_INTEGER;

const REQUEST_HEADER_ALLOWLIST = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "cache-control",
  "content-length",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "pragma",
  "range",
  "user-agent",
]);

const RESPONSE_HEADER_ALLOWLIST = new Set([
  "age",
  "cache-control",
  "cache-status",
  "cdn-cache-control",
  "cf-cache-status",
  "cloudflare-cdn-cache-control",
  "content-length",
  "content-type",
  "date",
  "etag",
  "expires",
  "last-modified",
  "pragma",
  "server-timing",
  "surrogate-control",
  "vary",
  "x-cache",
  "x-cache-hits",
  "x-vercel-cache",
]);

const SENSITIVE_QUERY_NAME_PARTS = [
  "accesskey",
  "apikey",
  "auth",
  "authorization",
  "clientsecret",
  "codeverifier",
  "credential",
  "jwt",
  "password",
  "passwd",
  "secret",
  "session",
  "signature",
  "token",
];

const boundedString = (maximum: number) =>
  v.pipe(v.string(), v.maxLength(maximum));
const metricSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(-1),
  v.maxValue(MAX_METRIC_VALUE),
);
const sizeSchema = v.pipe(metricSchema, v.integer());

const headerSchema = v.strictObject({
  name: boundedString(MAX_HEADER_LENGTH),
  value: boundedString(MAX_HEADER_LENGTH),
});

const requestHeaderSchema = v.pipe(
  v.array(headerSchema),
  v.maxLength(MAX_HEADER_COUNT),
  v.check(
    (headers) =>
      headers.every(
        ({ name }) =>
          name === name.toLowerCase() && REQUEST_HEADER_ALLOWLIST.has(name),
      ),
    "Request headers must use the allowlist",
  ),
);

const responseHeaderSchema = v.pipe(
  v.array(headerSchema),
  v.maxLength(MAX_HEADER_COUNT),
  v.check(
    (headers) =>
      headers.every(
        ({ name }) =>
          name === name.toLowerCase() && RESPONSE_HEADER_ALLOWLIST.has(name),
      ),
    "Response headers must use the allowlist",
  ),
);

const sanitizedUrlSchema = v.pipe(
  boundedString(MAX_URL_LENGTH),
  v.url(),
  v.check(isSanitizedHttpUrl, "URL contains sensitive data"),
);

const timingSchema = v.strictObject({
  blocked: v.optional(metricSchema),
  dns: v.optional(metricSchema),
  connect: v.optional(metricSchema),
  ssl: v.optional(metricSchema),
  send: v.optional(metricSchema),
  wait: v.optional(metricSchema),
  receive: v.optional(metricSchema),
});

const sanitizedHarSchema = v.strictObject({
  log: v.strictObject({
    version: boundedString(MAX_VERSION_LENGTH),
    creator: v.strictObject({
      name: v.literal("makerbench-har-sanitizer"),
      version: v.literal("1"),
    }),
    entries: v.pipe(
      v.array(
        v.strictObject({
          startedDateTime: v.pipe(
            boundedString(MAX_DATE_LENGTH),
            v.isoTimestamp(),
          ),
          time: metricSchema,
          request: v.strictObject({
            method: boundedString(MAX_METHOD_LENGTH),
            url: sanitizedUrlSchema,
            headers: requestHeaderSchema,
            headersSize: sizeSchema,
            bodySize: sizeSchema,
          }),
          response: v.strictObject({
            status: v.pipe(
              v.number(),
              v.integer(),
              v.minValue(-1),
              v.maxValue(999),
            ),
            headers: responseHeaderSchema,
            content: v.strictObject({
              size: sizeSchema,
              mimeType: boundedString(MAX_MIME_TYPE_LENGTH),
              compression: v.optional(sizeSchema),
            }),
            headersSize: sizeSchema,
            bodySize: sizeSchema,
            transferSize: sizeSchema,
          }),
          timings: timingSchema,
        }),
      ),
      v.maxLength(MAX_ENTRY_COUNT),
    ),
  }),
});

export type SanitizedHar = v.InferOutput<typeof sanitizedHarSchema>;

/**
 * Produces a strict, body-free HAR containing only performance evidence.
 */
export function sanitizeHar(input: unknown): SanitizedHar {
  const root = requireRecord(input, "HAR");
  const log = requireRecord(root.log, "HAR log");
  const entries = requireArray(log.entries, "HAR entries");

  if (entries.length > MAX_ENTRY_COUNT) {
    throw new Error(`HAR contains more than ${MAX_ENTRY_COUNT} entries`);
  }

  const sanitized: SanitizedHar = {
    log: {
      version: requireString(log.version, "HAR log version"),
      creator: {
        name: "makerbench-har-sanitizer",
        version: "1",
      },
      entries: entries.map(sanitizeEntry),
    },
  };

  validateSanitizedHar(sanitized);
  return sanitized;
}

/**
 * Rejects any field or value outside the sanitized HAR contract.
 */
export function validateSanitizedHar(
  input: unknown,
): asserts input is SanitizedHar {
  const result = v.safeParse(sanitizedHarSchema, input);

  if (!result.success) {
    throw new Error(`Invalid sanitized HAR: ${v.summarize(result.issues)}`);
  }
}

/**
 * Sanitizes and exclusively creates a HAR file without replacing existing data.
 */
export async function writeSanitizedHar(
  outputPath: string,
  input: unknown,
): Promise<SanitizedHar> {
  const sanitized = sanitizeHar(input);
  validateSanitizedHar(sanitized);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(sanitized, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });

  return sanitized;
}

function sanitizeEntry(
  value: unknown,
  index: number,
): SanitizedHar["log"]["entries"][number] {
  const entry = requireRecord(value, `HAR entry ${index}`);
  const request = requireRecord(entry.request, `HAR entry ${index} request`);
  const response = requireRecord(entry.response, `HAR entry ${index} response`);
  const content = requireRecord(
    response.content,
    `HAR entry ${index} response content`,
  );

  const headersSize = requireSize(
    response.headersSize,
    `HAR entry ${index} response headersSize`,
  );
  const bodySize = requireSize(
    response.bodySize,
    `HAR entry ${index} response bodySize`,
  );

  return {
    startedDateTime: requireString(
      entry.startedDateTime,
      `HAR entry ${index} startedDateTime`,
    ),
    time: requireMetric(entry.time, `HAR entry ${index} time`),
    request: {
      method: requireString(
        request.method,
        `HAR entry ${index} request method`,
      ),
      url: sanitizeUrl(
        requireString(request.url, `HAR entry ${index} request URL`),
      ),
      headers: sanitizeHeaders(
        request.headers,
        REQUEST_HEADER_ALLOWLIST,
        `HAR entry ${index} request headers`,
      ),
      headersSize: requireSize(
        request.headersSize,
        `HAR entry ${index} request headersSize`,
      ),
      bodySize: requireSize(
        request.bodySize,
        `HAR entry ${index} request bodySize`,
      ),
    },
    response: {
      status: requireInteger(
        response.status,
        `HAR entry ${index} response status`,
      ),
      headers: sanitizeHeaders(
        response.headers,
        RESPONSE_HEADER_ALLOWLIST,
        `HAR entry ${index} response headers`,
      ),
      content: {
        size: requireSize(
          content.size,
          `HAR entry ${index} response content size`,
        ),
        mimeType: requireString(
          content.mimeType,
          `HAR entry ${index} response MIME type`,
        ),
        compression: readOptionalSize(
          content.compression,
          `HAR entry ${index} response content compression`,
        ),
      },
      headersSize,
      bodySize,
      transferSize: readTransferSize(response, headersSize, bodySize, index),
    },
    timings: sanitizeTimings(entry.timings, index),
  };
}

function sanitizeHeaders(
  value: unknown,
  allowlist: ReadonlySet<string>,
  label: string,
): Array<{ name: string; value: string }> {
  const headers = requireArray(value, label);

  if (headers.length > MAX_HEADER_COUNT) {
    throw new Error(`${label} contains more than ${MAX_HEADER_COUNT} headers`);
  }

  return headers.flatMap((value, index) => {
    const header = requireRecord(value, `${label}[${index}]`);
    const name = requireString(header.name, `${label}[${index}].name`);
    const normalizedName = name.toLowerCase();

    if (!allowlist.has(normalizedName)) {
      return [];
    }

    return [
      {
        name: normalizedName,
        value: requireString(header.value, `${label}[${index}].value`),
      },
    ];
  });
}

function sanitizeTimings(
  value: unknown,
  index: number,
): SanitizedHar["log"]["entries"][number]["timings"] {
  const timings = requireRecord(value, `HAR entry ${index} timings`);

  return {
    blocked: readOptionalMetric(timings.blocked, `HAR entry ${index} blocked`),
    dns: readOptionalMetric(timings.dns, `HAR entry ${index} dns`),
    connect: readOptionalMetric(timings.connect, `HAR entry ${index} connect`),
    ssl: readOptionalMetric(timings.ssl, `HAR entry ${index} ssl`),
    send: readOptionalMetric(timings.send, `HAR entry ${index} send`),
    wait: readOptionalMetric(timings.wait, `HAR entry ${index} wait`),
    receive: readOptionalMetric(timings.receive, `HAR entry ${index} receive`),
  };
}

function readTransferSize(
  response: Record<string, unknown>,
  headersSize: number,
  bodySize: number,
  entryIndex: number,
): number {
  const explicitSize = response._transferSize ?? response.transferSize;

  if (explicitSize !== undefined) {
    return requireSize(
      explicitSize,
      `HAR entry ${entryIndex} response transferSize`,
    );
  }

  return headersSize === -1 || bodySize === -1 ? -1 : headersSize + bodySize;
}

function sanitizeUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("HAR request URL must be a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("HAR request URL must use HTTP or HTTPS");
  }

  url.username = "";
  url.password = "";
  url.hash = "";

  const sensitiveNames = [...url.searchParams.keys()].filter(
    isSensitiveQueryName,
  );

  for (const name of sensitiveNames) {
    url.searchParams.delete(name);
  }

  return url.toString();
}

function isSanitizedHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      [...url.searchParams.keys()].every((name) => !isSensitiveQueryName(name))
    );
  } catch {
    return false;
  }
}

function isSensitiveQueryName(name: string): boolean {
  const normalizedName = name.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

  return (
    normalizedName === "code" ||
    normalizedName === "sig" ||
    normalizedName.endsWith("key") ||
    SENSITIVE_QUERY_NAME_PARTS.some((part) => normalizedName.includes(part))
  );
}

function readOptionalMetric(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : requireMetric(value, label);
}

function readOptionalSize(value: unknown, label: string): number | undefined {
  return value === undefined ? undefined : requireSize(value, label);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function requireMetric(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < -1 ||
    value > MAX_METRIC_VALUE
  ) {
    throw new Error(
      `${label} must be a finite HAR metric; received ${String(value)}`,
    );
  }

  return value;
}

function requireInteger(value: unknown, label: string): number {
  const number = requireMetric(value, label);

  if (!Number.isInteger(number)) {
    throw new Error(`${label} must be an integer`);
  }

  return number;
}

function requireSize(value: unknown, label: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value > MAX_METRIC_VALUE
  ) {
    throw new Error(
      `${label} must be a finite HAR size; received ${String(value)}`,
    );
  }

  return value < 0 ? -1 : value;
}
