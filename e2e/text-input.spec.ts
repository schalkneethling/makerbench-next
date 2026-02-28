import { test, expect } from "@playwright/test";

test.describe("TextInput", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page that renders TextInput examples
    // For now, we'll need a test page - skip until we have one
    await page.goto("/");
  });

  test.skip("has correct accessible structure with label", async ({ page }) => {
    await expect(page.locator(".TextInput").first()).toMatchAriaSnapshot(`
      - text: Label text
      - textbox
    `);
  });

  test.skip("has correct accessible structure with error", async ({ page }) => {
    await expect(page.locator(".TextInput--error").first()).toMatchAriaSnapshot(`
      - text: Label text
      - textbox:
        - /aria-invalid: true
      - alert: Error message
    `);
  });

  test.skip("has correct accessible structure with hint", async ({ page }) => {
    await expect(page.locator(".TextInput").first()).toMatchAriaSnapshot(`
      - text: Label text
      - text: Hint text
      - textbox
    `);
  });
});

