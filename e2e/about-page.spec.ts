import { test, expect } from "@playwright/test";

test.describe("AboutPage", () => {
  test("has correct accessible structure", async ({ page }) => {
    await page.goto("/about");

    await expect(page.locator("article.AboutPage")).toMatchAriaSnapshot(`
      - article:
        - heading "About MakerBench" [level=1]
        - heading "Our Mission" [level=2]
        - paragraph: MakerBench is a curated directory of tools and resources for makers, developers, and creators. We help you discover the right tools to bring your ideas to life, whether you're building a side project, launching a startup, or exploring new technologies.
        - heading "What We Do" [level=2]
        - paragraph: "We collect and organize tools across categories like development, design, productivity, marketing, and more. Each tool in our directory includes:"
        - list:
          - listitem: A clear description of what the tool does
          - listitem: Relevant tags to help you find related tools
          - listitem: Screenshots to see the tool in action
          - listitem: Direct links to try or learn more
        - heading "Community-Driven" [level=2]
        - paragraph: MakerBench is built by makers, for makers. Anyone can submit a tool to the directory. We review each submission to ensure quality and relevance before adding it to the catalog.
        - paragraph:
          - text: Have a tool you love? Share it with the community by
          - link "submitting it here":
            - /url: /submit
          - text: .
        - heading "Open Source" [level=2]
        - paragraph:
          - text: MakerBench is open source and built in the open. We believe in transparency and welcome contributions from the community. You can view the source code, report issues, or contribute improvements on
          - link "GitHub":
            - /url: https://github.com/schalkneethling/makerbench-next
          - text: .
        - heading "Contact" [level=2]
        - paragraph:
          - text: Questions or feedback? Reach out on GitHub at
          - link "our project repository":
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
    await page.getByRole("link", { name: "submitting it here" }).click();
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

