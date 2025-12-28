import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

import "./MainLayout.css";

interface MainLayoutProps {
  children?: ReactNode;
}

/**
 * Main layout wrapper with skip link, header, main landmark, and footer.
 */
export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="MainLayout">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="MainLayout-main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}


