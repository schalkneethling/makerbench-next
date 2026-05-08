import type { Config, Context } from "@netlify/functions";
import { asc, desc, eq, inArray } from "drizzle-orm";

import {
  getDb,
  resourcesTable,
  publicListingsTable,
  publicStacksTable,
  publicStackItemsTable,
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

function mapTags(tags: string[]): { id: string; name: string }[] {
  return tags.map((tag) => ({ id: tag, name: tag }));
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function getApprovedResources(): Promise<PublicResource[]> {
  const db = getDb();
  const [listings, stacks] = await Promise.all([
    db
      .select({
        id: publicListingsTable.id,
        url: resourcesTable.canonicalUrl,
        title: publicListingsTable.pageTitle,
        description: publicListingsTable.metaDescription,
        tags: publicListingsTable.tags,
        createdAt: publicListingsTable.createdAt,
      })
      .from(publicListingsTable)
      .innerJoin(resourcesTable, eq(publicListingsTable.resourceId, resourcesTable.id))
      .where(eq(publicListingsTable.status, "approved"))
      .orderBy(desc(publicListingsTable.createdAt)),
    db
      .select({
        id: publicStacksTable.id,
        url: resourcesTable.canonicalUrl,
        title: publicStacksTable.pageTitle,
        description: publicStacksTable.metaDescription,
        tags: publicStacksTable.tags,
        createdAt: publicStacksTable.createdAt,
      })
      .from(publicStacksTable)
      .innerJoin(resourcesTable, eq(publicStacksTable.resourceId, resourcesTable.id))
      .where(eq(publicStacksTable.status, "approved"))
      .orderBy(desc(publicStacksTable.createdAt)),
  ]);

  const stackIds = stacks.map((stack) => stack.id);
  const stackItems =
    stackIds.length === 0
      ? []
      : await db
          .select({
            id: publicStackItemsTable.id,
            publicStackId: publicStackItemsTable.publicStackId,
            url: resourcesTable.canonicalUrl,
            title: publicStackItemsTable.pageTitle,
            description: publicStackItemsTable.metaDescription,
            tags: publicStackItemsTable.tags,
          })
          .from(publicStackItemsTable)
          .innerJoin(
            resourcesTable,
            eq(publicStackItemsTable.resourceId, resourcesTable.id),
          )
          .where(inArray(publicStackItemsTable.publicStackId, stackIds))
          .orderBy(asc(publicStackItemsTable.displayOrder));

  const childrenByStackId = new Map<string, PublicResource["children"]>();
  for (const item of stackItems) {
    const children = childrenByStackId.get(item.publicStackId) ?? [];
    children.push({
      id: item.id,
      url: item.url,
      title: item.title || item.url,
      description: item.description || null,
      tags: mapTags(item.tags),
    });
    childrenByStackId.set(item.publicStackId, children);
  }

  return [
    ...listings.map<PublicResource>((listing) => ({
      id: listing.id,
      url: listing.url,
      title: listing.title || listing.url,
      description: listing.description || null,
      tags: mapTags(listing.tags),
      createdAt: serializeDate(listing.createdAt),
      kind: "resource",
    })),
    ...stacks.map<PublicResource>((stack) => ({
      id: stack.id,
      url: stack.url,
      title: stack.title || stack.url,
      description: stack.description || null,
      tags: mapTags(stack.tags),
      createdAt: serializeDate(stack.createdAt),
      kind: "stack",
      children: childrenByStackId.get(stack.id) ?? [],
    })),
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function matchesSearch(resource: PublicResource, query: string): boolean {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  const haystacks = [
    resource.title,
    resource.description,
    resource.url,
    ...resource.tags.map((tag) => tag.name),
    ...(resource.children ?? []).flatMap((child) => [
      child.title,
      child.description,
      child.url,
      ...child.tags.map((tag) => tag.name),
    ]),
  ];

  return haystacks.some((value) =>
    (value ?? "").toLowerCase().includes(normalizedQuery),
  );
}

function matchesTags(resource: PublicResource, tags: string[]): boolean {
  if (tags.length === 0) {
    return true;
  }

  const resourceTags = new Set([
    ...resource.tags.map((tag) => tag.name.toLowerCase()),
    ...(resource.children ?? []).flatMap((child) =>
      child.tags.map((tag) => tag.name.toLowerCase()),
    ),
  ]);

  return tags.some((tag) => resourceTags.has(tag));
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
    return handleMissingEnvironmentError(error, "search-resources");
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() || "";
  const tags = (url.searchParams.get("tags") || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const parsedPagination = parsePagination(url);
  if (parsedPagination instanceof Response) {
    return parsedPagination;
  }
  const { limit, offset } = parsedPagination;

  try {
    const resources = (await getApprovedResources()).filter(
      (resource) => matchesSearch(resource, query) && matchesTags(resource, tags),
    );
    const page = resources.slice(offset, offset + limit);
    const hasMore = offset + limit < resources.length;

    console.info("[perf] search-resources", {
      requestId: context.requestId,
      handlerDurationMs: Date.now() - handlerStart,
      rowCount: resources.length,
      resultCount: page.length,
      queryLength: query.length,
      tagFilterCount: tags.length,
      hasMore,
      limit,
      offset,
    });

    return ok({
      resources: page,
      pagination: {
        total: null,
        limit,
        offset,
        hasMore,
      },
    });
  } catch (error) {
    captureError(error, { requestId: context.requestId, query, tags });
    await flushSentry();
    return serverError("An error occurred while searching resources");
  }
};

export const config: Config = {
  path: "/api/resources/search",
};
