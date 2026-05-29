import { LinkButton } from "../ui/LinkButton";
import { Logo } from "../ui/Logo";
import { useAuth } from "../../hooks/useAuth";

/** Site header with logo and primary navigation. */
export function Header() {
  const {
    identity,
    isAdmin,
    isAuthenticated,
    isLoading,
    signInWithGitHub,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const displayName = identity?.user.displayName ?? identity?.user.email ?? "Maker";

  return (
    <header className="Header">
      <div className="Header-inner">
        <Logo href="/" />
        <nav className="Header-nav" aria-label="Primary">
          <LinkButton to="/tools" variant="secondary">Tools</LinkButton>
          <LinkButton to="/resources" variant="secondary">Resources</LinkButton>
          {isAuthenticated && (
            <LinkButton to="/library" variant="secondary">Library</LinkButton>
          )}
          <LinkButton to="/submit">Submit Tool</LinkButton>
        </nav>
        <div className="Header-auth">
          {isAuthenticated ? (
            <details className="Header-profile">
              <summary className="Header-profileTrigger">
                <span className="Header-profileName">{displayName}</span>
                {isAdmin && <span className="Header-adminBadge">Admin</span>}
              </summary>
              <div className="Header-profileMenu">
                {identity?.user.email && (
                  <p className="Header-profileEmail ui-caption">
                    {identity.user.email}
                  </p>
                )}
                <button
                  type="button"
                  className="Header-profileAction"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </div>
            </details>
          ) : (
            <details className="Header-profile">
              <summary className="Header-profileTrigger">
                {isLoading ? "Checking..." : "Sign in"}
              </summary>
              <div className="Header-profileMenu">
                <button
                  type="button"
                  className="Header-profileAction"
                  onClick={() => void signInWithGoogle()}
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  className="Header-profileAction"
                  onClick={() => void signInWithGitHub()}
                >
                  Continue with GitHub
                </button>
              </div>
            </details>
          )}
        </div>
      </div>
    </header>
  );
}
