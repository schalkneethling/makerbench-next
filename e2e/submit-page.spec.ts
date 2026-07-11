import { test, expect } from "@playwright/test";

test.describe("SubmitPage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/submit");
    await expect(page.getByRole("button", { name: "Submit Resource" })).toBeEnabled();
  });

  test("has an accessible resource submission form", async ({ page }) => {
    await expect(page.locator(".SubmitPage")).toMatchAriaSnapshot(`
      - heading "Submit a Resource" [level=1]
      - paragraph: Share a useful tool or resource with the community for review.
      - form "Submit a Resource":
        - group "What are you submitting?":
          - radio "Tool"
          - text: Tool A developer or maker tool.
          - radio "Resource"
          - text: Resource An article, guide, reference, or other useful link.
        - group "Submission details":
          - text: URL * The main URL for the submission
          - textbox "URL"
          - text: Tags * Add 1-10 tags. Use commas or press Enter between tags.
          - textbox "Tags"
          - text: 0/10 tags
        - group "Your details":
          - text: Your name * Used to credit your submission
          - textbox "Your name"
          - text: GitHub username * Used to link your attribution to your GitHub profile
          - textbox "GitHub username"
        - button "Submit Resource"
    `);
  });

  test("requires a tool or resource selection and signed-out attribution", async ({ page }) => {
    await expect(page.getByRole("radio", { name: "Tool" })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: "Resource" })).not.toBeChecked();
    await expect(page.getByRole("radio", { name: /article/i })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Your name" })).toHaveAttribute(
      "aria-required",
      "true",
    );
    await expect(page.getByRole("textbox", { name: "GitHub username" })).toHaveAttribute(
      "aria-required",
      "true",
    );

    await page.getByRole("button", { name: "Submit Resource" }).click();

    await expect(page.getByText("Please select a content type")).toBeVisible();
    await expect(page.getByText("Your name is required")).toBeVisible();
    await expect(page.getByText("GitHub username is required")).toBeVisible();
  });

  test("switches between the binary submission types", async ({ page }) => {
    const tool = page.getByRole("radio", { name: "Tool" });
    const resource = page.getByRole("radio", { name: "Resource" });
    const url = page.getByRole("textbox", { name: "URL" });

    await tool.check();
    await expect(tool).toBeChecked();
    await expect(resource).not.toBeChecked();
    await expect(url).toHaveAttribute("placeholder", "https://example.com/tool");

    await resource.check();
    await expect(resource).toBeChecked();
    await expect(tool).not.toBeChecked();
    await expect(url).toHaveAttribute("placeholder", "https://example.com/resource");
  });

  test("shows validation errors for invalid submission details", async ({ page }) => {
    await page.getByRole("radio", { name: "Resource" }).check();
    await page.getByRole("textbox", { name: "URL" }).fill("not-a-url");
    await page.getByRole("textbox", { name: "Tags" }).fill("test");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Submit Resource" }).click();

    await expect(page.getByText(/please enter a valid url/i)).toBeVisible();
  });

  test("can add and remove tags", async ({ page }) => {
    const tagInput = page.getByRole("textbox", { name: "Tags" });

    await tagInput.fill("javascript");
    await page.keyboard.press("Enter");
    await expect(page.locator(".TagInput-tagLabel", { hasText: "javascript" })).toBeVisible();

    await tagInput.fill("react,");
    await expect(page.locator(".TagInput-tagLabel", { hasText: "react" })).toBeVisible();
    await expect(page.getByText("2/10 tags")).toBeVisible();

    await page.getByRole("button", { name: /remove javascript/i }).click();
    await expect(page.getByText("1/10 tags")).toBeVisible();
  });
});
