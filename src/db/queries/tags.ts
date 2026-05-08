import { sql } from "drizzle-orm";
import { db } from "../index";

interface TagUsageRow extends Record<string, unknown> {
  name: string;
  usage_count: number;
}

export async function getAllTags(limit = 100, offset = 0) {
  const result = await db.execute<TagUsageRow>(sql`
    select distinct t.tag_name as name
    from tool_listings
    cross join unnest(tags) as t(tag_name)
    where status = 'approved'
    order by t.tag_name asc
    limit ${limit}
    offset ${offset}
  `);

  return result.rows.map((row) => ({ id: row.name, name: row.name }));
}

export async function getTagById(id: string) {
  return getTagByName(id);
}

export async function getTagByName(name: string) {
  const result = await db.execute<TagUsageRow>(sql`
    select distinct t.tag_name as name
    from tool_listings
    cross join unnest(tags) as t(tag_name)
    where status = 'approved'
      and t.tag_name = ${name}
    limit 1
  `);

  const row = result.rows[0];
  return row ? { id: row.name, name: row.name } : undefined;
}

export async function searchTagsByName(
  searchTerm: string,
  limit = 50,
  offset = 0,
) {
  const result = await db.execute<TagUsageRow>(sql`
    select distinct t.tag_name as name
    from tool_listings
    cross join unnest(tags) as t(tag_name)
    where status = 'approved'
      and t.tag_name ilike ${`%${searchTerm}%`}
    order by t.tag_name asc
    limit ${limit}
    offset ${offset}
  `);

  return result.rows.map((row) => ({ id: row.name, name: row.name }));
}

export async function getPopularTags(limit = 20) {
  const result = await db.execute<TagUsageRow>(sql`
    select
      t.tag_name as name,
      count(*)::int as usage_count
    from tool_listings
    cross join unnest(tags) as t(tag_name)
    where status = 'approved'
    group by t.tag_name
    order by usage_count desc, t.tag_name asc
    limit ${limit}
  `);

  return result.rows.map((row) => ({
    tag: { id: row.name, name: row.name },
    count: row.usage_count,
  }));
}
