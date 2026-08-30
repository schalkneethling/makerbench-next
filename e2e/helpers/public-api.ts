import type { Page } from "@playwright/test";

export const approvedBrowseTool = {
  id: "approved-browse-tool",
  url: "https://approved-browse-tool.example.com",
  title: "Approved Browse Tool",
  description: "A reviewed tool returned by public browse.",
  imageUrl: null,
  submitterName: null,
  submitterGithubUrl: null,
  createdAt: "2026-07-11T08:00:00.000Z",
  tags: [{ id: "reviewed", name: "reviewed" }],
};

const approvedSearchTool = {
  ...approvedBrowseTool,
  id: "approved-search-tool",
  url: "https://approved-search-tool.example.com",
  title: "Approved Search Tool",
  description: "A reviewed tool returned by public search.",
};

/** Stubs the public Tool APIs with deterministic approved catalog data. */
export async function mockPublicTools(page: Page) {
  await page.route(
    (url) =>
      ["/api/tools", "/api/tools/search", "/api/tools/tags"].includes(
        url.pathname,
      ),
    async (route) => {
      const path = new URL(route.request().url()).pathname;

      if (path === "/api/tools/tags") {
        await route.fulfill({ json: { success: true, data: { tags: [] } } });
        return;
      }

      await route.fulfill({
        json: {
          success: true,
          data: {
            bookmarks: [
              path === "/api/tools/search"
                ? approvedSearchTool
                : approvedBrowseTool,
            ],
            pagination: { total: null, limit: 20, offset: 0, hasMore: false },
          },
        },
      });
    },
  );
}
