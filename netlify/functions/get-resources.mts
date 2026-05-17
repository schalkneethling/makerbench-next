import type { Config, Context } from "@netlify/functions";
import { sql } from "drizzle-orm";

import {
  getDb,
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

interface PublicResource {
  id: string;
  url: string;
  title: string;
  description: string | null;
  tags: { id: string; name: string }[];
  createdAt: string;
  kind: "resource" | "stack";
  children?: Array<{
    id: string;
    url: string;
    title: string;
    description: string | null;
    tags: { id: string; name: string }[];
  }>;
}

interface PublicResourceRow extends Record<string, unknown> {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  tags: string[];
  created_at: Date | string;
  kind: "resource" | "stack";
}

interface StackItemRow extends Record<string, unknown> {
  id: string;
  public_stack_id: string;
  url: string;
  title: string | null;
  description: string | null;
  tags: string[];
  status: string;
}

interface CountRow extends Record<string, unknown> {
  total: number;
}

function parsePagination(
  url: URL,
): { limit: number; offset: number } | Response {
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

function mapTags(tags: string[]): { id: string; name: string }[] {
  return tags.map((tag) => ({ id: tag, name: tag }));
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function getApprovedResourcesPage(
  limit: number,
  offset: number,
): Promise<{ resources: PublicResource[]; total: number }> {
  const db = getDb();
  const [pageResult, countResult] = await Promise.all([
    db.execute<PublicResourceRow>(sql`
      select *
      from (
        select
          public_listings.id,
          resources.canonical_url as url,
          public_listings.page_title as title,
          public_listings.meta_description as description,
          public_listings.tags,
          public_listings.created_at,
          'resource'::text as kind
        from public_listings
        inner join resources on public_listings.resource_id = resources.id
        where public_listings.status = 'approved'

        union all

        select
          public_stacks.id,
          resources.canonical_url as url,
          public_stacks.page_title as title,
          public_stacks.meta_description as description,
          public_stacks.tags,
          public_stacks.created_at,
          'stack'::text as kind
        from public_stacks
        inner join resources on public_stacks.resource_id = resources.id
        where public_stacks.status = 'approved'
      ) approved_resources
      order by created_at desc
      limit ${limit}
      offset ${offset}
    `),
    db.execute<CountRow>(sql`
      select (
        (select count(*) from public_listings where status = 'approved') +
        (select count(*) from public_stacks where status = 'approved')
      )::int as total
    `),
  ]);

  return {
    resources: await hydrateStackChildren(pageResult.rows),
    total: countResult.rows[0]?.total ?? 0,
  };
}

async function hydrateStackChildren(
  resources: PublicResourceRow[],
): Promise<PublicResource[]> {
  const db = getDb();
  const stackIds = resources
    .filter((resource) => resource.kind === "stack")
    .map((resource) => resource.id);
  const stackItems =
    stackIds.length === 0
      ? []
      : (
          await db.execute<StackItemRow>(sql`
            select
              public_stack_items.id,
              public_stack_items.public_stack_id,
              resources.canonical_url as url,
              public_stack_items.page_title as title,
              public_stack_items.meta_description as description,
              public_stack_items.tags,
              public_stack_items.status
            from public_stack_items
            inner join resources on public_stack_items.resource_id = resources.id
            where public_stack_items.public_stack_id = any(${stackIds}::uuid[])
              and public_stack_items.status = 'approved'
            order by public_stack_items.public_stack_id asc,
              public_stack_items.display_order asc
          `)
        ).rows;

  const childrenByStackId = new Map<string, PublicResource["children"]>();
  for (const item of stackItems) {
    if (item.status !== "approved") {
      continue;
    }

    let children = childrenByStackId.get(item.public_stack_id);
    if (!children) {
      children = [];
      childrenByStackId.set(item.public_stack_id, children);
    }

    children.push({
      id: item.id,
      url: item.url,
      title: item.title || item.url,
      description: item.description || null,
      tags: mapTags(item.tags),
    });
  }

  return resources.map<PublicResource>((resource) => ({
    id: resource.id,
    url: resource.url,
    title: resource.title || resource.url,
    description: resource.description || null,
    tags: mapTags(resource.tags),
    createdAt: serializeDate(resource.created_at),
    kind: resource.kind,
    ...(resource.kind === "stack"
      ? { children: childrenByStackId.get(resource.id) ?? [] }
      : {}),
  }));
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
    return handleMissingEnvironmentError(error, "get-resources");
  }

  const parsedPagination = parsePagination(new URL(req.url));
  if (parsedPagination instanceof Response) {
    return parsedPagination;
  }
  const { limit, offset } = parsedPagination;

  try {
    const { resources, total } = await getApprovedResourcesPage(limit, offset);
    const hasMore = offset + limit < total;

    console.info("[perf] get-resources", {
      requestId: context.requestId,
      handlerDurationMs: Date.now() - handlerStart,
      rowCount: total,
      resultCount: resources.length,
      hasMore,
      limit,
      offset,
    });

    return ok({
      resources,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    captureError(error, { requestId: context.requestId, limit, offset });
    await flushSentry();
    return serverError("An error occurred while fetching resources");
  }
};

export const config: Config = {
  path: "/api/resources",
  method: "GET",
};
