import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import {
  moderationTypeLabels,
  moderationTypes,
  useAdminModerationQueue,
} from "../hooks/useAdminModerationQueue";
import { useAuth } from "../hooks/useAuth";

import "./AdminModerationPage.css";

function getSafeHref(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsedUrl.protocol)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function AdminModerationPage() {
  const {
    accessToken,
    isAdmin,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();
  const {
    activeType,
    error,
    isLoading,
    items,
    pendingActionId,
    rejectionReasons,
    reviewItem,
    setActiveType,
    setError,
    setRejectionReasons,
    setSuccessMessage,
    successMessage,
  } = useAdminModerationQueue({ accessToken, isAdmin });

  if (authLoading) {
    return (
      <div className="AdminModerationPage">
        <p className="body-base">Checking your session…</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="AdminModerationPage">
        <header className="AdminModerationPage-header">
          <h1 className="AdminModerationPage-title heading-2xl">Moderation</h1>
          <p className="AdminModerationPage-description body-base">
            Admin access is required to review pending submissions.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="AdminModerationPage">
      <header className="AdminModerationPage-header">
        <h1 className="AdminModerationPage-title heading-2xl">Moderation</h1>
        <p className="AdminModerationPage-description body-base">
          Review pending tools, resources, stacks, and stack items.
        </p>
      </header>

      <div
        className="AdminModerationPage-tabs"
        aria-labelledby="moderation-filter-heading"
      >
        <h2 id="moderation-filter-heading" className="visually-hidden">
          Moderation type filter
        </h2>
        {moderationTypes.map(({ type, label }) => (
          <button
            className="AdminModerationPage-tab"
            type="button"
            aria-pressed={activeType === type}
            key={type}
            onClick={() => setActiveType(type)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)}>
          <strong>Moderation error.</strong> {error}
        </Alert>
      )}

      {successMessage && (
        <Alert
          variant="success"
          dismissible
          onDismiss={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {isLoading ? (
        <p className="body-base">Loading pending submissions…</p>
      ) : items.length === 0 ? (
        <p className="body-base">No pending submissions for this view.</p>
      ) : (
        <section aria-labelledby="moderation-queue-heading">
          <h2 id="moderation-queue-heading" className="visually-hidden">
            Pending moderation items
          </h2>
          <ul className="AdminModerationPage-list">
            {items.map((item) => {
              const tagHeadingId = `moderation-tags-${item.id}`;
              const safeHref = getSafeHref(item.url);
              const safeSubmitterHref = item.submitterUrl
                ? getSafeHref(item.submitterUrl)
                : null;

              return (
                <li className="AdminModerationPage-item" key={item.id}>
                  <article className="AdminModerationPage-card">
                    <header className="AdminModerationPage-cardHeader">
                      <span className="AdminModerationPage-type">
                        {moderationTypeLabels[item.type]}
                      </span>
                      <time className="ui-caption" dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </time>
                    </header>
                    <div className="AdminModerationPage-cardBody">
                      <h3 className="AdminModerationPage-cardTitle heading-lg">
                        {item.title}
                      </h3>
                      {safeHref ? (
                        <a className="AdminModerationPage-url" href={safeHref}>
                          {item.url}
                        </a>
                      ) : (
                        <span className="AdminModerationPage-url">
                          {item.url}
                        </span>
                      )}
                      {item.description && (
                        <p className="AdminModerationPage-description body-base">
                          {item.description}
                        </p>
                      )}
                      {item.parent && (
                        <p className="AdminModerationPage-meta ui-caption">
                          Stack: {item.parent.title}
                        </p>
                      )}
                      {item.submitter && (
                        <p className="AdminModerationPage-meta ui-caption">
                          Submitted by{" "}
                          {safeSubmitterHref ? (
                            <a href={safeSubmitterHref}>{item.submitter}</a>
                          ) : (
                            item.submitter
                          )}
                        </p>
                      )}
                      {item.tags.length > 0 && (
                        <>
                          <h4 id={tagHeadingId} className="visually-hidden">
                            Tags
                          </h4>
                          <ul
                            className="AdminModerationPage-tags"
                            aria-labelledby={tagHeadingId}
                          >
                            {item.tags.map((tag) => (
                              <li
                                className="AdminModerationPage-tag"
                                key={tag.id}
                              >
                                {tag.name}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    <footer className="AdminModerationPage-actions">
                      <label className="AdminModerationPage-reason">
                        <span className="ui-caption">Rejection reason</span>
                        <textarea
                          className="AdminModerationPage-reasonField"
                          value={rejectionReasons[item.id] ?? ""}
                          onChange={(event) =>
                            setRejectionReasons((currentReasons) => ({
                              ...currentReasons,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <div className="AdminModerationPage-buttons">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pendingActionId !== null}
                          isLoading={pendingActionId === item.id}
                          onClick={() => void reviewItem(item, "reject")}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          disabled={pendingActionId !== null}
                          isLoading={pendingActionId === item.id}
                          onClick={() => void reviewItem(item, "approve")}
                        >
                          Approve
                        </Button>
                      </div>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
