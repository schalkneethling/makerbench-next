import type { BaseIssue } from "valibot";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { type AuthenticatedUser, verifyAuthenticatedUser } from "./auth";
import { getDb } from "./db";
import { assertRequiredEnv, handleMissingEnvironmentError } from "./env";
import {
  conflict,
  created,
  methodNotAllowed,
  serverError,
  unauthorized,
  validationError,
} from "./responses";
import { captureError, flushSentry, initSentry } from "./sentry";
import { normalizeUrl, parseAndNormalizeUrl } from "./url";
import {
  publicListingsTable,
  resourcesTable,
  toolListingsTable,
} from "../../../src/db/schema";
import { uploadScreenshot } from "../../../src/lib/services/cloudinary";
import {
  type MetadataResult,
  extractMetadata,
} from "../../../src/lib/services/metadata";
import { captureScreenshot } from "../../../src/lib/services/screenshot";
import {
  type PublicSubmissionRequest,
  type PublicSubmissionType,
  validatePublicSubmissionRequest,
} from "../../../src/lib/validation";
import { getGithubUsernameFromProfileUrl } from "../../../src/lib/github";

const FALLBACK_IMAGE = "/makerbench-fallback.png";
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
]);
const PUBLIC_URL_ERROR = "Please enter a publicly reachable HTTP/HTTPS URL";
const BLOCKED_IPV4_RANGES: readonly [
  baseAddress: string,
  prefixLength: number,
][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

type PublicListingSubmissionType = Exclude<PublicSubmissionType, "tool">;

interface PublicSubmissionOptions {
  endpointName: string;
  allowedTypes?: readonly PublicSubmissionType[];
  rejectedTypeDetails?: Record<string, string[]>;
}

interface SubmissionContext {
  authenticated: AuthenticatedUser | null;
  normalizedSubmitterGithubUrl: string | undefined;
  normalizedSubmitterName: string | undefined;
  normalizedUrl: string;
  submission: PublicSubmissionRequest;
  tags: string[];
}

function getIssueField(issue: BaseIssue<unknown>): string {
  const path = issue.path
    ?.map((pathItem) => pathItem.key)
    .filter(
      (key): key is string | number =>
        typeof key === "string" || typeof key === "number",
    );

  return path && path.length > 0 ? path.join(".") : "form";
}

function getValidationDetails(
  issues: readonly BaseIssue<unknown>[],
): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = getIssueField(issue);
    details[field] ??= [];
    details[field].push(issue.message);
    return details;
  }, {});
}

function requestHasBearerToken(req: Request): boolean {
  const header = req.headers.get("Authorization");
  return Boolean(
    header?.startsWith("Bearer ") && header.slice("Bearer ".length).trim(),
  );
}

async function getOptionalAuthenticatedUser(
  req: Request,
  endpointName: string,
): Promise<AuthenticatedUser | null | Response> {
  if (!requestHasBearerToken(req)) {
    return null;
  }

  try {
    assertRequiredEnv(["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, endpointName);
  }

  const authenticated = await verifyAuthenticatedUser(req);
  return authenticated ?? unauthorized("Invalid authentication token");
}

function normalizeTags(tags: string[]): string[] {
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0),
    ),
  ];
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function getHostname(url: URL): string {
  return url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

function ipv4ToNumber(address: string): number | null {
  const octets = address.split(".").map((octet) => Number(octet));

  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }

  return octets.reduce((value, octet) => value * 256 + octet, 0) >>> 0;
}

function isIpv4InRange(
  address: string,
  baseAddress: string,
  prefixLength: number,
): boolean {
  const addressNumber = ipv4ToNumber(address);
  const baseNumber = ipv4ToNumber(baseAddress);

  if (addressNumber === null || baseNumber === null) {
    return false;
  }

  const mask =
    prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (addressNumber & mask) === (baseNumber & mask);
}

function isBlockedIpv4Address(address: string): boolean {
  return BLOCKED_IPV4_RANGES.some(([baseAddress, prefixLength]) =>
    isIpv4InRange(address, baseAddress, prefixLength),
  );
}

function isBlockedIpv6Address(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  const mappedIpv4 = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4?.[1]) {
    return isBlockedIpv4Address(mappedIpv4[1]);
  }

  const firstHextet = Number.parseInt(
    normalizedAddress.split(":")[0] || "0",
    16,
  );
  return (
    normalizedAddress === "::" ||
    normalizedAddress === "::1" ||
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xff00) === 0xff00
  );
}

