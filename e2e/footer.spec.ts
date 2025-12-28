import { test, expect } from "@playwright/test";

test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct accessible structure", async ({ page }) => {
    await expect(page.locator("footer")).toMatchAriaSnapshot(`
      - contentinfo:
        - paragraph: /© \\d{4} MakerBench/
        - navigation "Footer":
          - list:
            - listitem:
              - link "About"
            - listitem:
              - link "Privacy"
            - listitem:
              - link "GitHub"
    `);
  });
});
