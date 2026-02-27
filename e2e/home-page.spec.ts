import { test, expect } from "@playwright/test";

test.describe("HomePage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct accessible structure", async ({ page }) => {
    await expect(page.locator("main")).toMatchAriaSnapshot(`
      - main:
        - heading "Discover Tools" [level=1]
        - paragraph: Browse curated tools and resources for makers.
        - search:
          - searchbox "Search by title or tag"
        - paragraph: /Showing \\d+ of \\d+ tools/
    `);
  });

  test("clear button appears when search has value", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");

    await expect(
      page.getByRole("button", { name: /clear search/i })
    ).not.toBeVisible();

    await searchInput.fill("test");

    await expect(
      page.getByRole("button", { name: /clear search/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /clear search/i }).click();

    await expect(searchInput).toHaveValue("");
  });
});
