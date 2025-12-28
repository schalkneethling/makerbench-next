import { test, expect } from "@playwright/test";

test.describe("Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct accessible structure", async ({ page }) => {
    await expect(page.locator("header")).toMatchAriaSnapshot(`
      - banner:
        - link "Maker Bench":
          - /url: /
        - navigation "Primary":
          - button "Submit Tool"
    `);
  });
});
