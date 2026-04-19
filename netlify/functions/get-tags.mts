import type { Config, Context } from "@netlify/functions";
import { countDistinct, desc, eq } from "drizzle-orm";

import {
  getDb,
  tagsTable,
  bookmarkTagsTable,
  bookmarksTable,
  ok,
  badRequest,
  methodNotAllowed,
  assertRequiredEnv,
  handleMissingEnvironmentError,
  initSentry,
  captureError,
  flushSentry,
  serverError,
} from "./lib";

const MAX_LIMIT = 100;

export default async (req: Request, context: Context) => {
  const handlerStart = Date.now();
  initSentry();

  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv(["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "get-tags");
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  let limit: number | undefined;

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);

    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return badRequest("limit must be a positive integer");
    }

    limit = Math.min(parsedLimit, MAX_LIMIT);
  }

  try {
    const db = getDb();
    const dbStart = Date.now();

    const tagsQuery = db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        usageCount: countDistinct(bookmarkTagsTable.bookmarkId),
      })
      .from(tagsTable)
      .leftJoin(bookmarkTagsTable, eq(tagsTable.id, bookmarkTagsTable.tagId))
      .leftJoin(
        bookmarksTable,
        eq(bookmarkTagsTable.bookmarkId, bookmarksTable.id),
      )
      .where(eq(bookmarksTable.status, "approved"))
      .groupBy(tagsTable.id, tagsTable.name)
      .orderBy(desc(countDistinct(bookmarkTagsTable.bookmarkId)), tagsTable.name);

    const rows = limit === undefined
      ? await tagsQuery
      : await tagsQuery.limit(limit);

    const dbDurationMs = Date.now() - dbStart;
    const handlerDurationMs = Date.now() - handlerStart;

    console.info("[perf] get-tags", {
      requestId: context.requestId,
      queryMode: "tags",
      limit,
      rowCount: rows.length,
      dbDurationMs,
      mapDurationMs: 0,
      handlerDurationMs,
    });

    return ok({
      tags: rows.map((row) => ({
        id: row.id,
        name: row.name,
        usageCount: row.usageCount,
      })),
    });
  } catch (error) {
    captureError(error, { requestId: context.requestId, limit });
    await flushSentry();
    return serverError("An error occurred while fetching tags");
  }
};

export const config: Config = {
  path: "/api/tags",
  method: "GET",
};
