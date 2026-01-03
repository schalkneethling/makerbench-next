import "./PrivacyPage.css";

/**
 * Privacy policy page.
 */
export function PrivacyPage() {
  const lastUpdated = "January 3, 2026";

  return (
    <div className="PrivacyPage">
      <h1 className="PrivacyPage-heading">Privacy Policy</h1>
      <p className="PrivacyPage-lastUpdated">Last updated: {lastUpdated}</p>

      <section className="PrivacyPage-section">
        <h2>Introduction</h2>
        <p>
          MakerBench ("we", "us", "our" or "Company") operates the MakerBench
          website (the "Service"). This page informs you of our policies
          regarding the collection, use, and disclosure of personal data when
          you use our Service and the choices you have associated with that
          data.
        </p>
      </section>

      <section className="PrivacyPage-section">
        <h2>Information Collection and Use</h2>
        <p>
          We collect several different types of information for various
          purposes to provide and improve our Service to you.
        </p>

        <h3>Types of Data Collected</h3>
        <ul>
          <li>
            <strong>Personal Data:</strong> When you submit a tool to MakerBench,
            we collect information you provide, including the tool URL, name,
            description, tags, and your contact information.
          </li>
          <li>
            <strong>Usage Data:</strong> We may automatically collect information
            about how you access and use the Service (e.g., the pages or tools
            you view, search queries, and the time and date of your activities).
          </li>
          <li>
            <strong>Device Data:</strong> We collect information about the device
            you use to access the Service, including browser type, operating
            system, and IP address.
          </li>
        </ul>
      </section>

      <section className="PrivacyPage-section">
        <h2>Use of Data</h2>
        <p>MakerBench uses the collected data for various purposes:</p>
        <ul>
          <li>To provide, maintain, and improve the Service</li>
          <li>
            To process tool submissions and manage the MakerBench catalog
          </li>
          <li>
            To send you administrative information and updates regarding the
            Service
          </li>
          <li>
            To respond to your inquiries and provide customer support
          </li>
          <li>To monitor and analyze trends, usage, and activities</li>
          <li>To detect, prevent, and address technical issues and fraud</li>
        </ul>
      </section>

      <section className="PrivacyPage-section">
        <h2>Data Storage and Security</h2>
        <p>
          The security of your data is important to us, but remember that no
          method of transmission over the Internet or method of electronic
          storage is 100% secure. While we strive to use commercially
          acceptable means to protect your Personal Data, we cannot guarantee
          its absolute security.
        </p>
        <p>
          Your data is stored on secure servers provided by Turso (database)
          and Amazon Web Services (screenshots and images). These services
          implement industry-standard security measures.
        </p>
      </section>

      <section className="PrivacyPage-section">
        <h2>Third-Party Services</h2>
        <p>
          We use third-party services to operate MakerBench. These services may
          collect information used to identify you:
        </p>
        <ul>
          <li>
            <strong>Turso:</strong> Database service for storing tool information
          </li>
          <li>
            <strong>Amazon Web Services (AWS):</strong> Storage for screenshots and
            images
          </li>
          <li>
            <strong>Cloudinary:</strong> Image processing and delivery service
          </li>
          <li>
            <strong>Browserless:</strong> Screenshot capture service
          </li>
          <li>
            <strong>Netlify:</strong> Hosting and deployment platform
          </li>
        </ul>
        <p>
          We encourage you to review the privacy policies of these services
          before providing any personal information to them.
        </p>
      </section>

      <section className="PrivacyPage-section">
        <h2>GDPR Compliance</h2>
        <p>
          If you are located in the European Union, you have rights under the
          General Data Protection Regulation (GDPR). These include the right to
          access, correct, delete, or port your personal data. To exercise these
          rights, please contact us using the information provided below.
        </p>
      </section>

      <section className="PrivacyPage-section">
        <h2>Changes to This Privacy Policy</h2>
        <p>
          We may update our Privacy Policy from time to time. We will notify you
          of any changes by posting the new Privacy Policy on this page and
          updating the "Last updated" date at the top of this policy. You are
          advised to review this Privacy Policy periodically for any changes.
        </p>
      </section>

      <section className="PrivacyPage-section">
        <h2>Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us
          on GitHub at{" "}
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
    </div>
  );
}

