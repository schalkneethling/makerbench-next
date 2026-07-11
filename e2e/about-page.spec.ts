import { test, expect } from "@playwright/test";

test.describe("AboutPage", () => {
  test("has correct accessible structure", async ({ page }) => {
    await page.goto("/about");

    await expect(page.locator("article.AboutPage")).toMatchAriaSnapshot(`
      - article:
        - heading "About MakerBench" [level=1]
        - heading "What MakerBench Is" [level=2]
        - paragraph: MakerBench is a curated directory of tools and resources for makers, developers, and teams building products on the web. The goal is simple: make useful links easier to discover without turning the site into a noisy list of everything on the internet.
        - heading "How It Works" [level=2]
        - paragraph: Tools and resources can be submitted by the community and are reviewed before they appear in the catalog. Each approved listing includes the metadata we can reliably collect, relevant tags, and an image when available so visitors can quickly evaluate whether it is worth exploring.
        - heading "Contributing Resources" [level=2]
        - paragraph:
          - text: If you know a tool, article, guide, reference, or other resource that belongs here, use the
          - link "submission form":
            - /url: /submit
          - text: . Choose whether it is a tool or resource, then add its URL and a small set of accurate tags.
        - paragraph: Submissions are reviewed before publication so the directory stays useful, consistent, and focused.
        - heading "Contributing Code" [level=2]
        - paragraph:
          - text: MakerBench is open source. If you want to fix a bug, improve the UI, or tighten the docs, open an issue or pull request on
          - link "GitHub":
            - /url: https://github.com/schalkneethling/makerbench-next
          - text: . Small, focused contributions are preferred.
        - heading "Project Scope" [level=2]
        - paragraph: MakerBench is intentionally opinionated. The aim is not exhaustive coverage. The aim is a clean, searchable catalogue that helps people find high-signal tools quickly.
        - heading "Contact" [level=2]
        - paragraph:
          - text: Questions, corrections, or feedback can be shared in
          - link "the project repository":
            - /url: https://github.com/schalkneethling/makerbench-next
          - text: .
    `);
  });

  test("footer About link navigates to about page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL("/about");
    await expect(page.locator("h1")).toHaveText("About MakerBench");
  });

  test("submit link in content navigates correctly", async ({ page }) => {
    await page.goto("/about");
    await page.getByRole("link", { name: "submission form" }).click();
    await expect(page).toHaveURL("/submit");
  });

  test("GitHub links open in new tab", async ({ page }) => {
    await page.goto("/about");

    const githubLinks = page.getByRole("link", { name: /GitHub|our project repository/ });
    const count = await githubLinks.count();

    for (let i = 0; i < count; i++) {
      const link = githubLinks.nth(i);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});
