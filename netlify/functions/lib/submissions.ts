import type { Context } from "@netlify/functions";
import { sql } from "drizzle-orm";

import {
  getVerifiedDisplayName,
  getVerifiedGithubUsername,
  type AuthenticatedUser,
  verifyAuthenticatedUser,
} from "./auth";
import { getDb } from "./db";
import {
  assertRequiredEnv,
  handleInvalidEnvironmentError,
  handleMissingEnvironmentError,
} from "./env";
import {
  conflict,
  created,
  dependencyUnavailable,
  forbidden,
  methodNotAllowed,
  serverError,
  tooManyRequests,
  unauthorized,
  validationError,
} from "./responses";
import { captureError, flushSentry, initSentry } from "./sentry";
import { resolvePublicHttpUrl } from "./public-url";
import {
  consumeSubmissionRateLimit,
  createSubmissionRateLimitKey,
  getSubmissionRateLimitConfig,
  type SubmissionRateLimitConfig,
} from "./submission-rate-limit";
import {
  findSubmissionBlocklistMatch,
  recordSubmissionBlocklistEvent,
} from "./submission-blocklist";
import { normalizeUrl, parseAndNormalizeUrl } from "./url";
import { getValidationDetails } from "./validation";
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
const PUBLIC_URL_ERROR = "Please enter a publicly reachable HTTP/HTTPS URL";

type PublicListingSubmissionType = Exclude<PublicSubmissionType, "tool">;

