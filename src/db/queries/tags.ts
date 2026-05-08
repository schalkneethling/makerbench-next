import { sql } from "drizzle-orm";
import { db } from "../index";

interface TagUsageRow extends Record<string, unknown> {
  name: string;
  usage_count: number;
}

export async function getAllTags(limit = 100, offset = 0) {
  const result = await db.execute<TagUsageRow>(sql`
    select distinct tag_name as name
    from tool_listings
    cross join unnest(tags) as tag_name
    order by tag_name asc
    limit ${limit}
    offset ${offset}
  `);

  return result.rows.map((row) => ({ id: row.name, name: row.name }));
}

export async function getTagById(id: string) {
  const rows = await getAllTags();
  return rows.filter((tag) => tag.id === id);
}

export async function getTagByName(name: string) {
  const rows = await getAllTags();
  return rows.filter((tag) => tag.name === name);
}

export async function searchTagsByName(
  searchTerm: string,
  limit = 50,
  offset = 0,
) {
  const result = await db.execute<TagUsageRow>(sql`
    select distinct tag_name as name
    from tool_listings
    cross join unnest(tags) as tag_name
    where tag_name ilike ${`%${searchTerm}%`}
    order by tag_name asc
    limit ${limit}
    offset ${offset}
  `);

  return result.rows.map((row) => ({ id: row.name, name: row.name }));
}

export async function getPopularTags(limit = 20) {
  const result = await db.execute<TagUsageRow>(sql`
    select
      tag_name as name,
      count(*)::int as usage_count
    from tool_listings
    cross join unnest(tags) as tag_name
    where status = 'approved'
    group by tag_name
    order by usage_count desc, tag_name asc
    limit ${limit}
  `);

  return result.rows.map((row) => ({
    tag: { id: row.name, name: row.name },
    count: row.usage_count,
  }));
}
