import type { Context, Config } from "@netlify/functions";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  getDb,
  resourcesTable,
  toolListingsTable,
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

function parsePagination(url: URL): { limit: number; offset: number } | Response {
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  let limit = DEFAULT_LIMIT;
  let offset = 0;

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      return badRequest("limit must be a positive integer");
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return badRequest("offset must be a non-negative integer");
    }
    offset = parsed;
  }

  return { limit, offset };
}

function mapTags(tags: string[] | undefined, tagsJson?: string): { id: string; name: string }[] {
  if (tags) {
    return tags.map((tag) => ({ id: tag, name: tag }));
  }

  if (!tagsJson) {
    return [];
  }

  return JSON.parse(tagsJson) as { id: string; name: string }[];
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export default async (req: Request, context: Context) => {
  const handlerStart = Date.now();
  initSentry();

  if (req.method !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  try {
    assertRequiredEnv(["SUPABASE_DATABASE_URL"]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "search-tools");
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() || "";
  const tagFilters = (url.searchParams.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const parsedPagination = parsePagination(url);

  if (parsedPagination instanceof Response) {
    return parsedPagination;
  }

  const { limit, offset } = parsedPagination;

  try {
    const db = getDb();
    const dbStart = Date.now();
    const searchPattern = `%${query}%`;
    const filters = [
      eq(toolListingsTable.status, "approved"),
      query
        ? or(
            ilike(toolListingsTable.pageTitle, searchPattern),
            ilike(toolListingsTable.metaDescription, searchPattern),
            ilike(resourcesTable.canonicalUrl, searchPattern),
          )
        : undefined,
      tagFilters.length > 0
        ? sql`${toolListingsTable.tags} && ${tagFilters}`
        : undefined,
    ].filter((filter) => filter !== undefined);

    const rows = await db
      .select({
        id: toolListingsTable.id,
        url: resourcesTable.canonicalUrl,
        title: toolListingsTable.pageTitle,
        description: toolListingsTable.metaDescription,
        imageUrl: toolListingsTable.imageUrl,
        submitterName: toolListingsTable.submitterName,
        submitterGithubUrl: toolListingsTable.submitterGithubUrl,
        createdAt: toolListingsTable.createdAt,
        tags: toolListingsTable.tags,
      })
      .from(toolListingsTable)
      .innerJoin(resourcesTable, eq(toolListingsTable.resourceId, resourcesTable.id))
      .where(and(...filters))
      .orderBy(desc(toolListingsTable.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const tools = rows.slice(0, limit).map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title || row.url,
      description: row.description || null,
      imageUrl: row.imageUrl,
      submitterName: row.submitterName,
      submitterGithubUrl: row.submitterGithubUrl,
      createdAt: serializeDate(row.createdAt),
      tags: mapTags(row.tags, (row as { tagsJson?: string }).tagsJson),
    }));

    console.info("[perf] search-tools", {
      requestId: context.requestId,
      dbDurationMs: Date.now() - dbStart,
      handlerDurationMs: Date.now() - handlerStart,
      limit,
      offset,
      queryLength: query.length,
      tagFilterCount: tagFilters.length,
      rowCount: rows.length,
      resultCount: tools.length,
      hasMore,
    });

    return ok({
      bookmarks: tools,
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
    return serverError("An error occurred while searching tools");
  }
};

export const config: Config = {
  path: "/api/tools/search",
};
