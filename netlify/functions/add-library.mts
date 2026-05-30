import type { Config, Context } from "@netlify/functions";
import type { BaseIssue } from "valibot";
import { and, eq } from "drizzle-orm";

import {
  assertRequiredEnv,
  bookmarksTable,
  conflict,
  created,
  getDb,
  handleMissingEnvironmentError,
  methodNotAllowed,
  normalizeUrl,
  parseAndNormalizeUrl,
  resourcesTable,
  serverError,
  unauthorized,
  validationError,
  verifyAuthenticatedUser,
} from "./lib";
import { extractMetadata } from "../../src/lib/services/metadata";
import { validatePersonalResourceRequest } from "../../src/lib/validation";

function getIssueField(issue: BaseIssue<unknown>): string {
  const path = issue.path
    ?.map((pathItem) => pathItem.key)
    .filter((key): key is string | number => typeof key === "string" || typeof key === "number");

  return path && path.length > 0 ? path.join(".") : "form";
}

function getValidationDetails(issues: readonly BaseIssue<unknown>[]): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = getIssueField(issue);
    details[field] ??= [];
    details[field].push(issue.message);
    return details;
  }, {});
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    assertRequiredEnv(["SUPABASE_DATABASE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "add-library");
  }

  const authenticated = await verifyAuthenticatedUser(req);
  if (!authenticated) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  const validation = validatePersonalResourceRequest(body);
  if (!validation.success) {
    return validationError("Validation failed", getValidationDetails(validation.issues));
  }

  const normalizedUrl = parseAndNormalizeUrl(validation.output.url);
  if (!normalizedUrl) {
    return validationError("Validation failed", {
      url: ["Please enter a valid HTTP/HTTPS URL"],
    });
  }

  const tags = [...new Set(validation.output.tags.map((tag) => tag.trim().toLowerCase()))];

  try {
    const db = getDb();
    const [existingResource] = await db
      .select({ id: resourcesTable.id })
      .from(resourcesTable)
      .where(eq(resourcesTable.normalizedUrl, normalizedUrl))
      .limit(1);

    let resourceId = existingResource?.id;

    if (resourceId) {
      const [existingBookmark] = await db
        .select({ id: bookmarksTable.id })
        .from(bookmarksTable)
        .where(
          and(
            eq(bookmarksTable.userId, authenticated.user.id),
            eq(bookmarksTable.resourceId, resourceId),
          ),
        )
        .limit(1);

      if (existingBookmark) {
        return conflict("This resource is already in your library");
      }
    } else {
      const metadata = await extractMetadata(normalizedUrl);
      const [resource] = await db
        .insert(resourcesTable)
        .values({
          normalizedUrl,
          canonicalUrl: normalizeUrl(validation.output.url),
          pageTitle: metadata.title || normalizedUrl,
          metaDescription: metadata.description || "",
        })
        .onConflictDoUpdate({
          target: resourcesTable.normalizedUrl,
          set: { normalizedUrl },
        })
        .returning({ id: resourcesTable.id });

      resourceId = resource.id;
    }

    const [bookmark] = await db
      .insert(bookmarksTable)
      .values({
        userId: authenticated.user.id,
        resourceId,
        notes: validation.output.notes ?? "",
        tags,
      })
      .onConflictDoNothing({
        target: [bookmarksTable.userId, bookmarksTable.resourceId],
      })
      .returning({ id: bookmarksTable.id });

    if (!bookmark) {
      return conflict("This resource is already in your library");
    }

    return created({
      resourceId: bookmark.id,
      message: "Resource saved to your library.",
    });
  } catch {
    return serverError("An error occurred while saving this resource");
  }
};

export const config: Config = {
  path: "/api/library",
  method: "POST",
};
