import type { Config, Context } from "@netlify/functions";
import { countDistinct, desc, eq } from "drizzle-orm";

import {
  getDb,
  tagsTable,
  bookmarkTagsTable,
  bookmarksTable,
  ok,
  methodNotAllowed,
  assertRequiredEnv,
  handleMissingEnvironmentError,
  initSentry,
  captureError,
  flushSentry,
  serverError,
} from "./lib";

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

  try {
    const db = getDb();
    const dbStart = Date.now();

    const rows = await db
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

    const dbDurationMs = Date.now() - dbStart;
    const handlerDurationMs = Date.now() - handlerStart;

    console.info("[perf] get-tags", {
      requestId: context.requestId,
      queryMode: "tags",
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
    captureError(error, { requestId: context.requestId });
    await flushSentry();
    return serverError("An error occurred while fetching tags");
  }
};

export const config: Config = {
  path: "/api/tags",
  method: "GET",
};
