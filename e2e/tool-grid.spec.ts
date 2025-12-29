import { test, expect } from "@playwright/test";

/**
 * E2E tests for ToolGrid component.
 * Tests responsive layout, loading states, and empty states.
 * Skipped until ToolGrid is rendered on a page (HomePage).
 */
test.describe("ToolGrid", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // TODO: Unskip when ToolGrid is rendered on a page
  test.skip("displays tools in a grid layout", async ({ page }) => {
    // Wait for tools to load
    await expect(page.locator(".ToolGrid")).toBeVisible();

    // Should contain multiple ToolCards
    const cards = page.locator(".ToolCard");
    await expect(cards.first()).toBeVisible();
  });

  // TODO: Unskip when ToolGrid is rendered on a page
  test.skip("loading state shows skeleton cards", async ({ page }) => {
    // Intercept API to delay response
    await page.route("**/api/bookmarks*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    await page.goto("/");

    // Check loading state is accessible
    const grid = page.locator(".ToolGrid");
    await expect(grid).toHaveAttribute("aria-busy", "true");
    await expect(grid).toHaveAttribute("aria-label", "Loading tools");

    // Should show skeleton cards
    await expect(page.locator(".ToolCardSkeleton").first()).toBeVisible();
  });

  // TODO: Unskip when ToolGrid is rendered on a page
  test.skip("empty state displays message", async ({ page }) => {
    // Intercept API to return empty array
    await page.route("**/api/bookmarks*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], total: 0 }),
      });
    });

    await page.goto("/");

    // Check empty state structure
    await expect(page.locator(".ToolGrid-empty")).toMatchAriaSnapshot(`
      - heading "No tools found" [level=2]
      - paragraph: /Try adjusting/
    `);
  });

  // TODO: Unskip when ToolGrid is rendered on a page
  test.skip("responsive: 1 column on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    const grid = page.locator(".ToolGrid");
    await expect(grid).toHaveCSS("grid-template-columns", /^[^,]+$/);
  });

  // TODO: Unskip when ToolGrid is rendered on a page
  test.skip("responsive: 2 columns on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");

    const grid = page.locator(".ToolGrid");
    // 2 columns shows as two values in computed style
    const columns = await grid.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns
    );
    const columnCount = columns.split(" ").length;
    expect(columnCount).toBe(2);
  });

  // TODO: Unskip when ToolGrid is rendered on a page
  test.skip("responsive: 3 columns on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const grid = page.locator(".ToolGrid");
    const columns = await grid.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns
    );
    const columnCount = columns.split(" ").length;
    expect(columnCount).toBe(3);
  });
});

