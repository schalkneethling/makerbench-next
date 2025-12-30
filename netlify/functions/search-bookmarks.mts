import type { Context, Config } from "@netlify/functions";
import { eq, desc, like, inArray, and, count } from "drizzle-orm";

import {
  getDb,
  bookmarksTable,
  tagsTable,
  bookmarkTagsTable,
  ok,
  badRequest,
  serverError,
  methodNotAllowed,
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
  createdAt: string;
  tags: { id: string; name: string }[];
}

export default async (req: Request, _context: Context) => {
  initSentry();

  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
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

    // Build conditions
    const conditions = [eq(bookmarksTable.status, "approved")];

    // Add title search if query provided
    if (query) {
      conditions.push(like(bookmarksTable.title, `%${query}%`));
    }

    // If tag filters provided, find matching bookmark IDs
    let tagFilteredIds: string[] | null = null;
    if (tagFilters.length > 0) {
      const tagRows = await db
        .selectDistinct({ bookmarkId: bookmarkTagsTable.bookmarkId })
        .from(bookmarkTagsTable)
        .innerJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
        .where(inArray(tagsTable.name, tagFilters));

      tagFilteredIds = tagRows.map((r) => r.bookmarkId);

      if (tagFilteredIds.length === 0) {
        // No bookmarks match the tag filter
        return ok({
          bookmarks: [],
          pagination: { total: 0, limit, offset, hasMore: false },
        });
      }

      conditions.push(inArray(bookmarksTable.id, tagFilteredIds));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(bookmarksTable)
      .where(whereClause);

    // Get bookmarks with tags
    const rows = await db
      .select({
        bookmark: bookmarksTable,
        tagId: tagsTable.id,
        tagName: tagsTable.name,
      })
      .from(bookmarksTable)
      .leftJoin(
        bookmarkTagsTable,
        eq(bookmarksTable.id, bookmarkTagsTable.bookmarkId),
      )
      .leftJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
      .where(whereClause)
      .orderBy(desc(bookmarksTable.createdAt))
      .limit(limit)
      .offset(offset);

    // Group tags by bookmark
    const bookmarksMap = new Map<string, BookmarkWithTags>();

    for (const row of rows) {
      const { bookmark, tagId, tagName } = row;

      if (!bookmarksMap.has(bookmark.id)) {
        bookmarksMap.set(bookmark.id, {
          id: bookmark.id,
          url: bookmark.url,
          title: bookmark.title ?? bookmark.url,
          description: bookmark.description,
          imageUrl: bookmark.imageUrl,
          createdAt: bookmark.createdAt,
          tags: [],
        });
      }

      if (tagId && tagName) {
        bookmarksMap.get(bookmark.id)!.tags.push({ id: tagId, name: tagName });
      }
    }

    const bookmarks = Array.from(bookmarksMap.values());

    return ok({
      bookmarks,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + bookmarks.length < total,
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
