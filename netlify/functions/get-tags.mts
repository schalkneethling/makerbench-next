import type { Config, Context } from "@netlify/functions";
import { sql } from "drizzle-orm";

import {
  getDb,
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

interface TagUsageRow extends Record<string, unknown> {
  name: string;
  usage_count: number;
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
    return handleMissingEnvironmentError(error, "get-tool-tags");
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  let limit: number | undefined;

  if (limitParam) {
    const parsedLimit = parseInt(limitParam, 10);

    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      return badRequest("limit must be a positive integer");
    }

    limit = Math.min(parsedLimit, MAX_LIMIT);
  }

  try {
    const db = getDb();
    const dbStart = Date.now();
    const result = await db.execute<TagUsageRow>(sql`
      select
        t.tag_name as name,
        count(*)::int as usage_count
      from tool_listings
      cross join unnest(tags) as t(tag_name)
      where status = 'approved'
      group by t.tag_name
      order by usage_count desc, t.tag_name asc
      ${limit === undefined ? sql`` : sql`limit ${limit}`}
    `);

    console.info("[perf] get-tool-tags", {
      requestId: context.requestId,
      queryMode: "tags",
      limit,
      rowCount: result.rows.length,
      dbDurationMs: Date.now() - dbStart,
      mapDurationMs: 0,
      handlerDurationMs: Date.now() - handlerStart,
    });

    return ok({
      tags: result.rows.map((row) => ({
        id: row.name,
        name: row.name,
        usageCount: row.usage_count,
      })),
    });
  } catch (error) {
    captureError(error, { requestId: context.requestId, limit });
    await flushSentry();
    return serverError("An error occurred while fetching tags");
  }
};

export const config: Config = {
  path: "/api/tools/tags",
  method: "GET",
};
