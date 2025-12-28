import { Button } from "../ui/Button";

/**
 * Site header with logo and primary navigation.
 */
export function Header() {
  return (
    <header className="Header">
      <div className="Header-inner">
        <a href="/" className="Logo">
          <span className="Logo-maker">Maker</span>
          <span className="Logo-bench">Bench</span>
        </a>
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
