import { expect, test, type Page } from "@playwright/test";

const approvedTool = {
  id: "approved-tool",
  url: "https://approved-tool.example.com",
  title: "Approved Tool",
  description: "A reviewed tool for public discovery.",
  imageUrl: null,
  submitterName: null,
  submitterGithubUrl: null,
  createdAt: "2026-07-11T08:00:00.000Z",
  tags: [{ id: "reviewed", name: "reviewed" }],
};

const approvedResources = [
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
            bookmarks: [approvedTool],
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
      await route.fulfill({
        json: {
          success: true,
          data: {
            resources: approvedResources,
            pagination: { total: 3, limit: 20, offset: 0, hasMore: false },
          },
        },
      });
    },
  );
}

test.describe("public publication surfaces", () => {
  for (const route of ["/", "/tools"]) {
    test(`renders approved tools on ${route}`, async ({ page }) => {
      await mockPublicTools(page);
      await page.goto(route);
      await expect(page.getByRole("link", { name: "Approved Tool" })).toBeVisible();

      await expect(page.locator(".ToolGrid")).toMatchAriaSnapshot(`
        - article:
          - link "Approved Tool":
            - /url: https://approved-tool.example.com
            - heading "Approved Tool" [level=3]
            - paragraph: approved-tool.example.com
            - paragraph: A reviewed tool for public discovery.
          - button "reviewed"
      `);
      await expect(page.getByText(/Pending|Rejected/)).toHaveCount(0);
    });
  }

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
    await expect(page.getByText(/Pending|Rejected/)).toHaveCount(0);
  });
});
