/**
 * Site footer with copyright and navigation links.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="Footer">
      <div className="Footer-inner">
        <p className="Footer-copyright">
          © {currentYear} MakerBench. All rights reserved.
        </p>
        <nav className="Footer-nav" aria-label="Footer">
          <ul className="Footer-links reset-list">
            <li>
              <a href="/about">About</a>
            </li>
            <li>
              <a href="/privacy">Privacy</a>
            </li>
            <li>
              <a
                href="https://github.com/schalkneethling/makerbench-next"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
