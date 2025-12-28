import { test, expect } from "@playwright/test";

test.describe("ToolCard", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that renders ToolCard examples
    // For now, we'll need a test page - skip until we have one
    await page.goto("/");
  });

  test.skip("has correct accessible structure", async ({ page }) => {
    await expect(page.locator(".ToolCard").first()).toMatchAriaSnapshot(`
      - article:
        - link:
          - img
          - heading "Tool Title"
          - paragraph: /hostname\\.com/
          - paragraph: Tool description text
        - button "Tag1"
        - button "Tag2"
    `);
  });

  test.skip("external link has proper security attributes", async ({
    page,
  }) => {
    const link = page.locator(".ToolCard-link").first();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

