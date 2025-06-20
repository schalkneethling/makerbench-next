import { eq, desc, like, count } from "drizzle-orm";
import { db } from "../index";
import {
  tagsTable,
  bookmarkTagsTable,
  bookmarksTable,
  type InsertTag,
} from "../schema";

/**
 * Creates a new tag in the database
 * @param data - Tag data to insert
 * @returns Array containing the created tag
 */
export async function createTag(data: InsertTag) {
  return await db.insert(tagsTable).values(data).returning();
}

/**
 * Retrieves a tag by its ID
 * @param id - Tag ID to find
 * @returns Array containing the tag if found
 */
export async function getTagById(id: string) {
  return await db.select().from(tagsTable).where(eq(tagsTable.id, id));
}

/**
 * Retrieves a tag by its name
 * @param name - Tag name to find
 * @returns Array containing the tag if found
 */
export async function getTagByName(name: string) {
  return await db.select().from(tagsTable).where(eq(tagsTable.name, name));
}

/**
 * Retrieves all tags with pagination
 * @param limit - Maximum number of tags to return
 * @param offset - Number of tags to skip
 * @returns Array of tags ordered by creation date
 */
export async function getAllTags(limit = 100, offset = 0) {
  return await db
    .select()
    .from(tagsTable)
    .orderBy(desc(tagsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Searches tags by name using pattern matching
 * @param searchTerm - Text to search for in tag names
 * @param limit - Maximum number of tags to return
 * @param offset - Number of tags to skip
 * @returns Array of tags with matching names
 */
export async function searchTagsByName(
  searchTerm: string,
  limit = 50,
  offset = 0,
) {
  const searchPattern = `%${searchTerm}%`;

  return await db
    .select()
    .from(tagsTable)
    .where(like(tagsTable.name, searchPattern))
    .orderBy(desc(tagsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Retrieves popular tags ordered by usage count
 * @param limit - Maximum number of tags to return
 * @returns Array of tags with their usage counts
 */
export async function getPopularTags(limit = 20) {
  return await db
    .select({
      tag: tagsTable,
      count: count(bookmarkTagsTable.id).as("count"),
    })
    .from(tagsTable)
    .innerJoin(bookmarkTagsTable, eq(tagsTable.id, bookmarkTagsTable.tagId))
    .innerJoin(
      bookmarksTable,
      eq(bookmarkTagsTable.bookmarkId, bookmarksTable.id),
    )
    .where(eq(bookmarksTable.status, "approved"))
    .groupBy(tagsTable.id)
    .orderBy(desc(count(bookmarkTagsTable.id)))
    .limit(limit);
}
