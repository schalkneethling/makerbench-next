import { useState, type FormEvent } from "react";

import { Alert } from "../components/ui";
import { TextInput } from "../components/ui";
import { Button } from "../components/ui";
import { TagInput } from "../components/forms";
import { useSubmitBookmark } from "../hooks";
import { bookmarkRequestSchema, type BookmarkRequest } from "../lib/validation";

import "./SubmitPage.css";

interface FormErrors {
  url?: string;
  tags?: string;
  submitterName?: string;
  submitterGithubUsername?: string;
}

/**
 * Submit page - form for submitting new tools.
 */
export function SubmitPage() {
  const { submit, isSubmitting, error, response, reset } = useSubmitBookmark();

  // Form state
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterGithubUsername, setSubmitterGithubUsername] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /**
   * Validates form and returns errors object.
   */
  function validateForm(): FormErrors {
    const data = {
      url: url.trim(),
      tags,
      submitterName: submitterName.trim() || undefined,
      submitterGithubUsername: submitterGithubUsername.trim() || undefined,
    };

    const result = bookmarkRequestSchema.safeParse(data);

    if (result.success) {
      return {};
    }

    const errors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormErrors;
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return errors;
  }

  /**
   * Handles form submission.
   */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const data: BookmarkRequest = {
      url: url.trim(),
      tags,
      submitterName: submitterName.trim() || undefined,
      submitterGithubUsername: submitterGithubUsername.trim() || undefined,
    };

    const result = await submit(data);

    if (result) {
      // Reset form on success
      setUrl("");
      setTags([]);
      setSubmitterName("");
      setSubmitterGithubUsername("");
      setFormErrors({});
    }
  }

  /**
   * Resets form and clears submission state.
   */
  function handleReset() {
    reset();
    setFormErrors({});
  }

  return (
    <div className="SubmitPage">
      <header className="SubmitPage-header">
        <h1 className="SubmitPage-title">Submit a Tool</h1>
        <p className="SubmitPage-description">
          Share a useful tool or resource with the community.
        </p>
      </header>

      {response && (
        <Alert variant="success" dismissible onDismiss={handleReset}>
          <strong>Tool submitted successfully!</strong> It will appear on the
          site after review.
        </Alert>
      )}

      {error && (
        <Alert variant="error" dismissible onDismiss={handleReset}>
          <strong>Submission failed.</strong> {error.message}
          {error.details && (
            <ul className="SubmitPage-errorDetails">
              {Object.entries(error.details).map(([field, messages]) => (
                <li key={field}>
                  {field}: {Array.isArray(messages) ? messages.join(", ") : messages}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <form className="SubmitPage-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="SubmitPage-fieldset" disabled={isSubmitting}>
          <legend className="visually-hidden">Tool Details</legend>

          <TextInput
            label="Tool URL"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/tool"
            required
            error={formErrors.url}
            hint="The main URL of the tool or resource"
          />

          <TagInput
            label="Tags"
            tags={tags}
            onTagsChange={setTags}
            maxTags={10}
            required
            error={formErrors.tags}
            hint="Add 1-10 tags to categorize this tool"
            placeholder="Type tag and press Enter"
          />
        </fieldset>

        <fieldset className="SubmitPage-fieldset" disabled={isSubmitting}>
          <legend className="SubmitPage-legend">Your Details (Optional)</legend>

          <TextInput
            label="Your Name"
            type="text"
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            placeholder="Jane Developer"
            error={formErrors.submitterName}
            hint="Get credited for your submission"
          />

          <TextInput
            label="GitHub Username"
            type="text"
            value={submitterGithubUsername}
            onChange={(e) => setSubmitterGithubUsername(e.target.value)}
            placeholder="username"
            error={formErrors.submitterGithubUsername}
            hint="Your GitHub username for profile link"
          />
        </fieldset>

        <div className="SubmitPage-actions">
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Tool"}
          </Button>
        </div>
      </form>
    </div>
  );
}
