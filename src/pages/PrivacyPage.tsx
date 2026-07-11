import "./PrivacyPage.css";

/**
 * Privacy policy page.
 */
export function PrivacyPage() {
  const lastUpdated = "July 11, 2026";

  return (
    <article className="PrivacyPage">
      <h1 className="heading-4xl">Privacy Policy</h1>
      <p className="PrivacyPage-meta body-sm">Last updated: {lastUpdated}</p>

      <section>
        <h2 className="heading-2xl">Overview</h2>
        <p>
          MakerBench is a curated directory of tools and resources. This policy explains what
          information we collect, how we use it, and which third-party services help us run the
          site.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Information You Provide</h2>
        <p>When you submit a resource, we collect the information entered into the submission form:</p>
        <ul>
          <li>
            <span className="PrivacyPage-emphasis">Submission type and URL:</span> required so we
            can route and review the submitted tool or resource.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Tags:</span> required so we can classify the
            submission.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Your name:</span> required for signed-out
            submissions and used for attribution if the submission is approved. Signed-in accounts
            may provide this through their verified identity.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Your GitHub username:</span> required when it
            cannot be resolved from a signed-in identity and used to link attribution on an approved
            listing.
          </li>
        </ul>
        <p>
          You may sign in with Google or GitHub through Supabase Auth. MakerBench does not ask you
          to create a separate password or provide payment details.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Information We Derive During Review</h2>
        <p>
          When a tool or resource is submitted, MakerBench may fetch public metadata from its URL,
          such as the page title, description, and preview image. If needed, we may also generate a
          screenshot of the submitted site for the directory card.
        </p>
        <p>
          This review data is used to build and display the listing. It is not used to create
          advertising profiles.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Analytics</h2>
        <p>
          MakerBench uses Umami for privacy-focused analytics. This helps us understand overall site
          usage, such as page views, popular pages, referrers, and high-level device or browser
          information.
        </p>
        <p>
          Umami is used to measure product usage, not to serve advertising. We do not use analytics
          data to build personal marketing profiles.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">How We Use Information</h2>
        <ul>
          <li>Review and publish tool and resource submissions</li>
          <li>Display approved listings and submitter attribution</li>
          <li>Operate, secure, and improve the site</li>
          <li>Diagnose outages, bugs, and abuse</li>
          <li>Understand overall usage trends through analytics</li>
        </ul>
      </section>

      <section>
        <h2 className="heading-2xl">Third-Party Services</h2>
        <p>MakerBench relies on a small set of service providers to operate:</p>
        <ul>
          <li>
            <span className="PrivacyPage-emphasis">Netlify:</span> hosting, deployment, and
            serverless functions.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Supabase:</span> Postgres database storage for
            bookmarks, tags, submission metadata, and user preferences, plus authentication for
            Google and GitHub sign-in.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Browserless:</span> screenshot capture for
            submitted sites when needed.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Cloudinary:</span> storage and delivery for
            screenshots and other listing images.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Sentry:</span> optional error monitoring to
            diagnose failures and stability issues.
          </li>
          <li>
            <span className="PrivacyPage-emphasis">Umami:</span> privacy-focused website analytics.
          </li>
        </ul>
        <p>
          These providers may process technical data needed to deliver their services, such as IP
          address, request metadata, or diagnostic events.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Storage and Retention</h2>
        <p>
          Submission data and approved listing data are stored for as long as they are needed to
          operate MakerBench. Approved listings may remain in the directory until they are removed
          or updated. Operational logs and diagnostics are retained according to the policies of the
          underlying providers.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Security</h2>
        <p>
          Reasonable steps are taken to protect the systems and data used to operate MakerBench. No
          internet-connected service can promise perfect security, so you should avoid submitting
          information you would not want associated with a public directory listing.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Your Choices</h2>
        <p>
          If you want a submitted name or GitHub attribution corrected or removed, open an issue in
          the project repository.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Changes to This Policy</h2>
        <p>
          This policy may change as the site evolves. When it does, the updated version will be
          published on this page with a revised last-updated date.
        </p>
      </section>

      <section>
        <h2 className="heading-2xl">Contact Us</h2>
        <p>
          If you have questions about this policy or about data associated with a submission,
          contact us via{" "}
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
