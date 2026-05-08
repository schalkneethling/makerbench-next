import { readFile } from "node:fs/promises";

import { normalizeUrl } from "../netlify/functions/lib/url";

interface TursoBookmark {
  id: string;
  url: string;
  title?: string | null;
  description?: string | null;
  status: "pending" | "approved" | "rejected";
  image_url?: string | null;
  imageSource?: string | null;
  image_source?: string | null;
  submitter_name?: string | null;
  submitterName?: string | null;
  submitter_github_url?: string | null;
  submitterGithubUrl?: string | null;
  metadata?: string | null;
  created_at?: string;
  createdAt?: string;
  approved_at?: string | null;
  approvedAt?: string | null;
  updated_at?: string;
  updatedAt?: string;
}

interface TursoTag {
  id: string;
  name: string;
}

interface TursoBookmarkTag {
  bookmark_id?: string;
  bookmarkId?: string;
  tag_id?: string;
  tagId?: string;
}

interface TursoExport {
  bookmarks: TursoBookmark[];
  tags: TursoTag[];
  bookmark_tags?: TursoBookmarkTag[];
  bookmarkTags?: TursoBookmarkTag[];
}

function getArgValue(name: string): string | undefined {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  return arg?.slice(name.length + 1);
}

function toDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getInvalidTimestampFields(bookmark: TursoBookmark): string[] {
  const fields = [
    ["created_at", bookmark.created_at ?? bookmark.createdAt],
    ["updated_at", bookmark.updated_at ?? bookmark.updatedAt],
    ["approved_at", bookmark.approved_at ?? bookmark.approvedAt],
  ] as const;

  return fields
    .filter(([, value]) => value && !toDate(value))
    .map(([fieldName]) => fieldName);
}

function getBookmarkTags(exportData: TursoExport): Map<string, string[]> {
  const tagsById = new Map(exportData.tags.map((tag) => [tag.id, tag.name]));
  const bookmarkTags = exportData.bookmark_tags ?? exportData.bookmarkTags ?? [];
  const tagsByBookmarkId = new Map<string, string[]>();

  for (const bookmarkTag of bookmarkTags) {
    const bookmarkId = bookmarkTag.bookmark_id ?? bookmarkTag.bookmarkId;
    const tagId = bookmarkTag.tag_id ?? bookmarkTag.tagId;

    if (!bookmarkId || !tagId) {
      continue;
    }

    const tagName = tagsById.get(tagId);
    if (!tagName) {
      continue;
    }

    const tags = tagsByBookmarkId.get(bookmarkId) ?? [];
    tags.push(tagName.trim().toLowerCase());
    tagsByBookmarkId.set(bookmarkId, tags);
  }

  return tagsByBookmarkId;
}

async function readExport(path: string): Promise<TursoExport> {
  return JSON.parse(await readFile(path, "utf8")) as TursoExport;
}

async function run() {
  const sourcePath = getArgValue("--source");
  const shouldExecute = process.argv.includes("--execute");

  if (!sourcePath) {
    throw new Error(
      "Usage: pnpm migrate:makerbench-turso --source=./makerbench-export.json [--execute]",
    );
  }

  const exportData = await readExport(sourcePath);
  const tagsByBookmarkId = getBookmarkTags(exportData);
  const normalizedUrls = exportData.bookmarks.map((bookmark) =>
    normalizeUrl(bookmark.url),
  );
  const duplicateUrls = normalizedUrls.filter(
    (url, index) => normalizedUrls.indexOf(url) !== index,
  );
  const invalidTimestampRows = exportData.bookmarks
    .map((bookmark) => ({
      id: bookmark.id,
      fields: getInvalidTimestampFields(bookmark),
    }))
    .filter((row) => row.fields.length > 0);

  console.info("MakerBench Turso import dry-run", {
    mode: shouldExecute ? "execute" : "dry-run",
    bookmarks: exportData.bookmarks.length,
    tags: exportData.tags.length,
    bookmarkTags:
      exportData.bookmark_tags?.length ?? exportData.bookmarkTags?.length ?? 0,
    duplicateUrls: [...new Set(duplicateUrls)].length,
    invalidTimestampRows: invalidTimestampRows.length,
  });

  if (invalidTimestampRows.length > 0) {
    console.info(
      "Rows with invalid timestamps will import those fields as null",
      JSON.stringify({ rows: invalidTimestampRows }, null, 2),
    );
  }

  if (!shouldExecute) {
    return;
  }

  const [{ eq }, { db }, { resourcesTable, toolListingsTable }] =
    await Promise.all([
      import("drizzle-orm"),
      import("../src/db"),
      import("../src/db/schema"),
    ]);
  let inserted = 0;
  let skipped = 0;

  for (const bookmark of exportData.bookmarks) {
    const normalizedUrl = normalizeUrl(bookmark.url);
    const [existingResource] = await db
      .select({ id: resourcesTable.id })
      .from(resourcesTable)
      .where(eq(resourcesTable.normalizedUrl, normalizedUrl))
      .limit(1);
    const resource =
      existingResource ??
      (
        await db
          .insert(resourcesTable)
          .values({
            normalizedUrl,
            canonicalUrl: bookmark.url,
            pageTitle: bookmark.title ?? bookmark.url,
            metaDescription: bookmark.description ?? "",
            createdAt: toDate(bookmark.created_at ?? bookmark.createdAt),
            updatedAt: toDate(bookmark.updated_at ?? bookmark.updatedAt),
          })
          .returning({ id: resourcesTable.id })
      )[0];
    const [existingTool] = await db
      .select({ id: toolListingsTable.id })
      .from(toolListingsTable)
      .where(eq(toolListingsTable.resourceId, resource.id))
      .limit(1);

    if (existingTool) {
      skipped += 1;
      continue;
    }

    await db.insert(toolListingsTable).values({
      id: bookmark.id,
      resourceId: resource.id,
      status: bookmark.status,
      pageTitle: bookmark.title ?? bookmark.url,
      metaDescription: bookmark.description ?? "",
      tags: [...new Set(tagsByBookmarkId.get(bookmark.id) ?? [])],
      imageUrl: bookmark.image_url ?? null,
      imageSource:
        bookmark.image_source ??
        (bookmark.imageSource as "og" | "screenshot" | "fallback" | null) ??
        null,
      submitterName: bookmark.submitter_name ?? bookmark.submitterName ?? null,
      submitterGithubUrl:
        bookmark.submitter_github_url ?? bookmark.submitterGithubUrl ?? null,
      metadata: bookmark.metadata ?? null,
      approvedAt: toDate(bookmark.approved_at ?? bookmark.approvedAt),
      createdAt: toDate(bookmark.created_at ?? bookmark.createdAt),
      updatedAt: toDate(bookmark.updated_at ?? bookmark.updatedAt),
    });
    inserted += 1;
  }

  console.info("MakerBench Turso import complete", { inserted, skipped });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
