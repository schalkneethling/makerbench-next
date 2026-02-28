import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("logo navigates to homepage", async ({ page }) => {
    await page.goto("/submit");
    await page.getByRole("link", { name: "Maker Bench" }).click();
    await expect(page).toHaveURL("/");
  });

  test("Submit Tool link navigates to submit page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Submit Tool" }).click();
    await expect(page).toHaveURL("/submit");
  });

  test("unknown route shows 404 page", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
    await expect(
      page.getByText("The page you're looking for doesn't exist.")
    ).toBeVisible();
  });

  test("404 page has link back to home", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await page.getByRole("link", { name: "Return to home" }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Route content", () => {
  test("homepage has correct heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Discover Tools"
    );
  });

  test("submit page has correct heading", async ({ page }) => {
    await page.goto("/submit");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Submit a Tool"
    );
  });
});

