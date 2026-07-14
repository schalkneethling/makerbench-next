import type { Context } from "@netlify/functions";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { vi } from "vitest";
import type { getDb } from "../lib/db";

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

interface MockDbOptions {
  returningRows?: unknown[][];
  transactionReturningRows?: unknown[][];
}

/** Creates a chainable database mock with transaction-scoped query methods. */
export function createMockDb(options: MockDbOptions = {}) {
  const transactionDb = {
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  const mockDb = {
    execute: vi.fn().mockResolvedValue({ rows: [{ attempt_count: 1 }] }),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockResolvedValue([]),
    offset: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    transactionDb,
  };

  for (const rows of options.returningRows ?? []) {
    mockDb.returning.mockResolvedValueOnce(rows);
  }
  for (const rows of options.transactionReturningRows ?? []) {
    transactionDb.returning.mockResolvedValueOnce(rows);
  }
  mockDb.transaction.mockImplementation(
    async (
      callback: (transaction: ReturnType<typeof getDb>) => Promise<unknown>,
    ) => await callback(transactionDb as unknown as ReturnType<typeof getDb>),
  );

  return mockDb;
}

export function getPgQuery(query: unknown) {
  return pgDialect.sqlToQuery(query as SQL);
}
