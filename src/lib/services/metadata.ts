import * as cheerio from "cheerio";

/**
 * Result of metadata extraction from a URL
 */
export interface MetadataResult {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  error?: string;
}

/**
 * Extracts metadata (title, description, OG image) from a URL
 * @param url - URL to fetch and extract metadata from
 * @returns Extracted metadata or null values with error on failure
 */
export async function extractMetadata(url: string): Promise<MetadataResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Makerbench/1.0 (Bookmark Metadata Extractor)",
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      return {
        title: null,
        description: null,
        ogImage: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract OG title, fallback to regular title
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const regularTitle = $("title").text().trim();
    const title = ogTitle || regularTitle || null;

    // Extract OG description, fallback to meta description
    const ogDescription = $('meta[property="og:description"]').attr("content");
    const metaDescription = $('meta[name="description"]').attr("content");
    const description = ogDescription || metaDescription || null;

    // Extract OG image
    const ogImage = $('meta[property="og:image"]').attr("content") || null;

    return { title, description, ogImage };
  } catch (error) {
    return {
      title: null,
      description: null,
      ogImage: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

