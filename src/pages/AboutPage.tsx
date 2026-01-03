import "./AboutPage.css";

/**
 * About page explaining MakerBench's purpose and mission.
 */
export function AboutPage() {
  return (
    <article className="AboutPage">
      <h1>About MakerBench</h1>

      <section>
        <h2>Our Mission</h2>
        <p>
          MakerBench is a curated directory of tools and resources for makers,
          developers, and creators. We help you discover the right tools to
          bring your ideas to life, whether you're building a side project,
          launching a startup, or exploring new technologies.
        </p>
      </section>

      <section>
        <h2>What We Do</h2>
        <p>
          We collect and organize tools across categories like development,
          design, productivity, marketing, and more. Each tool in our directory
          includes:
        </p>
        <ul>
          <li>A clear description of what the tool does</li>
          <li>Relevant tags to help you find related tools</li>
          <li>Screenshots to see the tool in action</li>
          <li>Direct links to try or learn more</li>
        </ul>
      </section>

      <section>
        <h2>Community-Driven</h2>
        <p>
          MakerBench is built by makers, for makers. Anyone can submit a tool
          to the directory. We review each submission to ensure quality and
          relevance before adding it to the catalog.
        </p>
        <p>
          Have a tool you love? Share it with the community by{" "}
          <a href="/submit">submitting it here</a>.
        </p>
      </section>

      <section>
        <h2>Open Source</h2>
        <p>
          MakerBench is open source and built in the open. We believe in
          transparency and welcome contributions from the community. You can
          view the source code, report issues, or contribute improvements on{" "}
          <a
            href="https://github.com/schalkneethling/makerbench-next"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions or feedback? Reach out on GitHub at{" "}
          <a
            href="https://github.com/schalkneethling/makerbench-next"
            target="_blank"
            rel="noopener noreferrer"
          >
            our project repository
          </a>
          .
        </p>
      </section>
    </article>
  );
}

