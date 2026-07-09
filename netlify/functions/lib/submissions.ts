import type { BaseIssue } from "valibot";

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

const FALLBACK_IMAGE = "/makerbench-fallback.png";

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

/** Builds a canonical GitHub profile URL from either a submitted URL or username. */
function normalizeSubmitterGithubUrl(
  submission: PublicSubmissionRequest,
): string | undefined {
  const submittedUrl = submission.submitterGithubUrl?.trim();
  if (submittedUrl) {
    return submittedUrl;
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

  if (metadata.ogImage) {
    imageUrl = metadata.ogImage;
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

/** Inserts a pending public article/resource listing linked to the shared resource row. */
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

  const label = type === "article" ? "Article" : "Resource";
  return `${label} submitted. It will be reviewed shortly.`;
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
    normalizedUrl,
    submission: validation.output,
    tags,
  };

  try {
    const metadata = await extractMetadata(normalizedUrl);
    const resourceId = await getOrCreateResourceId(
      metadata,
      normalizedUrl,
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
