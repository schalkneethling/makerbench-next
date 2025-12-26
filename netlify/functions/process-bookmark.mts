import type { Context, Config } from "@netlify/functions";
import { eq } from "drizzle-orm";

import {
  getDb,
  bookmarksTable,
  tagsTable,
  bookmarkTagsTable,
  created,
  validationError,
  conflict,
  serverError,
  methodNotAllowed,
  parseAndNormalizeUrl,
} from "./lib";
import { extractMetadata } from "../../src/lib/services/metadata";
import { captureScreenshot } from "../../src/lib/services/screenshot";
import { uploadScreenshot } from "../../src/lib/services/cloudinary";
import { validateBookmarkRequest } from "../../src/lib/validation";

const FALLBACK_IMAGE = "/images/fallback-screenshot.png";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  // Validate request using Zod
  const validation = validateBookmarkRequest(body);
  if (!validation.success) {
    return validationError("Validation failed", validation.error.flatten().fieldErrors);
  }

  const { url, tags: rawTags, submitterName, submitterGithubUrl } = validation.data;

  // Normalize URL (additional check for HTTP/HTTPS)
  const normalizedUrl = parseAndNormalizeUrl(url);
  if (!normalizedUrl) {
    return validationError("Validation failed", { url: ["Please enter a valid HTTP/HTTPS URL"] });
  }

  // Normalize tags
  const tags = rawTags.map((t) => t.trim().toLowerCase());

  try {
    const db = getDb();

    // Check for duplicate URL
    const existing = await db
      .select({ id: bookmarksTable.id })
      .from(bookmarksTable)
      .where(eq(bookmarksTable.url, normalizedUrl))
      .limit(1);

    if (existing.length > 0) {
      return conflict("This URL has already been submitted");
    }

    // Extract metadata from page
    const metadata = await extractMetadata(normalizedUrl);

    // Determine image
    let imageUrl: string = FALLBACK_IMAGE;
    let imageSource: "og" | "screenshot" | "fallback" = "fallback";

    if (metadata.ogImage) {
      imageUrl = metadata.ogImage;
      imageSource = "og";
    } else {
      // Try to capture screenshot
      const screenshot = await captureScreenshot(normalizedUrl);
      if (screenshot.success && screenshot.buffer) {
        const bookmarkId = crypto.randomUUID();
        const upload = await uploadScreenshot(screenshot.buffer, bookmarkId);
        if (upload.success && upload.url) {
          imageUrl = upload.url;
          imageSource = "screenshot";
        }
      }
    }

    // Create bookmark
    const bookmarkId = crypto.randomUUID();
    const [bookmark] = await db
      .insert(bookmarksTable)
      .values({
        id: bookmarkId,
        url: normalizedUrl,
        title: metadata.title || normalizedUrl,
        description: metadata.description,
        status: "pending",
        imageUrl,
        imageSource,
        submitterName,
        submitterGithubUrl,
      })
      .returning();

    // Create/link tags
    for (const tagName of tags) {
      // Find or create tag
      let [tag] = await db
        .select()
        .from(tagsTable)
        .where(eq(tagsTable.name, tagName))
        .limit(1);

      if (!tag) {
        [tag] = await db
          .insert(tagsTable)
          .values({ id: crypto.randomUUID(), name: tagName })
          .returning();
      }

      // Link tag to bookmark
      await db.insert(bookmarkTagsTable).values({
        id: crypto.randomUUID(),
        bookmarkId: bookmark.id,
        tagId: tag.id,
      });
    }

    return created({
      bookmarkId: bookmark.id,
      message: "Bookmark submitted. It will be reviewed shortly.",
    });
  } catch (error) {
    console.error("Error processing bookmark:", error);
    return serverError("An error occurred while processing the bookmark");
  }
};

export const config: Config = {
  path: "/api/bookmarks",
  method: "POST",
};

