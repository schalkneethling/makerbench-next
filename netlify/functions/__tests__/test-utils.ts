import type { Context } from "@netlify/functions";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { vi } from "vitest";

const pgDialect = new PgDialect();

export function createMockContext(): Context {
  return {
    account: { id: "test-account" },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
    deploy: { context: "dev", id: "test-deploy", published: false },
    geo: {},
    ip: "127.0.0.1",
    params: {},
    requestId: "test-request-id",
    server: { region: "us-east-1" },
    site: { id: "test-site", name: "test", url: "https://test.netlify.app" },
    json: vi.fn(),
    log: vi.fn(),
  } as unknown as Context;
}

export function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
  };
}

export function getPgQuery(query: unknown) {
  return pgDialect.sqlToQuery(query as SQL);
}

export function getSqlText(query: unknown): string {
  if (!query || typeof query !== "object") {
    return "";
  }

  if ("value" in query && Array.isArray(query.value)) {
    return query.value.join("");
  }

  const queryChunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return queryChunks.map(getSqlText).join("");
}
