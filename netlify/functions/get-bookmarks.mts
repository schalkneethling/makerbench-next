import type { Context, Config } from "@netlify/functions";
import { eq, desc, sql } from "drizzle-orm";

import {
  getDb,
  bookmarksTable,
  tagsTable,
  bookmarkTagsTable,
  ok,
  badRequest,
  serverError,
  methodNotAllowed,
  assertRequiredEnv,
  handleMissingEnvironmentError,
  parseAggregatedTags,
  initSentry,
  captureError,
  flushSentry,
} from "./lib";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface BookmarkWithTags {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  submitterName: string | null;
  submitterGithubUrl: string | null;
  createdAt: string;
  tags: { id: string; name: string }[];
}

export default async (req: Request, context: Context) => {
  const handlerStart = Date.now();
  initSentry();

  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv(["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "get-bookmarks");
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  // Parse and validate pagination
  let limit = DEFAULT_LIMIT;
  let offset = 0;

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (isNaN(parsed) || parsed < 1) {
      return badRequest("limit must be a positive integer");
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10);
    if (isNaN(parsed) || parsed < 0) {
      return badRequest("offset must be a non-negative integer");
    }
    offset = parsed;
  }

  try {
    const db = getDb();
    const dbStart = Date.now();

    const paginatedBookmarks = await db
      .select({
        id: bookmarksTable.id,
        url: bookmarksTable.url,
        title: bookmarksTable.title,
        description: bookmarksTable.description,
        imageUrl: bookmarksTable.imageUrl,
        submitterName: bookmarksTable.submitterName,
        submitterGithubUrl: bookmarksTable.submitterGithubUrl,
        createdAt: bookmarksTable.createdAt,
        tagsJson: sql<string>`coalesce(
          json_group_array(
            case
              when ${tagsTable.id} is not null
                then json_object('id', ${tagsTable.id}, 'name', ${tagsTable.name})
            end
          ),
          '[]'
        )`,
      })
      .from(bookmarksTable)
      .leftJoin(
        bookmarkTagsTable,
        eq(bookmarksTable.id, bookmarkTagsTable.bookmarkId),
      )
      .leftJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
      .where(eq(bookmarksTable.status, "approved"))
      .groupBy(
        bookmarksTable.id,
        bookmarksTable.url,
        bookmarksTable.title,
        bookmarksTable.description,
        bookmarksTable.imageUrl,
        bookmarksTable.submitterName,
        bookmarksTable.submitterGithubUrl,
        bookmarksTable.createdAt,
      )
      .orderBy(desc(bookmarksTable.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const dbDurationMs = Date.now() - dbStart;
    const mapStart = Date.now();

    const hasMore = paginatedBookmarks.length > limit;
    const pageBookmarks = paginatedBookmarks.slice(0, limit);

    const bookmarks: BookmarkWithTags[] = pageBookmarks.map((bookmark) => ({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title ?? bookmark.url,
      description: bookmark.description,
      imageUrl: bookmark.imageUrl,
      submitterName: bookmark.submitterName,
      submitterGithubUrl: bookmark.submitterGithubUrl,
      createdAt: bookmark.createdAt,
      tags: parseAggregatedTags(bookmark.tagsJson),
    }));

    const mapDurationMs = Date.now() - mapStart;
    const handlerDurationMs = Date.now() - handlerStart;
    console.info("[perf] get-bookmarks", {
      requestId: context.requestId,
      queryMode: "browse",
      dbDurationMs,
      mapDurationMs,
      handlerDurationMs,
      hasMore,
      limit,
      offset,
      rowCount: paginatedBookmarks.length,
      resultCount: bookmarks.length,
    });

    return ok({
      bookmarks,
      pagination: {
        total: null,
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    captureError(error, { limit, offset });
    await flushSentry();
    return serverError("An error occurred while fetching bookmarks");
  }
};

export const config: Config = {
  path: "/api/bookmarks",
  method: "GET",
};
