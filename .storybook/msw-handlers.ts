import { http, HttpResponse } from "msw";

const mockBookmark = {
  id: "b1",
  url: "https://example.com/tool-1",
  title: "Example Tool",
  description: "A great tool for makers",
  imageUrl: "https://example.com/image1.png",
  submitterName: "Jane Developer",
  submitterGithubUrl: "https://github.com/janedoe",
  createdAt: "2024-04-01T12:00:00Z",
  tags: [{ id: "t1", name: "javascript" }],
};

const mockResource = {
  id: "r1",
  url: "https://example.com/resource",
  title: "Example Resource",
  description: "Helpful documentation for makers",
  tags: [{ id: "rt1", name: "docs" }],
  createdAt: "2024-04-01T12:00:00Z",
  kind: "resource" as const,
};

/** MSW handlers for Storybook stories that exercise API routes. */
export const mswHandlers = {
  auth: [
    http.get("/api/auth/whoami", () => {
      return HttpResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }),
  ],
  tools: [
    http.get("/api/tools", ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const offset = Number(url.searchParams.get("offset") ?? "0");

      return HttpResponse.json({
        success: true,
        data: {
          bookmarks: offset === 0 ? [mockBookmark] : [],
          pagination: {
            total: 1,
            limit,
            offset,
            hasMore: false,
          },
        },
      });
    }),
  ],
  resources: [
    http.get("/api/resources", ({ request }) => {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const offset = Number(url.searchParams.get("offset") ?? "0");

      return HttpResponse.json({
        success: true,
        data: {
          resources: offset === 0 ? [mockResource] : [],
          pagination: {
            total: 1,
            limit,
            offset,
            hasMore: false,
          },
        },
      });
    }),
  ],
};
