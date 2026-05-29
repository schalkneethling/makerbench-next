import { useState, type FormEvent } from "react";
import * as v from "valibot";

import { TagInput } from "../components/forms";
import { Alert, Button, TextInput } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useLibraryResources } from "../hooks/useLibraryResources";
import {
  personalResourceRequestSchema,
  type PersonalResourceRequest,
} from "../lib/validation";

import "./LibraryPage.css";

interface FormErrors {
  url?: string;
  tags?: string;
  notes?: string;
}

function getFormErrors(data: PersonalResourceRequest): FormErrors {
  const result = v.safeParse(personalResourceRequestSchema, data);

  if (result.success) {
    return {};
  }

  const errors: FormErrors = {};
  for (const issue of result.issues) {
    const pathItem = issue.path?.[0] as { key?: unknown } | undefined;
    const field = pathItem?.key as keyof FormErrors | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

export function LibraryPage() {
  const {
    accessToken,
    isAuthenticated,
    isLoading: authLoading,
    signInWithGitHub,
    signInWithGoogle,
  } = useAuth();
  const { resources, isLoading, isSaving, error, addResource } =
    useLibraryResources(accessToken);
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [didSave, setDidSave] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setDidSave(false);

    const data: PersonalResourceRequest = {
      url: url.trim(),
      tags,
      notes: notes.trim() || undefined,
    };
    const errors = getFormErrors(data);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const saved = await addResource(data);
    if (saved) {
      setUrl("");
      setTags([]);
      setNotes("");
      setFormErrors({});
      setDidSave(true);
    }
  }

  if (authLoading) {
    return (
      <div className="LibraryPage">
        <p className="body-base">Checking your session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="LibraryPage">
        <header className="LibraryPage-header">
          <h1 className="LibraryPage-title heading-2xl">Your Library</h1>
          <p className="LibraryPage-description body-base">
            Sign in to save private resources, tags, and notes.
          </p>
        </header>
        <div className="LibraryPage-authActions">
          <Button type="button" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void signInWithGitHub()}
          >
            Continue with GitHub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="LibraryPage">
      <header className="LibraryPage-header">
        <h1 className="LibraryPage-title heading-2xl">Your Library</h1>
        <p className="LibraryPage-description body-base">
          Save private resources with tags and notes.
        </p>
      </header>

      {didSave && (
        <Alert variant="success" dismissible onDismiss={() => setDidSave(false)}>
          Resource saved to your library.
        </Alert>
      )}

      {error && (
        <Alert variant="error">
          <strong>Library error.</strong> {error.message}
        </Alert>
      )}

      <form className="LibraryPage-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="LibraryPage-fieldset" disabled={isSaving}>
          <legend className="visually-hidden">Save a resource</legend>
          <TextInput
            id="library-url"
            label="Resource URL"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/resource"
            required
            error={formErrors.url}
          />
          <TagInput
            id="library-tags"
            label="Tags"
            tags={tags}
            onTagsChange={setTags}
            maxTags={10}
            required
            error={formErrors.tags}
          />
          <label className="LibraryPage-notes" htmlFor="library-notes">
            <span className="LibraryPage-notesLabel">Notes</span>
            <textarea
              id="library-notes"
              className="LibraryPage-notesField"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              aria-invalid={formErrors.notes ? true : undefined}
              aria-describedby={formErrors.notes ? "library-notes-error" : undefined}
            />
            {formErrors.notes && (
              <span
                id="library-notes-error"
                className="LibraryPage-notesError"
                role="alert"
              >
                {formErrors.notes}
              </span>
            )}
          </label>
        </fieldset>
        <Button type="submit" isLoading={isSaving}>
          {isSaving ? "Saving..." : "Save Resource"}
        </Button>
      </form>

      <section className="LibraryPage-list" aria-labelledby="library-list-title">
        <h2 id="library-list-title" className="LibraryPage-listTitle heading-lg">
          Saved Resources
        </h2>
        {isLoading ? (
          <p className="body-base">Loading your library...</p>
        ) : resources.length === 0 ? (
          <p className="body-base">Your library is empty.</p>
        ) : (
          <ul className="LibraryPage-grid reset-list">
            {resources.map((resource) => (
              <li key={resource.id}>
                <article className="LibraryPage-card">
                  <h3 className="LibraryPage-cardTitle heading-base">
                    <a href={resource.url}>{resource.title}</a>
                  </h3>
                  {resource.description && (
                    <p className="LibraryPage-cardDescription body-sm">
                      {resource.description}
                    </p>
                  )}
                  {resource.notes && (
                    <p className="LibraryPage-cardNotes body-sm">{resource.notes}</p>
                  )}
                  {resource.tags.length > 0 && (
                    <ul className="LibraryPage-tags reset-list" aria-label="Tags">
                      {resource.tags.map((tag) => (
                        <li key={tag.id} className="LibraryPage-tag">
                          {tag.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
