import { test, expect } from "@playwright/test";
import { mockPublicTools } from "./helpers/public-api";

test.describe("HomePage", () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicTools(page);
    await page.goto("/");
  });

  test("has correct accessible structure", async ({ page }) => {
    await expect(page.locator("main")).toMatchAriaSnapshot(`
      - main:
        - heading "Find the right tool for the job" [level=1]
        - paragraph: Browse practical software, references, and resources for makers.
        - search:
          - text: Search by title or tag
          - searchbox "Search by title or tag"
        - paragraph: Showing 1 tools
        - article:
          - link "Approved Browse Tool":
            - /url: https://approved-browse-tool.example.com
            - heading "Approved Browse Tool" [level=3]
            - paragraph: approved-browse-tool.example.com
            - paragraph: A reviewed tool returned by public browse.
          - button "reviewed"
    `);
  });

  test("clear button appears when search has value", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");

    await expect(
      page.getByRole("button", { name: /clear search/i }),
    ).not.toBeVisible();

    await searchInput.fill("test");

    await expect(
      page.getByRole("button", { name: /clear search/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /clear search/i }).click();

    await expect(searchInput).toHaveValue("");
  });

  test("syncs search state to URL and restores it on reload", async ({
    page,
  }) => {
    const searchInput = page.getByRole("searchbox", {
      name: "Search by title or tag",
    });

    await searchInput.fill("react");

    await expect(page).toHaveURL(/[?&]q=react(?:&|$)/);
    await expect(page).toHaveURL(/[?&]mode=search(?:&|$)/);

    await page.reload();

    await expect(searchInput).toHaveValue("react");
    await expect(page).toHaveURL(/[?&]q=react(?:&|$)/);
    await expect(page).toHaveURL(/[?&]mode=search(?:&|$)/);
  });
});
