import { test, expect } from "@playwright/test";

test.describe("Header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays the logo", async ({ page }) => {
    const logo = page.getByRole("link", { name: /maker\s*bench/i });
    await expect(logo).toBeVisible();
  });

  test("logo links to home", async ({ page }) => {
    const logo = page.getByRole("link", { name: /maker\s*bench/i });
    await expect(logo).toHaveAttribute("href", "/");
  });

  test("displays Submit Tool button", async ({ page }) => {
    const submitButton = page.getByRole("button", { name: /submit tool/i });
    await expect(submitButton).toBeVisible();
  });

  test("has primary navigation landmark", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: /primary/i });
    await expect(nav).toBeVisible();
  });
});
