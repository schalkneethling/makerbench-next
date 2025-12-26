import { sql } from "drizzle-orm";
import { text, sqliteTable, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Bookmarks table - stores URL bookmarks with metadata and approval status
 */
export const bookmarksTable = sqliteTable(
  "bookmarks",
  {
    id: text("id").primaryKey(), // UUID for the bookmark
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .default("pending")
      .notNull(),
    imageUrl: text("image_url"),
    imageSource: text("image_source", { enum: ["og", "screenshot", "fallback"] }),
    submitterName: text("submitter_name"),
    submitterGithubUrl: text("submitter_github_url"),
    metadata: text("metadata"), // JSON string for additional info
    createdAt: text("created_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    approvedAt: text("approved_at"),
    updatedAt: text("updated_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => [
    index("url_idx").on(table.url),
    index("status_idx").on(table.status),
    index("created_at_idx").on(table.createdAt),
  ],
);

/**
 * Tags table - stores tag definitions for categorizing bookmarks
 */
export const tagsTable = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(), // UUID for the tag
    name: text("name").notNull().unique(),
    description: text("description"),
    createdAt: text("created_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => [index("name_idx").on(table.name)],
);

/**
 * Bookmark-Tag relationship table - many-to-many relationship between bookmarks and tags
 */
export const bookmarkTagsTable = sqliteTable(
  "bookmark_tags",
  {
    id: text("id").primaryKey(), // UUID for the relationship
    bookmarkId: text("bookmark_id")
      .notNull()
      .references(() => bookmarksTable.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tagsTable.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => [
    index("bookmark_id_idx").on(table.bookmarkId),
    index("tag_id_idx").on(table.tagId),
    uniqueIndex("unique_bookmark_tag").on(table.bookmarkId, table.tagId),
  ],
);

// TypeScript types for database operations
export type InsertBookmark = typeof bookmarksTable.$inferInsert;
export type SelectBookmark = typeof bookmarksTable.$inferSelect;

export type InsertTag = typeof tagsTable.$inferInsert;
export type SelectTag = typeof tagsTable.$inferSelect;

export type InsertBookmarkTag = typeof bookmarkTagsTable.$inferInsert;
export type SelectBookmarkTag = typeof bookmarkTagsTable.$inferSelect;
