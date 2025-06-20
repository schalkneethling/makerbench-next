import { eq, and, desc, like, inArray } from "drizzle-orm";
import { db } from "../index";
import {
  bookmarksTable,
  tagsTable,
  bookmarkTagsTable,
  type InsertBookmark,
  type SelectBookmark,
} from "../schema";

/**
 * Creates a new bookmark in the database
 * @param data - Bookmark data to insert
 * @returns Array containing the created bookmark
 */
export async function createBookmark(data: InsertBookmark) {
  return await db.insert(bookmarksTable).values(data).returning();
}

/**
 * Retrieves a bookmark by its ID
 * @param id - Bookmark ID to find
 * @returns Array containing the bookmark if found
 */
export async function getBookmarkById(id: string) {
  return await db
    .select()
    .from(bookmarksTable)
    .where(eq(bookmarksTable.id, id));
}

/**
 * Retrieves all approved bookmarks with pagination
 * @param limit - Maximum number of bookmarks to return
 * @param offset - Number of bookmarks to skip
 * @returns Array of approved bookmarks ordered by creation date
 */
export async function getApprovedBookmarks(limit = 50, offset = 0) {
  return await db
    .select()
    .from(bookmarksTable)
    .where(eq(bookmarksTable.status, "approved"))
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Retrieves bookmarks by approval status for admin review
 * @param status - Status to filter by (pending, approved, rejected)
 * @param limit - Maximum number of bookmarks to return
 * @param offset - Number of bookmarks to skip
 * @returns Array of bookmarks with the specified status
 */
export async function getBookmarksByStatus(
  status: "pending" | "approved" | "rejected",
  limit = 50,
  offset = 0,
) {
  return await db
    .select()
    .from(bookmarksTable)
    .where(eq(bookmarksTable.status, status))
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Updates bookmark approval status
 * @param id - Bookmark ID to update
 * @param status - New status (pending, approved, rejected)
 * @returns Array containing the updated bookmark
 */
export async function updateBookmarkStatus(
  id: string,
  status: "pending" | "approved" | "rejected",
) {
  const updateData: Partial<SelectBookmark> = {
    status,
    updatedAt: new Date().toISOString(),
  };

  if (status === "approved") {
    updateData.approvedAt = new Date().toISOString();
  }

  return await db
    .update(bookmarksTable)
    .set(updateData)
    .where(eq(bookmarksTable.id, id))
    .returning();
}

/**
 * Retrieves bookmarks with their associated tags
 * @param limit - Maximum number of bookmarks to return
 * @param offset - Number of bookmarks to skip
 * @returns Array of bookmarks with tag information
 */
export async function getBookmarksWithTags(limit = 50, offset = 0) {
  return await db
    .select({
      bookmark: bookmarksTable,
      tags: tagsTable,
    })
    .from(bookmarksTable)
    .leftJoin(
      bookmarkTagsTable,
      eq(bookmarksTable.id, bookmarkTagsTable.bookmarkId),
    )
    .leftJoin(tagsTable, eq(bookmarkTagsTable.tagId, tagsTable.id))
    .where(eq(bookmarksTable.status, "approved"))
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Searches bookmarks by tag names
 * @param tagNames - Array of tag names to search for
 * @param limit - Maximum number of bookmarks to return
 * @param offset - Number of bookmarks to skip
 * @returns Array of bookmarks that have any of the specified tags
 */
export async function searchBookmarksByTags(
  tagNames: string[],
  limit = 50,
  offset = 0,
) {
  return await db
    .selectDistinct({
      bookmark: bookmarksTable,
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
        inArray(tagsTable.name, tagNames),
      ),
    )
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Searches bookmarks by text in title field
 * @param searchTerm - Text to search for in bookmark titles
 * @param limit - Maximum number of bookmarks to return
 * @param offset - Number of bookmarks to skip
 * @returns Array of bookmarks with matching titles
 */
export async function searchBookmarksByText(
  searchTerm: string,
  limit = 50,
  offset = 0,
) {
  const searchPattern = `%${searchTerm}%`;

  return await db
    .select()
    .from(bookmarksTable)
    .where(
      and(
        eq(bookmarksTable.status, "approved"),
        like(bookmarksTable.title, searchPattern),
      ),
    )
    .orderBy(desc(bookmarksTable.createdAt))
    .limit(limit)
    .offset(offset);
}
