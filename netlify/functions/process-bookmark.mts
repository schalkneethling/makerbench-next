import type { Context, Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import type { BaseIssue } from "valibot";

import {
  getDb,
  resourcesTable,
  toolListingsTable,
  created,
  validationError,
  conflict,
  serverError,
  methodNotAllowed,
  normalizeUrl,
  parseAndNormalizeUrl,
  assertRequiredEnv,
  handleMissingEnvironmentError,
  initSentry,
  captureError,
  flushSentry,
} from "./lib";
import { extractMetadata } from "../../src/lib/services/metadata";
import { captureScreenshot } from "../../src/lib/services/screenshot";
import { uploadScreenshot } from "../../src/lib/services/cloudinary";
import { validateBookmarkRequest } from "../../src/lib/validation";

const FALLBACK_IMAGE = "/images/fallback-screenshot.png";

function getIssueField(issue: BaseIssue<unknown>): string {
  const pathItem = issue.path?.[0] as { key?: unknown } | undefined;
  return typeof pathItem?.key === "string" ? pathItem.key : "form";
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

export default async (req: Request, _context: Context) => {
  initSentry();

  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    assertRequiredEnv(["SUPABASE_DATABASE_URL"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "process-tool");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  const validation = validateBookmarkRequest(body);
  if (!validation.success) {
    return validationError(
      "Validation failed",
      getValidationDetails(validation.issues),
    );
  }

  const {
    url,
    tags: rawTags,
    submitterName,
    submitterGithubUsername,
    submitterGithubUrl,
  } = validation.output;

  const normalizedSubmitterGithubUrl =
    submitterGithubUrl && submitterGithubUrl.trim().length > 0
      ? submitterGithubUrl
      : submitterGithubUsername && submitterGithubUsername.trim().length > 0
        ? `https://github.com/${submitterGithubUsername}`
        : undefined;

  const normalizedUrl = parseAndNormalizeUrl(url);
  if (!normalizedUrl) {
    return validationError("Validation failed", {
      url: ["Please enter a valid HTTP/HTTPS URL"],
    });
  }

  const tags = [...new Set(rawTags.map((tag) => tag.trim().toLowerCase()))];

  try {
    const db = getDb();
    const existingResource = await db
      .select({ id: resourcesTable.id })
      .from(resourcesTable)
      .where(eq(resourcesTable.normalizedUrl, normalizedUrl))
      .limit(1);

    if (existingResource.length > 0) {
      const existingTool = await db
        .select({ id: toolListingsTable.id })
        .from(toolListingsTable)
        .where(eq(toolListingsTable.resourceId, existingResource[0].id))
        .limit(1);

      if (existingTool.length > 0) {
        return conflict("This URL has already been submitted");
      }
    }

    const metadata = await extractMetadata(normalizedUrl);
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

    const resource =
      existingResource[0] ??
      (
        await db
          .insert(resourcesTable)
          .values({
            normalizedUrl,
            canonicalUrl: normalizeUrl(url),
            pageTitle: metadata.title || normalizedUrl,
            metaDescription: metadata.description || "",
          })
          .returning({ id: resourcesTable.id })
      )[0];

    const [tool] = await db
      .insert(toolListingsTable)
      .values({
        resourceId: resource.id,
        pageTitle: metadata.title || normalizedUrl,
        metaDescription: metadata.description || "",
        status: "pending",
        tags,
        imageUrl,
        imageSource,
        submitterName,
        submitterGithubUrl: normalizedSubmitterGithubUrl,
      })
      .returning({ id: toolListingsTable.id });

    return created({
      bookmarkId: tool.id,
      message: "Tool submitted. It will be reviewed shortly.",
    });
  } catch (error) {
    captureError(error, { url, tags: rawTags });
    await flushSentry();
    return serverError("An error occurred while processing the tool");
  }
};

export const config: Config = {
  path: "/api/tools",
  method: "POST",
};
