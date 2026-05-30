import * as v from "valibot";
import { BookmarkApiError } from "./bookmarks";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }

  return process.env.API_BASE_URL || "http://localhost:8888";
}

const resourceTagSchema = v.object({
  id: v.string(),
  name: v.string(),
});

const resourceChildSchema = v.object({
  id: v.string(),
  url: v.string(),
  title: v.string(),
  description: v.nullable(v.string()),
  tags: v.array(resourceTagSchema),
});

const resourceSchema = v.object({
  id: v.string(),
  url: v.string(),
  title: v.string(),
  description: v.nullable(v.string()),
  tags: v.array(resourceTagSchema),
  createdAt: v.string(),
  kind: v.picklist(["resource", "stack"]),
  children: v.optional(v.array(resourceChildSchema)),
});

const paginationSchema = v.object({
  total: v.optional(v.nullable(v.number())),
  limit: v.number(),
  offset: v.number(),
  hasMore: v.boolean(),
});

const resourcesDataSchema = v.object({
  resources: v.array(resourceSchema),
  pagination: paginationSchema,
});

const resourcesResponseSchema = v.object({
  success: v.literal(true),
  data: resourcesDataSchema,
});

const errorResponseSchema = v.object({
  success: v.literal(false),
  error: v.string(),
  details: v.optional(v.record(v.string(), v.array(v.string()))),
});

export type ResourceTag = v.InferOutput<typeof resourceTagSchema>;
export type ResourceChild = v.InferOutput<typeof resourceChildSchema>;
export type Resource = v.InferOutput<typeof resourceSchema>;
export type ResourcesResponse = v.InferOutput<typeof resourcesDataSchema>;

export interface GetResourcesParams {
  limit?: number;
  offset?: number;
}

export interface SearchResourcesParams extends GetResourcesParams {
  q?: string;
  tags?: string[];
}

interface RequestOptions {
  signal?: AbortSignal;
}

function throwApiError(json: unknown, status: number): never {
  // Parse server error bodies so UI consumers can surface structured details.
  // If this contract does not parse, treat it as an unexpected server response.
  const parsed = v.safeParse(errorResponseSchema, json);
  throw new BookmarkApiError(
    parsed.success ? parsed.output.error : "An unexpected error occurred",
    status,
    parsed.success ? parsed.output.details : undefined,
  );
}

function buildPath(path: string, params: SearchResourcesParams): string {
  const searchParams = new URLSearchParams();

  if (params.q) {
    searchParams.set("q", params.q);
  }
  if (params.tags?.length) {
    searchParams.set("tags", params.tags.join(","));
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
}

async function fetchResourcesResponse(
  path: string,
  options: RequestOptions = {},
): Promise<ResourcesResponse> {
  const startTime =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  let status: number | undefined;
  let aborted = false;

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      signal: options.signal,
    });
    status = response.status;
    const json = await response.json();

    if (!response.ok) {
      throwApiError(json, response.status);
    }

    const result = v.safeParse(resourcesResponseSchema, json);
    if (!result.success) {
      // A malformed success payload signals a server contract violation; callers handle the thrown error.
      throw new BookmarkApiError("Invalid response from server", 500);
    }

    return result.output.data;
  } catch (error) {
    aborted = error instanceof DOMException && error.name === "AbortError";
    throw error;
  } finally {
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    console.info("[perf] client-request", {
      path,
      durationMs: Math.round(now - startTime),
      status,
      aborted,
    });
  }
}

export function getResources(
  params: GetResourcesParams = {},
  options: RequestOptions = {},
): Promise<ResourcesResponse> {
  return fetchResourcesResponse(buildPath("/api/resources", params), options);
}

export function searchResources(
  params: SearchResourcesParams = {},
  options: RequestOptions = {},
): Promise<ResourcesResponse> {
  return fetchResourcesResponse(buildPath("/api/resources/search", params), options);
}
