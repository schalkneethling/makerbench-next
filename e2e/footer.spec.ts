import { test, expect } from "@playwright/test";

test.describe("Footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays copyright text", async ({ page }) => {
    const copyright = page.getByText(/© \d{4} MakerBench/);
    await expect(copyright).toBeVisible();
  });

  test("has footer navigation landmark", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: /footer/i });
    await expect(nav).toBeVisible();
  });

  test("displays About link", async ({ page }) => {
    const aboutLink = page.getByRole("link", { name: /about/i });
    await expect(aboutLink).toBeVisible();
    await expect(aboutLink).toHaveAttribute("href", "/about");
  });

  test("displays Privacy link", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /privacy/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", "/privacy");
  });

  test("displays GitHub link with external attributes", async ({ page }) => {
    const githubLink = page.getByRole("link", { name: /github/i });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute("target", "_blank");
    await expect(githubLink).toHaveAttribute("rel", /noopener/);
  });
});