function isBlockedIpAddress(address: string): boolean {
  const ipVersion = isIP(address);

  if (ipVersion === 4) {
    return isBlockedIpv4Address(address);
  }

  if (ipVersion === 6) {
    return isBlockedIpv6Address(address);
  }

  return false;
}

async function resolvePublicHttpUrl(value: string): Promise<string | null> {
  const url = parseHttpUrl(value);
  if (!url) {
    return null;
  }

  const hostname = getHostname(url);
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    isBlockedIpAddress(hostname)
  ) {
    return null;
  }

  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true }).catch(() => []);
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => isBlockedIpAddress(address))
    ) {
      return null;
    }
  }

  return url.href;
}

/** Builds a canonical GitHub profile URL from either a submitted URL or username. */
function normalizeSubmitterGithubUrl(
  submission: PublicSubmissionRequest,
): string | undefined {
  const submittedUrl = submission.submitterGithubUrl?.trim();
  if (submittedUrl) {
    const username = getGithubUsernameFromProfileUrl(submittedUrl);
    return username ? `https://github.com/${username}` : undefined;
  }

  const username = submission.submitterGithubUsername?.trim();
  return username ? `https://github.com/${username}` : undefined;
}

/** Returns a trimmed submitter name when attribution was provided. */
function normalizeSubmitterName(
  submission: PublicSubmissionRequest,
): string | undefined {
  const submitterName = submission.submitterName?.trim();
  return submitterName && submitterName.length > 0 ? submitterName : undefined;
}

function isPublicListingSubmission(
  submission: PublicSubmissionRequest,
): submission is PublicSubmissionRequest & {
  type: PublicListingSubmissionType;
} {
  return submission.type !== "tool";
}

/** Inserts a pending tool listing, using OG imagery or screenshot fallback metadata. */
async function createToolSubmission({
  authenticated,
  metadata,
  normalizedSubmitterGithubUrl,
  normalizedSubmitterName,
  normalizedUrl,
  resourceId,
  tags,
}: SubmissionContext & {
  metadata: MetadataResult;
  resourceId: string;
}): Promise<string | null> {
  let imageUrl: string = FALLBACK_IMAGE;
  let imageSource: "og" | "screenshot" | "fallback" = "fallback";

  const publicOgImage = metadata.ogImage
    ? await resolvePublicHttpUrl(metadata.ogImage)
    : null;
  if (publicOgImage) {
    imageUrl = publicOgImage;
    imageSource = "og";
  } else {
    const screenshot = await captureScreenshot(normalizedUrl);
    if (screenshot.success && screenshot.buffer) {
      const upload = await uploadScreenshot(
        screenshot.buffer,
        crypto.randomUUID(),
      );
      if (upload.success && upload.url) {
        imageUrl = upload.url;
        imageSource = "screenshot";
      }
    }
  }

  const [tool] = await getDb()
    .insert(toolListingsTable)
    .values({
      resourceId,
      submittedByUserId: authenticated?.user.id,
      pageTitle: metadata.title || normalizedUrl,
      metaDescription: metadata.description || "",
      status: "pending",
      tags,
      imageUrl,
      imageSource,
      submitterName: normalizedSubmitterName,
      submitterGithubUrl: normalizedSubmitterGithubUrl,
    })
    .onConflictDoNothing({ target: toolListingsTable.resourceId })
    .returning({ id: toolListingsTable.id });

  return tool?.id ?? null;
}

/** Inserts a pending public resource listing linked to the shared resource row. */
async function createPublicListingSubmission({
  authenticated,
  metadata,
  normalizedSubmitterGithubUrl,
  normalizedSubmitterName,
  normalizedUrl,
  resourceId,
  submission,
  tags,
}: SubmissionContext & {
  metadata: MetadataResult;
  resourceId: string;
  submission: PublicSubmissionRequest & { type: PublicListingSubmissionType };
}): Promise<string | null> {
  const [listing] = await getDb()
    .insert(publicListingsTable)
    .values({
      resourceId,
      submittedByUserId: authenticated?.user.id,
      submitterName: normalizedSubmitterName,
      submitterGithubUrl: normalizedSubmitterGithubUrl,
      contentKind: submission.type,
      pageTitle: metadata.title || normalizedUrl,
      metaDescription: metadata.description || "",
      status: "pending",
      tags,
    })
    .onConflictDoNothing({ target: publicListingsTable.resourceId })
    .returning({ id: publicListingsTable.id });

  return listing?.id ?? null;
}

