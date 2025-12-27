import type { Context, Config } from "@netlify/functions";
import { eq, desc, count } from "drizzle-orm";

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
  title: string | null;
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

    // Get total count of approved bookmarks
    const [{ total }] = await db
      .select({ total: count() })
      .from(bookmarksTable)
      .where(eq(bookmarksTable.status, "approved"));

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
      .where(eq(bookmarksTable.status, "approved"))
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
          title: bookmark.title,
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
    captureError(error, { limit, offset });
    await flushSentry();
    return serverError("An error occurred while fetching bookmarks");
  }
};

export const config: Config = {
  path: "/api/bookmarks",
  method: "GET",
};
