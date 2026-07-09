import { sql } from "drizzle-orm";
import * as v from "valibot";

import { getDb } from "./db";

export const moderationEntityTypes = [
  "tool",
  "resource",
  "stack",
  "stack-item",
] as const;

export const moderationReviewSchema = v.object({
  type: v.picklist(moderationEntityTypes),
  id: v.pipe(v.string(), v.uuid()),
  action: v.picklist(["approve", "reject"]),
  rejectionCode: v.optional(v.pipe(v.string(), v.maxLength(100))),
  rejectionReason: v.optional(v.pipe(v.string(), v.maxLength(1000))),
});

export type ModerationEntityType = (typeof moderationEntityTypes)[number];
export type ModerationAction = v.InferOutput<
  typeof moderationReviewSchema
>["action"];
export type ModerationReviewInput = v.InferOutput<
  typeof moderationReviewSchema
>;
type PublicModerationReviewInput = ModerationReviewInput & {
  type: Exclude<ModerationEntityType, "tool">;
};

type ModerationQueueRow = Record<string, unknown> & {
  id: string;
  type: ModerationEntityType;
  url: string;
  title: string | null;
  description: string | null;
  tags: string[];
  submitter: string | null;
  submitter_url: string | null;
  parent_id: string | null;
  parent_title: string | null;
  created_at: string | Date;
};

interface ReviewedRow extends Record<string, unknown> {
  id: string;
  status: "approved" | "rejected";
}

const publicReviewTargets: Record<
  Exclude<ModerationEntityType, "tool">,
  { table: ReturnType<typeof sql.raw>; idColumn: ReturnType<typeof sql.raw> }
> = Object.freeze({
  resource: {
    table: sql.raw("public_listings"),
    idColumn: sql.raw("id"),
  },
  stack: {
    table: sql.raw("public_stacks"),
    idColumn: sql.raw("id"),
  },
  "stack-item": {
    table: sql.raw("public_stack_items"),
    idColumn: sql.raw("id"),
  },
});

function serializeDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapModerationRow(row: ModerationQueueRow) {
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    title: row.title || row.url,
    description: row.description || null,
    tags: row.tags.map((tag) => ({ id: tag, name: tag })),
    submitter: row.submitter,
    submitterUrl: row.submitter_url,
    parent: row.parent_id
      ? {
          id: row.parent_id,
          title: row.parent_title || "Untitled stack",
        }
      : null,
    createdAt: serializeDate(row.created_at),
  };
}

function buildTypePredicate(type: ModerationEntityType | null) {
  return type ? sql`where type = ${type}` : sql``;
}

export function isModerationEntityType(
  type: string,
): type is ModerationEntityType {
  return moderationEntityTypes.includes(type as ModerationEntityType);
}

export async function listPendingModerationItems(
  type: ModerationEntityType | null,
) {
  const db = getDb();
  const result = await db.execute<ModerationQueueRow>(sql`
    select *
    from (
      select
        tool_listings.id,
        'tool'::text as type,
        resources.canonical_url as url,
        tool_listings.page_title as title,
        tool_listings.meta_description as description,
        tool_listings.tags,
          coalesce(
            nullif(btrim(tool_listings.submitter_name), ''),
            case
              when tool_listings.submitted_by_user_id is null then 'Anonymous'
              else 'Signed-in user'
            end
          ) as submitter,
          nullif(btrim(tool_listings.submitter_github_url), '') as submitter_url,
        null::uuid as parent_id,
        null::text as parent_title,
        tool_listings.created_at
      from tool_listings
      inner join resources on tool_listings.resource_id = resources.id
      where tool_listings.status = 'pending'

      union all

      select
        public_listings.id,
        'resource'::text as type,
        resources.canonical_url as url,
        public_listings.page_title as title,
        public_listings.meta_description as description,
        public_listings.tags,
        coalesce(
          nullif(btrim(public_listings.submitter_name), ''),
          case
            when public_listings.submitted_by_user_id is null then 'Anonymous'
            else 'Signed-in user'
          end
        ) as submitter,
        nullif(btrim(public_listings.submitter_github_url), '') as submitter_url,
        null::uuid as parent_id,
        null::text as parent_title,
        public_listings.created_at
      from public_listings
      inner join resources on public_listings.resource_id = resources.id
      where public_listings.status = 'pending'

      union all

      select
        public_stacks.id,
        'stack'::text as type,
        resources.canonical_url as url,
        public_stacks.page_title as title,
        public_stacks.meta_description as description,
        public_stacks.tags,
        public_stacks.owner_user_id::text as submitter,
        null::text as submitter_url,
        null::uuid as parent_id,
        null::text as parent_title,
        public_stacks.created_at
      from public_stacks
      inner join resources on public_stacks.resource_id = resources.id
      where public_stacks.status = 'pending'

      union all

      select
        public_stack_items.id,
        'stack-item'::text as type,
        resources.canonical_url as url,
        public_stack_items.page_title as title,
        public_stack_items.meta_description as description,
        public_stack_items.tags,
        public_stacks.owner_user_id::text as submitter,
        null::text as submitter_url,
        public_stacks.id as parent_id,
        public_stacks.page_title as parent_title,
        public_stack_items.created_at
      from public_stack_items
      inner join public_stacks on public_stack_items.public_stack_id = public_stacks.id
      inner join resources on public_stack_items.resource_id = resources.id
      where public_stack_items.status = 'pending'
    ) pending_moderation_items
    ${buildTypePredicate(type)}
    order by created_at asc
  `);

  return result.rows.map(mapModerationRow);
}

async function reviewTool(review: ModerationReviewInput, reviewerId: string) {
  const { id, action, rejectionCode, rejectionReason } = review;
  const now = new Date();
  const nextStatus = action === "approve" ? "approved" : "rejected";
  const result = await getDb().execute<ReviewedRow>(sql`
    update tool_listings
    set
      status = ${nextStatus},
      approved_at = ${action === "approve" ? now : null},
      reviewed_at = ${now},
      reviewed_by = ${reviewerId},
      rejection_code = ${action === "reject" ? rejectionCode?.trim() || null : null},
      rejection_reason = ${action === "reject" ? rejectionReason?.trim() || null : null},
      updated_at = ${now}
    where id = ${id}
      and status = 'pending'
    returning id, status
  `);

  return result.rows[0];
}

async function reviewPublicEntity(
  review: PublicModerationReviewInput,
  reviewerId: string,
) {
  const { id, type, action, rejectionCode, rejectionReason } = review;
  const now = new Date();
  const nextStatus = action === "approve" ? "approved" : "rejected";
  const target = publicReviewTargets[type];
  const result = await getDb().execute<ReviewedRow>(sql`
    update ${target.table}
    set
      status = ${nextStatus},
      reviewed_at = ${now},
      reviewed_by = ${reviewerId},
      rejection_code = ${action === "reject" ? rejectionCode?.trim() || null : null},
      rejection_reason = ${action === "reject" ? rejectionReason?.trim() || null : null},
      updated_at = ${now}
    where ${target.idColumn} = ${id}
      and status = 'pending'
    returning id, status
  `);

  return result.rows[0];
}

function isPublicModerationReview(
  review: ModerationReviewInput,
): review is PublicModerationReviewInput {
  return review.type !== "tool";
}

export async function reviewModerationItem(
  review: ModerationReviewInput,
  reviewerId: string,
) {
  if (isPublicModerationReview(review)) {
    return await reviewPublicEntity(review, reviewerId);
  }

  return await reviewTool(review, reviewerId);
}
