import { test, expect } from "@playwright/test";

test.describe("MainLayout", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct accessible structure", async ({ page }) => {
    // Verify full layout structure with skip link, header, main, footer
    // Note: Tests high-level landmarks only, not page content (which varies)
    await expect(page.locator(".MainLayout")).toMatchAriaSnapshot(`
      - link "Skip to main content"
      - banner:
        - link "Maker Bench"
        - navigation "Primary":
          - link "Submit Tool"
      - main
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

  test("skip link targets main content", async ({ page }) => {
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toHaveAttribute("href", "#main-content");
    await expect(page.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  // Skip webkit browsers - Safari has different keyboard focus behavior
  // that requires explicit user preference for tab navigation
  test("skip link becomes visible on focus", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "Safari requires user preference for tab focus"
    );

    const skipLink = page.getByRole("link", { name: "Skip to main content" });

    // Tab to focus the skip link
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });
});

