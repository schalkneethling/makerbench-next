import { useNavigate } from "react-router-dom";

import { Button, Logo } from "../ui";

/**
 * Site header with logo and primary navigation.
 */
export function Header() {
  const navigate = useNavigate();

  return (
    <header className="Header">
      <div className="Header-inner">
        <Logo href="/" />
        <nav className="Header-nav" aria-label="Primary">
          <Button variant="primary" onClick={() => navigate("/submit")}>
            Submit Tool
          </Button>
        </nav>
      </div>
    </header>
  );
}
