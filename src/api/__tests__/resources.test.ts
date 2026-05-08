import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { getResources, searchResources } from "../resources";
import { server } from "../../test/mocks/server";

const API_BASE = "http://localhost:8888";

describe("resources API", () => {
  it("fetches public resources and stacks", async () => {
    server.use(
      http.get(`${API_BASE}/api/resources`, () =>
        HttpResponse.json({
          success: true,
          data: {
            resources: [
              {
                id: "resource-1",
                url: "https://example.com/article",
                title: "Example Article",
                description: "Useful reading",
                tags: [{ id: "reading", name: "reading" }],
                createdAt: "2024-01-01",
                kind: "resource",
              },
              {
                id: "stack-1",
                url: "https://example.com/stack",
                title: "Example Stack",
                description: null,
                tags: [],
                createdAt: "2024-01-02",
                kind: "stack",
                children: [
                  {
                    id: "child-1",
                    url: "https://example.com/child",
                    title: "Child Resource",
                    description: null,
                    tags: [],
                  },
                ],
              },
            ],
            pagination: {
              total: null,
              limit: 20,
              offset: 0,
              hasMore: false,
            },
          },
        }),
      ),
    );

    const result = await getResources();

    expect(result.resources).toHaveLength(2);
    expect(result.resources[1].kind).toBe("stack");
    expect(result.resources[1].children).toHaveLength(1);
  });

  it("passes search params through", async () => {
    let requestedUrl = "";

    server.use(
      http.get(`${API_BASE}/api/resources/search`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          success: true,
          data: {
            resources: [],
            pagination: {
              total: null,
              limit: 10,
              offset: 0,
              hasMore: false,
            },
          },
        });
      }),
    );

    await searchResources({ q: "react", tags: ["docs"], limit: 10 });

    const searchParams = new URL(requestedUrl).searchParams;

    expect(searchParams.get("q")).toBe("react");
    expect(searchParams.get("tags")).toBe("docs");
    expect(searchParams.get("limit")).toBe("10");
  });
});
