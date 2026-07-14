import type { Config, Context } from "@netlify/functions";
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
import { resolvePublicHttpUrl } from "./lib/public-url";
import { getValidationDetails } from "./lib/validation";
import { extractMetadata } from "../../src/lib/services/metadata";
import { validatePersonalResourceRequest } from "../../src/lib/validation";

/** Returns a personal override only when it differs from shared metadata. */
function getMetadataOverride(
  submittedValue: string | undefined,
  sharedValue: string,
): string | null {
  const normalizedValue = submittedValue?.trim();
  if (!normalizedValue || normalizedValue === sharedValue) {
    return null;
  }

  return normalizedValue;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    assertRequiredEnv([
      "SUPABASE_DATABASE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
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
    return validationError(
      "Validation failed",
      getValidationDetails(validation.issues),
    );
  }

  const normalizedUrl = parseAndNormalizeUrl(validation.output.url);
  if (!normalizedUrl) {
    return validationError("Validation failed", {
      url: ["Please enter a valid HTTP/HTTPS URL"],
    });
  }

  const tags = [
    ...new Set(validation.output.tags.map((tag) => tag.trim().toLowerCase())),
  ];

  try {
    const db = getDb();
    const [existingResource] = await db
      .select({
        id: resourcesTable.id,
        pageTitle: resourcesTable.pageTitle,
        metaDescription: resourcesTable.metaDescription,
      })
      .from(resourcesTable)
      .where(eq(resourcesTable.normalizedUrl, normalizedUrl))
      .limit(1);

    let resourceId = existingResource?.id;
    let sharedTitle = existingResource?.pageTitle;
    let sharedDescription = existingResource?.metaDescription;

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
      const publicTarget = await resolvePublicHttpUrl(normalizedUrl);
      const metadata = publicTarget
        ? await extractMetadata(publicTarget.url, {
            dispatcher: publicTarget.dispatcher,
          }).finally(() => publicTarget.dispatcher.close())
        : null;
      sharedTitle = metadata?.title || normalizedUrl;
      sharedDescription = metadata?.description || "";
      const [resource] = await db
        .insert(resourcesTable)
        .values({
          normalizedUrl,
          canonicalUrl: normalizeUrl(validation.output.url),
          pageTitle: sharedTitle,
          metaDescription: sharedDescription,
        })
        .onConflictDoUpdate({
          target: resourcesTable.normalizedUrl,
          set: { normalizedUrl },
        })
        .returning({
          id: resourcesTable.id,
          pageTitle: resourcesTable.pageTitle,
          metaDescription: resourcesTable.metaDescription,
        });

      resourceId = resource.id;
      sharedTitle = resource.pageTitle ?? sharedTitle;
      sharedDescription = resource.metaDescription ?? sharedDescription;
    }

    const [bookmark] = await db
      .insert(bookmarksTable)
      .values({
        userId: authenticated.user.id,
        resourceId,
        titleOverride: getMetadataOverride(
          validation.output.title,
          sharedTitle ?? normalizedUrl,
        ),
        descriptionOverride: getMetadataOverride(
          validation.output.description,
          sharedDescription ?? "",
        ),
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
