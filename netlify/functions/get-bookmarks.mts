import type { Context, Config } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";

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

interface ToolWithTags {
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

function mapTags(tags: string[] | null | undefined): { id: string; name: string }[] {
  return tags?.map((tag) => ({ id: tag, name: tag })) ?? [];
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
    return handleMissingEnvironmentError(error, "get-tools");
  }

  const parsedPagination = parsePagination(new URL(req.url));
  if (parsedPagination instanceof Response) {
    return parsedPagination;
  }
  const { limit, offset } = parsedPagination;

  try {
    const db = getDb();
    const dbStart = Date.now();
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
      .where(eq(toolListingsTable.status, "approved"))
      .orderBy(desc(toolListingsTable.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const tools: ToolWithTags[] = rows.slice(0, limit).map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title || row.url,
      description: row.description || null,
      imageUrl: row.imageUrl,
      submitterName: row.submitterName,
      submitterGithubUrl: row.submitterGithubUrl,
      createdAt: serializeDate(row.createdAt),
      tags: mapTags(row.tags),
    }));

    console.info("[perf] get-tools", {
      requestId: context.requestId,
      dbDurationMs: Date.now() - dbStart,
      handlerDurationMs: Date.now() - handlerStart,
      hasMore,
      limit,
      offset,
      rowCount: rows.length,
      resultCount: tools.length,
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
    captureError(error, { limit, offset });
    await flushSentry();
    return serverError("An error occurred while fetching tools");
  }
};

export const config: Config = {
  path: "/api/tools",
  method: "GET",
};
