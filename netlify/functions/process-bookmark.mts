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

const FALLBACK_IMAGE = "/images/fallback-screenshot.png";
const MAX_TAGS = 10;

interface BookmarkRequest {
  url: string;
  tags: string[];
  submitterName?: string;
  submitterGithubUrl?: string;
}

/**
 * Validates the bookmark submission request
 */
function validateRequest(
  body: unknown
): { valid: true; data: BookmarkRequest } | { valid: false; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: { body: ["Request body is required"] } };
  }

  const data = body as Record<string, unknown>;

  // Validate URL
  if (!data.url || typeof data.url !== "string") {
    errors.url = ["URL is required"];
  } else if (!parseAndNormalizeUrl(data.url)) {
    errors.url = ["Please enter a valid HTTP/HTTPS URL"];
  } else if (data.url.length > 2000) {
    errors.url = ["URL must be 2000 characters or less"];
  }

  // Validate tags
  if (!data.tags || !Array.isArray(data.tags)) {
    errors.tags = ["At least one tag is required"];
  } else if (data.tags.length === 0) {
    errors.tags = ["At least one tag is required"];
  } else if (data.tags.length > MAX_TAGS) {
    errors.tags = [`Maximum ${MAX_TAGS} tags allowed`];
  } else {
    const invalidTags = data.tags.filter(
      (t) => typeof t !== "string" || t.trim().length === 0 || t.length > 50
    );
    if (invalidTags.length > 0) {
      errors.tags = ["Tags must be non-empty strings of 50 characters or less"];
    }
  }

  // Validate optional fields
  if (data.submitterName && typeof data.submitterName === "string" && data.submitterName.length > 100) {
    errors.submitterName = ["Name must be 100 characters or less"];
  }

  if (data.submitterGithubUrl && typeof data.submitterGithubUrl === "string") {
    try {
      const ghUrl = new URL(data.submitterGithubUrl);
      if (!ghUrl.hostname.includes("github.com")) {
        errors.submitterGithubUrl = ["Please enter a valid GitHub URL"];
      }
    } catch {
      errors.submitterGithubUrl = ["Please enter a valid GitHub URL"];
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      url: data.url as string,
      tags: (data.tags as string[]).map((t) => t.trim().toLowerCase()),
      submitterName: data.submitterName as string | undefined,
      submitterGithubUrl: data.submitterGithubUrl as string | undefined,
    },
  };
}

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

  // Validate request
  const validation = validateRequest(body);
  if (!validation.valid) {
    return validationError("Validation failed", validation.errors);
  }

  const { url, tags, submitterName, submitterGithubUrl } = validation.data;
  const normalizedUrl = parseAndNormalizeUrl(url)!;

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

