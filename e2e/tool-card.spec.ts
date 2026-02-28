import { test, expect } from "@playwright/test";

/**
 * E2E tests for ToolCard component.
 * Tests accessible structure and user interactions.
 * Skipped until ToolCard is rendered on a page.
 */
test.describe("ToolCard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // TODO: Unskip when ToolCard is rendered on a page
  test.skip("has correct accessible structure", async ({ page }) => {
    // Single ARIA snapshot tests:
    // - article element wrapping
    // - link with accessible name from title (aria-labelledby)
    // - decorative image (no accessible name)
    // - heading with title
    // - hostname display
    // - description display
    // - tag badges as buttons
    await expect(page.locator(".ToolCard").first()).toMatchAriaSnapshot(`
      - article:
        - link "Tool Title":
          - img
          - heading "Tool Title" [level=3]
          - paragraph: /hostname\\.com/
          - paragraph: Tool description text
        - button "Tag1"
        - button "Tag2"
    `);
  });

  // TODO: Unskip when ToolCard is rendered on a page
  test.skip("tag click navigates to filter", async ({ page }) => {
    await page.getByRole("button", { name: "Tag1" }).first().click();
    await expect(page).toHaveURL(/\?tags=Tag1/);
  });
});
