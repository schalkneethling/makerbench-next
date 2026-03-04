import type { Context, Config } from "@netlify/functions";
import { eq, desc, like, inArray, and, or } from "drizzle-orm";

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

export default async (req: Request, _context: Context) => {
  const handlerStart = Date.now();
  initSentry();

  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv(["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "search-bookmarks");
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() || "";
  const tagsParam = url.searchParams.get("tags") || "";
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  // Parse tags (comma-separated)
  const tagFilters = tagsParam
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);

  // Parse pagination
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

    // Build conditions
    const conditions = [eq(bookmarksTable.status, "approved")];

    // Search by title OR tag name if query provided.
    if (query) {
      conditions.push(
        or(
          like(bookmarksTable.title, `%${query}%`),
          like(tagsTable.name, `%${query}%`)
        )!
      );
    }

    // Any selected tag can match.
    if (tagFilters.length > 0) {
      conditions.push(inArray(tagsTable.name, tagFilters));
    }

    const whereClause = and(...conditions);

    const paginatedBookmarks = await db
      .selectDistinct({
        id: bookmarksTable.id,
        url: bookmarksTable.url,
        title: bookmarksTable.title,
        description: bookmarksTable.description,
        imageUrl: bookmarksTable.imageUrl,
        submitterName: bookmarksTable.submitterName,
        submitterGithubUrl: bookmarksTable.submitterGithubUrl,
        createdAt: bookmarksTable.createdAt,
      })
      .from(bookmarksTable)
      .leftJoin(
        bookmarkTagsTable,
        eq(bookmarksTable.id, bookmarkTagsTable.bookmarkId),
      )
      .leftJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
      .where(whereClause)
      .orderBy(desc(bookmarksTable.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = paginatedBookmarks.length > limit;
    const pageBookmarks = paginatedBookmarks.slice(0, limit);
    const pageBookmarkIds = pageBookmarks.map((bookmark) => bookmark.id);

    const tagRows =
      pageBookmarkIds.length > 0
        ? await db
            .select({
              bookmarkId: bookmarkTagsTable.bookmarkId,
              tagId: tagsTable.id,
              tagName: tagsTable.name,
            })
            .from(bookmarkTagsTable)
            .innerJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
            .where(inArray(bookmarkTagsTable.bookmarkId, pageBookmarkIds))
        : [];

    const tagMap = new Map<string, { id: string; name: string }[]>();
    for (const row of tagRows) {
      const existing = tagMap.get(row.bookmarkId) ?? [];
      existing.push({ id: row.tagId, name: row.tagName });
      tagMap.set(row.bookmarkId, existing);
    }

    const bookmarks: BookmarkWithTags[] = pageBookmarks.map((bookmark) => ({
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title ?? bookmark.url,
      description: bookmark.description,
      imageUrl: bookmark.imageUrl,
      submitterName: bookmark.submitterName,
      submitterGithubUrl: bookmark.submitterGithubUrl,
      createdAt: bookmark.createdAt,
      tags: tagMap.get(bookmark.id) ?? [],
    }));

    const dbDuration = Date.now() - dbStart;
    const handlerDuration = Date.now() - handlerStart;
    console.info("[perf] search-bookmarks", {
      dbDuration,
      handlerDuration,
      hasMore,
      limit,
      offset,
      queryLength: query.length,
      resultCount: bookmarks.length,
      tagFilterCount: tagFilters.length,
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
    captureError(error, { query, tagFilters, limit, offset });
    await flushSentry();
    return serverError("An error occurred while searching bookmarks");
  }
};

export const config: Config = {
  path: "/api/bookmarks/search",
};
