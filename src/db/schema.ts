import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  check,
  index,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const authSchema = pgSchema("auth");

export const authUsersTable = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const resourcesTable = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  normalizedUrl: text("normalized_url").notNull().unique(),
  canonicalUrl: text("canonical_url").notNull(),
  pageTitle: text("page_title").notNull(),
  metaDescription: text("meta_description").default("").notNull(),
  ...timestamps,
});

export const toolListingsTable = pgTable(
  "tool_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    submittedByUserId: uuid("submitted_by_user_id").references(() => authUsersTable.id, {
      onDelete: "cascade",
    }),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .default("pending")
      .notNull(),
    pageTitle: text("page_title").notNull(),
    metaDescription: text("meta_description").default("").notNull(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    imageUrl: text("image_url"),
    imageSource: text("image_source", {
      enum: ["og", "screenshot", "fallback"],
    }),
    submitterName: text("submitter_name"),
    submitterGithubUrl: text("submitter_github_url"),
    metadata: text("metadata"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionCode: text("rejection_code"),
    rejectionReason: text("rejection_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => authUsersTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("idx_tool_listings_status_created").on(table.status, table.createdAt),
    uniqueIndex("unique_tool_listing_resource").on(table.resourceId),
  ],
);

export const bookmarksTable = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsersTable.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => bookmarksTable.id, {
      onDelete: "cascade",
    }),
    titleOverride: text("title_override"),
    descriptionOverride: text("description_override"),
    notes: text("notes").default("").notNull(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("idx_bookmarks_user_created").on(table.userId, table.createdAt),
    index("idx_bookmarks_parent").on(table.parentId),
    index("idx_bookmarks_resource").on(table.resourceId),
    uniqueIndex("unique_user_resource").on(table.userId, table.resourceId),
  ],
).enableRLS();

export const publicListingsTable = pgTable(
  "public_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    submittedByUserId: uuid("submitted_by_user_id").references(() => authUsersTable.id, {
      onDelete: "cascade",
    }),
    submittedByBookmarkId: uuid("submitted_by_bookmark_id").references(() => bookmarksTable.id, {
      onDelete: "set null",
    }),
    submitterName: text("submitter_name"),
    submitterGithubUrl: text("submitter_github_url"),
    contentKind: text("content_kind", {
      enum: ["article", "resource"],
    })
      .default("resource")
      .notNull(),
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    }).notNull(),
    pageTitle: text("page_title").notNull(),
    metaDescription: text("meta_description").default("").notNull(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    rejectionCode: text("rejection_code"),
    rejectionReason: text("rejection_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => authUsersTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    index("idx_public_listings_status").on(table.status, table.createdAt.desc()),
    index("idx_public_listings_tags").using("gin", table.tags),
    index("idx_public_listings_search").using(
      "gin",
      sql`(
        page_title || ' ' || meta_description || ' ' || public.immutable_array_to_string(tags, ' ')
      ) gin_trgm_ops`,
    ),
    index("idx_public_listings_resource").on(table.resourceId),
    uniqueIndex("unique_public_listing_resource").on(table.resourceId),
    check(
      "public_listings_content_kind_check",
      sql`${table.contentKind} in ('article', 'resource')`,
    ),
  ],
);

export const publicStacksTable = pgTable(
  "public_stacks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rootBookmarkId: uuid("root_bookmark_id")
      .notNull()
      .references(() => bookmarksTable.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => authUsersTable.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    }).notNull(),
    pageTitle: text("page_title").notNull(),
    metaDescription: text("meta_description").default("").notNull(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    rejectionCode: text("rejection_code"),
    rejectionReason: text("rejection_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => authUsersTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("unique_public_stack_root").on(table.rootBookmarkId),
    index("idx_public_stacks_status").on(table.status, table.createdAt.desc()),
    index("idx_public_stacks_tags").using("gin", table.tags),
    index("idx_public_stacks_search").using(
      "gin",
      sql`(
        page_title || ' ' || meta_description || ' ' || public.immutable_array_to_string(tags, ' ')
      ) gin_trgm_ops`,
    ),
    index("idx_public_stacks_owner").on(table.ownerUserId, table.createdAt),
    index("idx_public_stacks_resource").on(table.resourceId),
  ],
);

export const publicStackItemsTable = pgTable(
  "public_stack_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicStackId: uuid("public_stack_id")
      .notNull()
      .references(() => publicStacksTable.id, { onDelete: "cascade" }),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarksTable.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    sourcePublicListingId: uuid("source_public_listing_id").references(
      () => publicListingsTable.id,
      { onDelete: "set null" },
    ),
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    }).notNull(),
    pageTitle: text("page_title").notNull(),
    metaDescription: text("meta_description").default("").notNull(),
    tags: text("tags")
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    displayOrder: bigint("display_order", { mode: "number" }).default(0).notNull(),
    rejectionCode: text("rejection_code"),
    rejectionReason: text("rejection_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => authUsersTable.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("unique_public_stack_item_bookmark").on(table.bookmarkId),
    uniqueIndex("unique_public_stack_resource").on(table.publicStackId, table.resourceId),
    index("idx_public_stack_items_status").on(table.status, table.createdAt.desc()),
    index("idx_public_stack_items_stack").on(table.publicStackId, table.displayOrder),
    index("idx_public_stack_items_tags").using("gin", table.tags),
    index("idx_public_stack_items_search").using(
      "gin",
      sql`(
        page_title || ' ' || meta_description || ' ' || public.immutable_array_to_string(tags, ' ')
      ) gin_trgm_ops`,
    ),
    index("idx_public_stack_items_resource").on(table.resourceId),
  ],
);

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsersTable.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("unique_user_role").on(table.userId, table.role)],
).enableRLS();

export const userPreferencesTable = pgTable("user_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsersTable.id, { onDelete: "cascade" })
    .unique(),
  highlightColor: text("highlight_color", {
    enum: ["default", "amber", "cobalt", "rose", "plum", "moss"],
  })
    .default("default")
    .notNull(),
  ...timestamps,
}).enableRLS();

export type InsertResource = typeof resourcesTable.$inferInsert;
export type SelectResource = typeof resourcesTable.$inferSelect;
export type InsertToolListing = typeof toolListingsTable.$inferInsert;
export type SelectToolListing = typeof toolListingsTable.$inferSelect;
export type InsertBookmark = typeof bookmarksTable.$inferInsert;
export type SelectBookmark = typeof bookmarksTable.$inferSelect;
