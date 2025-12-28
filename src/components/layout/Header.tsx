import { Button, Logo } from "../ui";

/**
 * Site header with logo and primary navigation.
 */
export function Header() {
  return (
    <header className="Header">
      <div className="Header-inner">
        <Logo href="/" />
        <nav className="Header-nav" aria-label="Primary">
          <Button
            variant="primary"
            onClick={() => (window.location.href = "/submit")}
          >
            Submit Tool
          </Button>
        </nav>
      </div>
    </header>
  );
}
