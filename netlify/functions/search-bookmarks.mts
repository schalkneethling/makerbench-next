import type { Context, Config } from "@netlify/functions";
import { eq, desc, inArray, and, sql } from "drizzle-orm";

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

interface SearchIdRow {
  id: string;
  rank?: number;
}

function buildSearchMode(query: string, tagFilters: string[]): string {
  if (query && tagFilters.length > 0) {
    return "text+tag";
  }

  if (query) {
    return "text";
  }

  return "tag";
}

function buildFtsQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter((token) => token.length > 0)
    .map((token) => `${token}*`)
    .join(" ");
}

async function hydrateBookmarks(
  bookmarkIds: string[],
): Promise<BookmarkWithTags[]> {
  if (bookmarkIds.length === 0) {
    return [];
  }

  const db = getDb();
  const rows = await db
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
    .where(inArray(bookmarksTable.id, bookmarkIds))
    .groupBy(
      bookmarksTable.id,
      bookmarksTable.url,
      bookmarksTable.title,
      bookmarksTable.description,
      bookmarksTable.imageUrl,
      bookmarksTable.submitterName,
      bookmarksTable.submitterGithubUrl,
      bookmarksTable.createdAt,
    );

  const rowsById = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        url: row.url,
        title: row.title ?? row.url,
        description: row.description,
        imageUrl: row.imageUrl,
        submitterName: row.submitterName,
        submitterGithubUrl: row.submitterGithubUrl,
        createdAt: row.createdAt,
        tags: parseAggregatedTags(row.tagsJson),
      } satisfies BookmarkWithTags,
    ]),
  );

  return bookmarkIds
    .map((bookmarkId) => rowsById.get(bookmarkId))
    .filter((bookmark): bookmark is BookmarkWithTags => bookmark !== undefined);
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
    let matchedIds: SearchIdRow[] = [];

    if (query) {
      const ftsQuery = buildFtsQuery(query);

      matchedIds = await db.all<SearchIdRow>(sql`
        select
          bookmark_search.bookmark_id as id,
          bm25(bookmark_search) as rank
        from bookmark_search
        inner join ${bookmarksTable}
          on ${bookmarksTable.id} = bookmark_search.bookmark_id
        where
          ${bookmarksTable.status} = 'approved'
          and bookmark_search match ${ftsQuery}
          ${
            tagFilters.length > 0
              ? sql`and exists (
                  select 1
                  from ${bookmarkTagsTable}
                  inner join ${tagsTable}
                    on ${bookmarkTagsTable.tagId} = ${tagsTable.id}
                  where
                    ${bookmarkTagsTable.bookmarkId} = ${bookmarksTable.id}
                    and ${inArray(tagsTable.name, tagFilters)}
                )`
              : sql``
          }
        order by rank, ${bookmarksTable.createdAt} desc
        limit ${limit + 1}
        offset ${offset}
      `);
    } else {
      matchedIds = await db
        .selectDistinct({
          id: bookmarksTable.id,
        })
        .from(bookmarksTable)
        .innerJoin(
          bookmarkTagsTable,
          eq(bookmarksTable.id, bookmarkTagsTable.bookmarkId),
        )
        .innerJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
        .where(
          and(
            eq(bookmarksTable.status, "approved"),
            inArray(tagsTable.name, tagFilters),
          ),
        )
        .orderBy(desc(bookmarksTable.createdAt))
        .limit(limit + 1)
        .offset(offset);
    }

    const dbDurationMs = Date.now() - dbStart;
    const pageBookmarkIds = matchedIds.slice(0, limit).map((row) => row.id);
    const hasMore = matchedIds.length > limit;
    const mapStart = Date.now();
    const bookmarks = await hydrateBookmarks(pageBookmarkIds);
    const mapDurationMs = Date.now() - mapStart;
    const handlerDurationMs = Date.now() - handlerStart;

    console.info("[perf] search-bookmarks", {
      requestId: context.requestId,
      queryMode: buildSearchMode(query, tagFilters),
      dbDurationMs,
      mapDurationMs,
      handlerDurationMs,
      hasMore,
      limit,
      offset,
      queryLength: query.length,
      rowCount: matchedIds.length,
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
    captureError(error, {
      requestId: context.requestId,
      query,
      tagFilters,
      limit,
      offset,
    });
    await flushSentry();
    return serverError("An error occurred while searching bookmarks");
  }
};

export const config: Config = {
  path: "/api/bookmarks/search",
};
