import { expect, test, type Page } from "@playwright/test";

const approvedBrowseTool = {
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

const approvedBrowseResources = [
  {
    id: "approved-article",
    url: "https://example.com/approved-article",
    title: "Approved Article",
    description: "Reviewed long-form guidance.",
    tags: [{ id: "reading", name: "reading" }],
    createdAt: "2026-07-11T10:00:00.000Z",
    kind: "article",
  },
  {
    id: "approved-resource",
    url: "https://example.com/approved-resource",
    title: "Approved Resource",
    description: "A reviewed reference.",
    tags: [{ id: "reference", name: "reference" }],
    createdAt: "2026-07-11T09:00:00.000Z",
    kind: "resource",
  },
  {
    id: "approved-stack",
    url: "https://example.com/approved-stack",
    title: "Approved Stack",
    description: "A reviewed collection.",
    tags: [{ id: "collection", name: "collection" }],
    createdAt: "2026-07-11T08:00:00.000Z",
    kind: "stack",
    children: [
      {
        id: "approved-child",
        url: "https://example.com/approved-child",
        title: "Approved Stack Child",
        description: null,
        tags: [],
      },
    ],
  },
];

const approvedSearchResource = {
  id: "approved-search-article",
  url: "https://example.com/approved-search-article",
  title: "Approved Search Article",
  description: "Reviewed guidance returned by resource search.",
  tags: [{ id: "search", name: "search" }],
  createdAt: "2026-07-11T11:00:00.000Z",
  kind: "article",
};

async function mockPublicTools(page: Page) {
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

async function mockPublicResources(page: Page) {
  await page.route(
    (url) => ["/api/resources", "/api/resources/search"].includes(url.pathname),
    async (route) => {
      const path = new URL(route.request().url()).pathname;

      await route.fulfill({
        json: {
          success: true,
          data: {
            resources:
              path === "/api/resources/search"
                ? [approvedSearchResource]
                : approvedBrowseResources,
            pagination: {
              total: path === "/api/resources/search" ? 1 : 3,
              limit: 20,
              offset: 0,
              hasMore: false,
            },
          },
        },
      });
    },
  );
}

// These E2E cases prove that approved API responses render on each public route.
// Function query tests own pending/rejected exclusion because public payloads omit status.
test.describe("public publication surfaces", () => {
  for (const route of ["/", "/tools"]) {
    test(`renders approved tools on ${route}`, async ({ page }) => {
      await mockPublicTools(page);
      await page.goto(route);
      await expect(
        page.getByRole("link", { name: "Approved Browse Tool" }),
      ).toBeVisible();

      await expect(page.locator(".ToolGrid")).toMatchAriaSnapshot(`
        - article:
          - link "Approved Browse Tool":
            - /url: https://approved-browse-tool.example.com
            - heading "Approved Browse Tool" [level=3]
            - paragraph: approved-browse-tool.example.com
            - paragraph: A reviewed tool returned by public browse.
          - button "reviewed"
      `);
    });
  }

  test("renders approved tool search results from the search endpoint", async ({
    page,
  }) => {
    await mockPublicTools(page);
    await page.goto("/tools");
    await page
      .getByRole("searchbox", { name: "Search by title or tag" })
      .fill("search");
    await expect(
      page.getByRole("link", { name: "Approved Search Tool" }),
    ).toBeVisible();

    await expect(page.locator(".ToolGrid")).toMatchAriaSnapshot(`
      - article:
        - link "Approved Search Tool":
          - /url: https://approved-search-tool.example.com
          - heading "Approved Search Tool" [level=3]
          - paragraph: approved-search-tool.example.com
          - paragraph: A reviewed tool returned by public search.
        - button "reviewed"
    `);
  });

  test("renders approved resource kinds and only approved stack children", async ({
    page,
  }) => {
    await mockPublicResources(page);
    await page.goto("/resources");
    await page.getByText("1 resources in this stack").click();

    await expect(page.locator(".ResourceGrid")).toMatchAriaSnapshot(`
      - article:
        - link "Approved Article":
          - text: Article
          - heading "Approved Article" [level=3]
          - paragraph: example.com
          - paragraph: Reviewed long-form guidance.
        - button "reading"
      - article:
        - link "Approved Resource":
          - text: Resource
          - heading "Approved Resource" [level=3]
          - paragraph: example.com
          - paragraph: A reviewed reference.
        - button "reference"
      - article:
        - link "Approved Stack":
          - text: Stack
          - heading "Approved Stack" [level=3]
          - paragraph: example.com
          - paragraph: A reviewed collection.
        - button "collection"
        - group:
          - text: 1 resources in this stack
          - list:
            - listitem:
              - link "Approved Stack Child"
              - text: example.com
    `);
  });

  test("renders approved resource search results from the search endpoint", async ({
    page,
  }) => {
    await mockPublicResources(page);
    await page.goto("/resources");
    await page
      .getByRole("searchbox", { name: "Search resources" })
      .fill("search");
    await expect(
      page.getByRole("link", { name: "Approved Search Article" }),
    ).toBeVisible();

    await expect(page.locator(".ResourceGrid")).toMatchAriaSnapshot(`
      - article:
        - link "Approved Search Article":
          - text: Article
          - heading "Approved Search Article" [level=3]
          - paragraph: example.com
          - paragraph: Reviewed guidance returned by resource search.
        - button "search"
    `);
  });
});
