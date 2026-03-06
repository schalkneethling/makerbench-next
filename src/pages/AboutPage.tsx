import "./AboutPage.css";

/**
 * About page explaining MakerBench's purpose and how to contribute.
 */
export function AboutPage() {
  return (
    <article className="AboutPage">
      <h1 className="heading-4xl">About MakerBench</h1>

      <section>
        <h2 className="heading-2xl">What MakerBench Is</h2>
        <p>
          MakerBench is a curated directory of tools for makers, developers,
          and teams building products on the web. The goal is simple: make it
          easier to discover useful tools without turning the site into a noisy
          list of everything on the internet.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">How It Works</h2>
        <p>
          Tools can be submitted by the community and are reviewed before they
          appear in the directory. Each approved listing includes the tool
          metadata we can reliably collect, relevant tags, and a screenshot or
          image so visitors can quickly evaluate whether it is worth exploring.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Contributing Tools</h2>
        <p>
          If you know a tool that belongs here, use the{" "}
          <a href="/submit">submission form</a>. A good submission starts with
          the tool URL and a small set of accurate tags. You can also include
          your name and GitHub username if you want credit shown on the card.
        </p>
        <p>
          Submissions are reviewed before publication so the directory stays
          useful, consistent, and focused.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Contributing Code</h2>
        <p>
          MakerBench is open source. If you want to fix a bug, improve the UI,
          or tighten the docs, open an issue or pull request on{" "}
          <a
            href="https://github.com/schalkneethling/makerbench-next"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          . Small, focused contributions are preferred.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Project Scope</h2>
        <p>
          MakerBench is intentionally opinionated. The aim is not exhaustive
          coverage. The aim is a clean, searchable catalogue that helps people
          find high-signal tools quickly.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Contact</h2>
        <p>
          Questions, corrections, or feedback can be shared in{" "}
          <a
            href="https://github.com/schalkneethling/makerbench-next"
            target="_blank"
            rel="noopener noreferrer"
          >
            the project repository
          </a>
          .
        </p>
      </section>
    </article>
  );
}
