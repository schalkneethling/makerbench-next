import { test, expect } from "@playwright/test";

test.describe("HomePage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct page structure", async ({ page }) => {
    // Page has heading and description
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Discover Tools"
    );
    await expect(
      page.getByText("Browse curated tools and resources")
    ).toBeVisible();
  });

  test("has search input", async ({ page }) => {
    // Search input is visible
    const searchInput = page.getByRole("searchbox");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute(
      "placeholder",
      "Search by name or description..."
    );
  });

  test("shows result count", async ({ page }) => {
    // Result count is visible (shows "Showing X of Y tools")
    const resultCount = page.locator(".ResultCount");
    await expect(resultCount).toBeVisible();
    await expect(resultCount).toContainText(/showing \d+ of \d+ tools/i);
  });

  test("search input can receive text", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");

    // Type in search
    await searchInput.fill("react");

    // Input should have the value
    await expect(searchInput).toHaveValue("react");
  });

  test("clear button appears when search has value", async ({ page }) => {
    const searchInput = page.getByRole("searchbox");

    // Clear button should not be visible initially
    await expect(
      page.getByRole("button", { name: /clear search/i })
    ).not.toBeVisible();

    // Type in search
    await searchInput.fill("test");

    // Clear button should appear
    await expect(
      page.getByRole("button", { name: /clear search/i })
    ).toBeVisible();

    // Click clear
    await page.getByRole("button", { name: /clear search/i }).click();

    // Input should be empty
    await expect(searchInput).toHaveValue("");
  });
});