/** Upserts the canonical resource identity and returns its id for listing inserts. */
async function getOrCreateResourceId(
  metadata: MetadataResult,
  normalizedUrl: string,
  submission: PublicSubmissionRequest,
): Promise<string> {
  const [resource] = await getDb()
    .insert(resourcesTable)
    .values({
      normalizedUrl,
      canonicalUrl: normalizeUrl(submission.url),
      pageTitle: metadata.title || normalizedUrl,
      metaDescription: metadata.description || "",
    })
    .onConflictDoUpdate({
      target: resourcesTable.normalizedUrl,
      set: { normalizedUrl },
    })
    .returning({ id: resourcesTable.id });

  return resource.id;
}

/** Formats the success message returned by public submission endpoints. */
function getSuccessMessage(type: PublicSubmissionType): string {
  if (type === "tool") {
    return "Tool submitted. It will be reviewed shortly.";
  }

  return "Resource submitted. It will be reviewed shortly.";
}

/** Formats the generic processing error for the submitted content type. */
function getProcessingErrorMessage(type: PublicSubmissionType): string {
  if (type === "tool") {
    return "An error occurred while processing the tool";
  }

  return `An error occurred while processing the ${type}`;
}

/** Handles shared public submission validation, attribution, metadata, and inserts. */
export async function handlePublicSubmission(
  req: Request,
  options: PublicSubmissionOptions,
): Promise<Response> {
  initSentry();

  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    assertRequiredEnv(["SUPABASE_DATABASE_URL"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, options.endpointName);
  }

  const authenticated = await getOptionalAuthenticatedUser(
    req,
    options.endpointName,
  );
  if (authenticated instanceof Response) {
    return authenticated;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  const validation = validatePublicSubmissionRequest(body);
  if (!validation.success) {
    return validationError(
      "Validation failed",
      getValidationDetails(validation.issues),
    );
  }

  if (
    options.allowedTypes &&
    !options.allowedTypes.includes(validation.output.type)
  ) {
    return validationError("Validation failed", options.rejectedTypeDetails);
  }

  const normalizedUrl = parseAndNormalizeUrl(validation.output.url);
  if (!normalizedUrl) {
    return validationError("Validation failed", {
      url: ["Please enter a valid HTTP/HTTPS URL"],
    });
  }

  const publicUrl = await resolvePublicHttpUrl(normalizedUrl);
  if (!publicUrl) {
    return validationError("Validation failed", {
      url: [PUBLIC_URL_ERROR],
    });
  }

  const tags = normalizeTags(validation.output.tags);
  if (tags.length === 0) {
    return validationError("Validation failed", {
      tags: ["At least one tag is required"],
    });
  }

  const submissionContext: SubmissionContext = {
    authenticated,
    normalizedSubmitterGithubUrl: normalizeSubmitterGithubUrl(
      validation.output,
    ),
    normalizedSubmitterName: normalizeSubmitterName(validation.output),
    normalizedUrl: publicUrl,
    submission: validation.output,
    tags,
  };

  try {
    const metadata = await extractMetadata(publicUrl);
    const resourceId = await getOrCreateResourceId(
      metadata,
      publicUrl,
      validation.output,
    );
    const submittedItemId = isPublicListingSubmission(validation.output)
      ? await createPublicListingSubmission({
          ...submissionContext,
          metadata,
          resourceId,
          submission: validation.output,
        })
      : await createToolSubmission({
          ...submissionContext,
          metadata,
          resourceId,
        });

    if (!submittedItemId) {
      return conflict("This URL has already been submitted");
    }

    return created({
      submittedItemId,
      type: validation.output.type,
      status: "pending",
      message: getSuccessMessage(validation.output.type),
    });
  } catch (error) {
    captureError(error, {
      type: validation.output.type,
      url: normalizedUrl,
      tags,
    });
    await flushSentry();
    return serverError(getProcessingErrorMessage(validation.output.type));
  }
}
