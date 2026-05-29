import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";

import {
  assertRequiredEnv,
  bookmarksTable,
  getDb,
  handleMissingEnvironmentError,
  methodNotAllowed,
  ok,
  resourcesTable,
  serverError,
  unauthorized,
  verifyAuthenticatedUser,
} from "./lib";

function mapTags(tags: string[] | null | undefined): { id: string; name: string }[] {
  return tags?.map((tag) => ({ id: tag, name: tag })) ?? [];
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv([
      "SUPABASE_DATABASE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "get-library");
  }

  try {
    const authenticated = await verifyAuthenticatedUser(req);
    if (!authenticated) {
      return unauthorized();
    }

    const db = getDb();
    const rows = await db
      .select({
        id: bookmarksTable.id,
        url: resourcesTable.canonicalUrl,
        title: bookmarksTable.titleOverride,
        resourceTitle: resourcesTable.pageTitle,
        description: bookmarksTable.descriptionOverride,
        resourceDescription: resourcesTable.metaDescription,
        notes: bookmarksTable.notes,
        createdAt: bookmarksTable.createdAt,
        tags: bookmarksTable.tags,
      })
      .from(bookmarksTable)
      .innerJoin(resourcesTable, eq(bookmarksTable.resourceId, resourcesTable.id))
      .where(eq(bookmarksTable.userId, authenticated.user.id))
      .orderBy(desc(bookmarksTable.createdAt));

    return ok({
      resources: rows.map((row) => ({
        id: row.id,
        url: row.url,
        title: row.title ?? row.resourceTitle ?? row.url,
        description: row.description ?? row.resourceDescription ?? null,
        notes: row.notes,
        tags: mapTags(row.tags),
        createdAt: serializeDate(row.createdAt),
      })),
    });
  } catch {
    return serverError("An error occurred while fetching your library");
  }
};

export const config: Config = {
  path: "/api/library",
  method: "GET",
};
