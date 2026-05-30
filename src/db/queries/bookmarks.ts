import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../index";
import {
  toolListingsTable,
  resourcesTable,
  type InsertToolListing,
  type SelectToolListing,
} from "../schema";

export async function createBookmark(data: InsertToolListing) {
  return await db.insert(toolListingsTable).values(data).returning();
}

export async function getBookmarkById(id: string) {
  return await db.select().from(toolListingsTable).where(eq(toolListingsTable.id, id));
}

export async function getApprovedBookmarks(limit = 50, offset = 0) {
  return await db
    .select()
    .from(toolListingsTable)
    .where(eq(toolListingsTable.status, "approved"))
    .orderBy(desc(toolListingsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getBookmarksByStatus(
  status: "pending" | "approved" | "rejected",
  limit = 50,
  offset = 0,
) {
  return await db
    .select()
    .from(toolListingsTable)
    .where(eq(toolListingsTable.status, status))
    .orderBy(desc(toolListingsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateBookmarkStatus(
  id: string,
  status: "pending" | "approved" | "rejected",
) {
  const updateData: Partial<SelectToolListing> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "approved") {
    updateData.approvedAt = new Date();
  }

  return await db
    .update(toolListingsTable)
    .set(updateData)
    .where(eq(toolListingsTable.id, id))
    .returning();
}

export async function getBookmarksWithTags(limit = 50, offset = 0) {
  return await db
    .select({
      bookmark: toolListingsTable,
      resource: resourcesTable,
    })
    .from(toolListingsTable)
    .innerJoin(resourcesTable, eq(toolListingsTable.resourceId, resourcesTable.id))
    .where(eq(toolListingsTable.status, "approved"))
    .orderBy(desc(toolListingsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function searchBookmarksByTags(tagNames: string[], limit = 50, offset = 0) {
  return await db
    .select()
    .from(toolListingsTable)
    .where(
      and(eq(toolListingsTable.status, "approved"), sql`${toolListingsTable.tags} && ${tagNames}`),
    )
    .orderBy(desc(toolListingsTable.createdAt))
    .limit(limit)
    .offset(offset);
}