interface PublicSubmissionOptions {
  context: Context;
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

type SubmissionDatabase =
  | ReturnType<typeof getDb>
  | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

interface ExistingPublicSubmission extends Record<string, unknown> {
  status: "pending" | "approved" | "rejected";
  submitted_by_user_id: string | null;
}

interface ToolImage {
  imageSource: "og" | "screenshot" | "fallback";
  imageUrl: string;
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
    return handleMissingEnvironmentError(
      error,
      endpointName,
      "submission-auth-configuration-unavailable",
    );
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

/** Resolves attribution from a verified identity before accepting public form fields. */
function resolveSubmissionAttribution(
  submission: PublicSubmissionRequest,
  authenticated: AuthenticatedUser | null,
): Pick<
  SubmissionContext,
  "normalizedSubmitterGithubUrl" | "normalizedSubmitterName"
> {
  const githubUsername = authenticated
    ? getVerifiedGithubUsername(authenticated.user)
    : null;

  return {
    normalizedSubmitterName:
      (authenticated ? getVerifiedDisplayName(authenticated.user) : null) ??
      normalizeSubmitterName(submission),
    normalizedSubmitterGithubUrl: githubUsername
      ? `https://github.com/${githubUsername}`
      : normalizeSubmitterGithubUrl(submission),
  };
}

/** Returns structured errors when the resolved public attribution is incomplete. */
function getAttributionValidationDetails(
  attribution: Pick<
    SubmissionContext,
    "normalizedSubmitterGithubUrl" | "normalizedSubmitterName"
  >,
): Record<string, string[]> | null {
  const details: Record<string, string[]> = {};

  if (!attribution.normalizedSubmitterName) {
    details.submitterName = ["Your name is required"];
  }

  if (!attribution.normalizedSubmitterGithubUrl) {
    details.submitterGithubUsername = ["GitHub username is required"];
  }

  return Object.keys(details).length > 0 ? details : null;
}

function isPublicListingSubmission(
  submission: PublicSubmissionRequest,
): submission is PublicSubmissionRequest & {
  type: PublicListingSubmissionType;
} {
  return submission.type !== "tool";
}

/** Prepares OG, screenshot, or fallback imagery before opening a transaction. */
async function prepareToolImage(
  metadata: MetadataResult,
  normalizedUrl: string,
): Promise<ToolImage> {
  let imageUrl: string = FALLBACK_IMAGE;
  let imageSource: ToolImage["imageSource"] = "fallback";

  const publicOgImageTarget = metadata.ogImage
    ? await resolvePublicHttpUrl(metadata.ogImage)
    : null;
  if (publicOgImageTarget) {
    imageUrl = publicOgImageTarget.url;
    imageSource = "og";
    await publicOgImageTarget.dispatcher.close();
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

  return { imageSource, imageUrl };
}

/** Inserts a pending tool listing using previously prepared imagery. */
async function createToolSubmission(
  db: SubmissionDatabase,
  {
    authenticated,
    imageSource,
    imageUrl,
    metadata,
    normalizedSubmitterGithubUrl,
    normalizedSubmitterName,
    normalizedUrl,
    resourceId,
    tags,
  }: SubmissionContext &
    ToolImage & {
      metadata: MetadataResult;
      resourceId: string;
    },
): Promise<string | null> {
  const [tool] = await db
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
async function createPublicListingSubmission(
  db: SubmissionDatabase,
  {
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
  },
): Promise<string | null> {
  const [listing] = await db
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
  db: SubmissionDatabase,
  metadata: MetadataResult,
  normalizedUrl: string,
  submission: PublicSubmissionRequest,
): Promise<string> {
  const [resource] = await db
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

/** Finds an existing public listing for a normalized URL across both catalogs. */
async function findExistingPublicSubmission(
  db: SubmissionDatabase,
  normalizedUrl: string,
): Promise<ExistingPublicSubmission | null> {
  const result = await db.execute<ExistingPublicSubmission>(sql`
    select status, submitted_by_user_id
    from (
      select tool_listings.status, tool_listings.submitted_by_user_id, tool_listings.created_at
      from tool_listings
      inner join resources on resources.id = tool_listings.resource_id
      where resources.normalized_url = ${normalizedUrl}

      union all

      select public_listings.status, public_listings.submitted_by_user_id, public_listings.created_at
      from public_listings
      inner join resources on resources.id = public_listings.resource_id
      where resources.normalized_url = ${normalizedUrl}
    ) existing_public_submissions
    order by
      case status when 'approved' then 0 when 'pending' then 1 else 2 end,
      created_at desc
    limit 1
  `);

  const existing = result.rows[0];
  return existing?.status ? existing : null;
}

/** Returns a helpful conflict response without exposing another submitter's identity. */
function getDuplicateConflict(
  existing: ExistingPublicSubmission,
  authenticated: AuthenticatedUser | null,
): Response {
  if (existing.status === "approved") {
    return conflict("This URL is already published.");
  }

  if (existing.status === "pending") {
    const isSameUser =
      authenticated && existing.submitted_by_user_id === authenticated.user.id;
    return conflict(
      isSameUser
        ? "You already submitted this URL. It is awaiting review."
        : "This URL has already been submitted and is awaiting review.",
    );
  }

  return conflict("This URL has already been submitted");
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
    return handleMissingEnvironmentError(
      error,
      options.endpointName,
      "submission-database-configuration-unavailable",
    );
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

  let rateLimitConfig: SubmissionRateLimitConfig;
  let keyHash: string;
  try {
    rateLimitConfig = getSubmissionRateLimitConfig();
    keyHash = createSubmissionRateLimitKey(
      {
        authenticated,
        clientIp: options.context.ip,
      },
      rateLimitConfig.secret,
    );
  } catch (error) {
    return handleInvalidEnvironmentError(
      error,
      options.endpointName,
      "submission-rate-limit-configuration-unavailable",
    );
  }

  try {
    const allowed = await consumeSubmissionRateLimit(keyHash, rateLimitConfig);

    if (!allowed) {
      return tooManyRequests();
    }
  } catch {
    captureError(
      new Error("Submission rate limit datastore operation failed"),
      {
        function: options.endpointName,
        dependency: "submission-rate-limit-store",
      },
    );
    await flushSentry();
    return dependencyUnavailable("submission-rate-limit-store-unavailable");
  }

  const normalizedUrl = parseAndNormalizeUrl(validation.output.url);
  if (!normalizedUrl) {
    return validationError("Validation failed", {
      url: ["Please enter a valid HTTP/HTTPS URL"],
    });
  }

  try {
    const blocklistMatch = await findSubmissionBlocklistMatch(normalizedUrl);
    if (blocklistMatch) {
      await recordSubmissionBlocklistEvent(
        blocklistMatch,
        normalizedUrl,
        authenticated?.user.id ?? null,
      );
      return forbidden("This resource cannot be submitted.");
    }
  } catch (error) {
    captureError(error, {
      function: options.endpointName,
      dependency: "submission-blocklist-store",
    });
    await flushSentry();
    return dependencyUnavailable("submission-blocklist-store-unavailable");
  }

  try {
    const existing = await findExistingPublicSubmission(getDb(), normalizedUrl);
    if (existing) {
      return getDuplicateConflict(existing, authenticated);
    }
  } catch (error) {
    captureError(error, {
      function: options.endpointName,
      dependency: "submission-store",
    });
    await flushSentry();
    return dependencyUnavailable("submission-store-unavailable");
  }

  const tags = normalizeTags(validation.output.tags);
  if (tags.length === 0) {
    return validationError("Validation failed", {
      tags: ["At least one tag is required"],
    });
  }

  const attribution = resolveSubmissionAttribution(
    validation.output,
    authenticated,
  );
  const attributionDetails = getAttributionValidationDetails(attribution);
  if (attributionDetails) {
    return validationError("Validation failed", attributionDetails);
  }

  const publicTarget = await resolvePublicHttpUrl(normalizedUrl);
  if (!publicTarget) {
    return validationError("Validation failed", {
      url: [PUBLIC_URL_ERROR],
    });
  }
  const publicUrl = publicTarget.url;

  const submissionContext: SubmissionContext = {
    authenticated,
    ...attribution,
    normalizedUrl: publicUrl,
    submission: validation.output,
    tags,
  };

  try {
    const metadata = await extractMetadata(publicUrl, {
      dispatcher: publicTarget.dispatcher,
    });
    const toolImage = isPublicListingSubmission(validation.output)
      ? null
      : await prepareToolImage(metadata, publicUrl);
    const result = await getDb().transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${publicUrl}, 0))`,
      );

      const existing = await findExistingPublicSubmission(
        transaction,
        publicUrl,
      );
      if (existing) {
        return { existing, submittedItemId: null };
      }

      const resourceId = await getOrCreateResourceId(
        transaction,
        metadata,
        publicUrl,
        validation.output,
      );
      let submittedItemId: string | null;
      if (isPublicListingSubmission(validation.output)) {
        submittedItemId = await createPublicListingSubmission(transaction, {
          ...submissionContext,
          metadata,
          resourceId,
          submission: validation.output,
        });
      } else {
        if (!toolImage) {
          throw new Error("Tool submission image preparation was skipped");
        }

        submittedItemId = await createToolSubmission(transaction, {
          ...submissionContext,
          ...toolImage,
          metadata,
          resourceId,
        });
      }

      return { existing: null, submittedItemId };
    });

    if (result.existing) {
      return getDuplicateConflict(result.existing, authenticated);
    }

    if (!result.submittedItemId) {
      return conflict("This URL has already been submitted");
    }

    return created({
      submittedItemId: result.submittedItemId,
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
  } finally {
    await publicTarget.dispatcher.close();
  }
}
