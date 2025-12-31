import { test, expect } from "@playwright/test";

/**
 * E2E tests for SearchInput component.
 * Tests accessible structure and conditional rendering.
 * Skipped until SearchInput is rendered on a page (HomePage).
 */
test.describe("SearchInput", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that renders SearchInput
    // For now, we'll need a test page - skip until we have one
    await page.goto("/");
  });

  // TODO: Unskip when SearchInput is rendered on a page
  test.skip("has correct accessible structure", async ({ page }) => {
    // Verify:
    // - Visually hidden label for screen readers
    // - Searchbox with proper labeling (type="search" gives role searchbox)
    // - Clear button only when value present
    await expect(page.locator(".SearchInput").first()).toMatchAriaSnapshot(`
      - searchbox "Search tools"
    `);
  });

  // TODO: Unskip when SearchInput is rendered on a page
  test.skip("clear button appears when value is entered", async ({ page }) => {
    const searchInput = page.getByRole("searchbox", { name: /search/i }).first();

    // Initially no clear button
    await expect(
      page.getByRole("button", { name: /clear search/i }),
    ).not.toBeVisible();

    // Type in search
    await searchInput.fill("test query");

    // Clear button should appear
    await expect(
      page.getByRole("button", { name: /clear search/i }),
    ).toBeVisible();
  });

});

