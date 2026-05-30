import { useReducer, type FormEvent } from "react";
import * as v from "valibot";

import { TagInput } from "../components/forms/TagInput";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { useAuth } from "../hooks/useAuth";
import { useLibraryResources } from "../hooks/useLibraryResources";
import { personalResourceRequestSchema, type PersonalResourceRequest } from "../lib/validation";

import "./LibraryPage.css";

interface FormErrors {
  url?: string;
  tags?: string;
  notes?: string;
}

interface LibraryPageState {
  url: string;
  tags: string[];
  notes: string;
  formErrors: FormErrors;
  didSave: boolean;
  signInError: string | null;
  isSignInPending: boolean;
}

type LibraryPageAction =
  | { type: "setUrl"; url: string }
  | { type: "setTags"; tags: string[] }
  | { type: "setNotes"; notes: string }
  | { type: "setFormErrors"; formErrors: FormErrors }
  | { type: "setDidSave"; didSave: boolean }
  | { type: "startSignIn" }
  | { type: "finishSignIn" }
  | { type: "failSignIn"; message: string }
  | { type: "dismissSignInError" }
  | { type: "resetFormAfterSave" };

const initialState: LibraryPageState = {
  url: "",
  tags: [],
  notes: "",
  formErrors: {},
  didSave: false,
  signInError: null,
  isSignInPending: false,
};

function libraryPageReducer(state: LibraryPageState, action: LibraryPageAction): LibraryPageState {
  switch (action.type) {
    case "setUrl":
      return { ...state, url: action.url };
    case "setTags":
      return { ...state, tags: action.tags };
    case "setNotes":
      return { ...state, notes: action.notes };
    case "setFormErrors":
      return { ...state, formErrors: action.formErrors };
    case "setDidSave":
      return { ...state, didSave: action.didSave };
    case "startSignIn":
      return { ...state, signInError: null, isSignInPending: true };
    case "finishSignIn":
      return { ...state, isSignInPending: false };
    case "failSignIn":
      return { ...state, signInError: action.message, isSignInPending: false };
    case "dismissSignInError":
      return { ...state, signInError: null };
    case "resetFormAfterSave":
      return {
        ...state,
        url: "",
        tags: [],
        notes: "",
        formErrors: {},
        didSave: true,
      };
  }
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
  const { resources, isLoading, isSaving, error, addResource } = useLibraryResources(accessToken);
  const [state, dispatch] = useReducer(libraryPageReducer, initialState);
  const { url, tags, notes, formErrors, didSave, signInError, isSignInPending } = state;

  async function handleSignIn(action: () => Promise<void>) {
    dispatch({ type: "startSignIn" });

    try {
      await action();
      dispatch({ type: "finishSignIn" });
    } catch (error) {
      dispatch({
        type: "failSignIn",
        message: error instanceof Error ? error.message : "Sign in failed. Please try again.",
      });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: "setDidSave", didSave: false });

    const data: PersonalResourceRequest = {
      url: url.trim(),
      tags,
      notes: notes.trim() || undefined,
    };
    const errors = getFormErrors(data);
    dispatch({ type: "setFormErrors", formErrors: errors });

    if (Object.keys(errors).length > 0) {
      return;
    }

    const saved = await addResource(data);
    if (saved) {
      dispatch({ type: "resetFormAfterSave" });
    }
  }

  if (authLoading) {
    return (
      <div className="LibraryPage">
        <p className="body-base">Checking your session…</p>
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
        {signInError && (
          <Alert
            variant="error"
            dismissible
            onDismiss={() => dispatch({ type: "dismissSignInError" })}
          >
            <strong>Sign in failed.</strong> {signInError}
          </Alert>
        )}
        <div className="LibraryPage-authActions">
          <Button
            type="button"
            disabled={isSignInPending}
            onClick={() => void handleSignIn(signInWithGoogle)}
          >
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSignInPending}
            onClick={() => void handleSignIn(signInWithGitHub)}
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
        <Alert
          variant="success"
          dismissible
          onDismiss={() => dispatch({ type: "setDidSave", didSave: false })}
        >
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
            onChange={(event) => dispatch({ type: "setUrl", url: event.target.value })}
            placeholder="https://example.com/resource"
            required
            error={formErrors.url}
          />
          <TagInput
            id="library-tags"
            label="Tags"
            tags={tags}
            onTagsChange={(nextTags) => dispatch({ type: "setTags", tags: nextTags })}
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
              onChange={(event) => dispatch({ type: "setNotes", notes: event.target.value })}
              rows={5}
              aria-invalid={formErrors.notes ? true : undefined}
              aria-describedby={formErrors.notes ? "library-notes-error" : undefined}
            />
            {formErrors.notes && (
              <span id="library-notes-error" className="LibraryPage-notesError" role="alert">
                {formErrors.notes}
              </span>
            )}
          </label>
        </fieldset>
        <Button type="submit" isLoading={isSaving}>
          {isSaving ? "Saving…" : "Save Resource"}
        </Button>
      </form>

      <section className="LibraryPage-list" aria-labelledby="library-list-title">
        <h2 id="library-list-title" className="LibraryPage-listTitle heading-lg">
          Saved Resources
        </h2>
        {isLoading ? (
          <p className="body-base">Loading your library…</p>
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
                    <p className="LibraryPage-cardDescription body-sm">{resource.description}</p>
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
