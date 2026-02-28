import { test, expect } from "@playwright/test";

test.describe("Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct accessible structure", async ({ page }) => {
    // Use specific class selector - page has multiple <header> elements
    await expect(page.locator(".Header")).toMatchAriaSnapshot(`
      - banner:
        - link "Maker Bench":
          - /url: /
        - navigation "Primary":
          - link "Submit Tool":
            - /url: /submit
    `);
  });
});
