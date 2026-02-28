import { Link } from "react-router-dom";

import "./NotFoundPage.css";

/**
 * 404 page - shown when route doesn't match.
 */
export function NotFoundPage() {
  return (
    <div className="NotFoundPage">
      <h1 className="NotFoundPage-heading">404</h1>
      <p className="NotFoundPage-message">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/">Return to home</Link>
    </div>
  );
}

