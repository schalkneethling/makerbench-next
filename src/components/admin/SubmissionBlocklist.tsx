import type { FormEvent } from "react";

import { useAdminBlocklist } from "../../hooks/useAdminBlocklist";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

interface SubmissionBlocklistProps {
  accessToken: string | null;
}

/** Admin controls for listing, adding, and removing private submission rules. */
export function SubmissionBlocklist({ accessToken }: SubmissionBlocklistProps) {
  const {
    addEntry,
    entries,
    error,
    isLoading,
    matchType,
    pendingEntryId,
    recentEvents,
    removeEntry,
    setError,
    setMatchType,
    setSuccessMessage,
    setValue,
    successMessage,
    value,
  } = useAdminBlocklist({ accessToken, isAdmin: true });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void addEntry();
  }

  return (
    <section
      className="AdminModerationPage-blocklist"
      aria-labelledby="submission-blocklist-heading"
    >
      <header className="AdminModerationPage-blocklistHeader">
        <div>
          <h2 id="submission-blocklist-heading" className="heading-lg">
            Submission blocklist
          </h2>
          <p className="AdminModerationPage-description body-base">
            Block exact URLs or a domain and all of its subdomains before they
            enter the moderation queue.
          </p>
        </div>
      </header>

      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)}>
          <strong>Blocklist error.</strong> {error}
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

      <form
        className="AdminModerationPage-blocklistForm"
        onSubmit={handleSubmit}
      >
        <label className="AdminModerationPage-blocklistField">
          <span className="ui-caption">Match type</span>
          <select
            className="AdminModerationPage-blocklistControl"
            value={matchType}
            onChange={(event) =>
              setMatchType(event.target.value as "url" | "domain")
            }
          >
            <option value="domain">Domain</option>
            <option value="url">Exact URL</option>
          </select>
        </label>
        <label className="AdminModerationPage-blocklistField">
          <span className="ui-caption">
            {matchType === "domain" ? "Domain" : "URL"}
          </span>
          <input
            className="AdminModerationPage-blocklistControl"
            type={matchType === "url" ? "url" : "text"}
            value={value}
            placeholder={
              matchType === "domain"
                ? "example.com"
                : "https://example.com/path"
            }
            required
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={pendingEntryId !== null || !value.trim()}
          isLoading={pendingEntryId === "new"}
        >
          Add rule
        </Button>
      </form>

      {isLoading ? (
        <p className="body-base">Loading blocklist rules…</p>
      ) : entries.length === 0 ? (
        <p className="body-base">No submission blocklist rules.</p>
      ) : (
        <ul className="AdminModerationPage-blocklistList">
          {entries.map((entry) => (
            <li className="AdminModerationPage-blocklistItem" key={entry.id}>
              <div>
                <strong>
                  {entry.matchType === "domain" ? "Domain" : "Exact URL"}
                </strong>
                <span className="AdminModerationPage-blocklistValue">
                  {entry.normalizedValue}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pendingEntryId !== null}
                isLoading={pendingEntryId === entry.id}
                onClick={() => void removeEntry(entry)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="AdminModerationPage-blocklistAudit">
        <h3 className="heading-lg">Recent blocked attempts</h3>
        {recentEvents.length === 0 ? (
          <p className="body-base">No blocked attempts recorded.</p>
        ) : (
          <ul className="AdminModerationPage-blocklistList">
            {recentEvents.map((event) => (
              <li className="AdminModerationPage-blocklistItem" key={event.id}>
                <div>
                  <strong>{event.normalizedUrl}</strong>
                  <span className="AdminModerationPage-blocklistValue">
                    Matched {event.matchedType}: {event.matchedValue}
                  </span>
                </div>
                <time className="ui-caption" dateTime={String(event.createdAt)}>
                  {new Date(event.createdAt).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
