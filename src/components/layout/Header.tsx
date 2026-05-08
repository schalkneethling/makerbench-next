import { LinkButton, Logo } from "../ui";

/** Site header with logo and primary navigation. */
export function Header() {
  return (
    <header className="Header">
      <div className="Header-inner">
        <Logo href="/" />
        <nav className="Header-nav" aria-label="Primary">
          <LinkButton to="/tools" variant="secondary">Tools</LinkButton>
          <LinkButton to="/resources" variant="secondary">Resources</LinkButton>
          <LinkButton to="/submit">Submit Tool</LinkButton>
        </nav>
      </div>
    </header>
  );
}
