import { useState, type FormEvent } from "react";
import * as v from "valibot";

import { TagInput } from "../components/forms";
import { Alert, Button, TextInput } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { usePublicSubmission } from "../hooks/usePublicSubmission";
import {
  publicSubmissionRequestSchema,
  type PublicSubmissionType,
} from "../lib/validation";

import "./SubmitPage.css";

interface FormErrors {
  type?: string;
  url?: string;
  tags?: string;
  submitterName?: string;
  submitterGithubUsername?: string;
}

const submissionTypeOptions: Array<{
  value: PublicSubmissionType;
  label: string;
  hint: string;
}> = [
  {
    value: "tool",
    label: "Tool",
    hint: "A developer or maker tool.",
  },
  {
    value: "resource",
    label: "Resource",
    hint: "An article, guide, reference, or other useful link.",
  },
];

/** Builds form validation around the attribution missing from verified identity. */
function getSubmissionFormSchema(requireName: boolean, requireGithubUsername: boolean) {
  return v.pipe(
    publicSubmissionRequestSchema,
    v.forward(
      v.check(
        (input) => !requireName || Boolean(input.submitterName?.trim()),
        "Your name is required",
      ),
      ["submitterName"],
    ),
    v.forward(
      v.check(
        (input) =>
          !requireGithubUsername || Boolean(input.submitterGithubUsername?.trim()),
        "GitHub username is required",
      ),
      ["submitterGithubUsername"],
    ),
  );
}

/** Maps the first Valibot issue for each form field to display copy. */
function getFormErrors(issues: readonly v.BaseIssue<unknown>[]): FormErrors {
  const errors: FormErrors = {};

  for (const issue of issues) {
    const pathItem = issue.path?.[0] as { key?: unknown } | undefined;
    const field = pathItem?.key as keyof FormErrors | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }

  return errors;
}

/** Public tool and resource submission form. */
export function SubmitPage() {
  const { identity, accessToken, isAuthenticated } = useAuth();
  const { submit, isSubmitting, error, response, reset } = usePublicSubmission({
    accessToken: accessToken ?? undefined,
  });
  const hasVerifiedName = Boolean(identity?.user.displayName?.trim());
  const hasVerifiedGithubUsername = Boolean(identity?.user.githubUsername?.trim());
  const requireName = !hasVerifiedName;
  const requireGithubUsername = !hasVerifiedGithubUsername;

  const [submissionType, setSubmissionType] = useState<PublicSubmissionType | "">("");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitterName, setSubmitterName] = useState("");
  const [submitterGithubUsername, setSubmitterGithubUsername] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  /** Handles form submission after client-side contract validation. */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const result = v.safeParse(
      getSubmissionFormSchema(requireName, requireGithubUsername),
      {
        type: submissionType,
        url: url.trim(),
        tags,
        submitterName: requireName ? submitterName.trim() : undefined,
        submitterGithubUsername: requireGithubUsername
          ? submitterGithubUsername.trim()
          : undefined,
      },
    );

    if (!result.success) {
      const errors = getFormErrors(result.issues);
      if (!submissionType) {
        errors.type = "Please select a content type";
      }
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    const submission = await submit(result.output);

    if (submission) {
      setSubmissionType("");
      setUrl("");
      setTags([]);
      setSubmitterName("");
      setSubmitterGithubUsername("");
    }
  }

  /** Clears submission feedback and client validation. */
  function handleReset() {
    reset();
    setFormErrors({});
  }

  return (
    <div className="SubmitPage">
      <header className="SubmitPage-header">
        <h1 className="SubmitPage-title heading-2xl">Submit a Resource</h1>
        <p className="SubmitPage-description body-base">
          Share a useful tool or resource with the community for review.
        </p>
      </header>

      {response ? (
        <Alert variant="success" dismissible onDismiss={handleReset}>
          <strong>Submission received.</strong> It will appear on the site after review.
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="error" dismissible onDismiss={handleReset}>
          <strong>Submission failed.</strong> {error.message}
          {error.details ? (
            <ul className="SubmitPage-errorDetails body-sm">
              {Object.entries(error.details).map(([field, messages]) => (
                <li key={field}>
                  {field}: {Array.isArray(messages) ? messages.join(", ") : messages}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <form className="SubmitPage-form" onSubmit={handleSubmit} noValidate>
        <fieldset
          className="SubmitPage-fieldset SubmitPage-typeFieldset"
          disabled={isSubmitting}
          aria-describedby={formErrors.type ? "submission-type-error" : undefined}
        >
          <legend className="SubmitPage-legend ui-label">What are you submitting?</legend>
          <div className="SubmitPage-typeOptions">
            {submissionTypeOptions.map((option) => {
              const labelId = `submission-type-${option.value}-label`;
              const hintId = `submission-type-${option.value}-hint`;

              return (
                <label className="SubmitPage-typeOption" key={option.value}>
                  <input
                    className="SubmitPage-typeInput"
                    type="radio"
                    name="submission-type"
                    value={option.value}
                    checked={submissionType === option.value}
                    onChange={() => setSubmissionType(option.value)}
                    aria-labelledby={labelId}
                    aria-describedby={hintId}
                    aria-invalid={formErrors.type ? true : undefined}
                    required
                  />
                  <span>
                    <span id={labelId} className="SubmitPage-typeLabel">
                      {option.label}
                    </span>
                    <span id={hintId} className="SubmitPage-typeHint body-sm">
                      {option.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {formErrors.type ? (
            <p id="submission-type-error" className="SubmitPage-fieldError" role="alert">
              {formErrors.type}
            </p>
          ) : null}
        </fieldset>

        <fieldset className="SubmitPage-fieldset" disabled={isSubmitting}>
          <legend className="visually-hidden">Submission details</legend>

          <TextInput
            id="submission-url"
            label="URL"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={
              submissionType === "tool"
                ? "https://example.com/tool"
                : "https://example.com/resource"
            }
            required
            error={formErrors.url}
            hint="The main URL for the submission"
          />

          <TagInput
            id="submission-tags"
            label="Tags"
            tags={tags}
            onTagsChange={setTags}
            maxTags={10}
            required
            error={formErrors.tags}
            hint="Add 1-10 tags. Use commas or press Enter between tags."
            placeholder="e.g. react, accessibility, css"
          />
        </fieldset>

        {(requireName || requireGithubUsername) ? (
          <fieldset className="SubmitPage-fieldset" disabled={isSubmitting}>
            <legend className="SubmitPage-legend ui-label">Your details</legend>

            {requireName ? (
              <TextInput
                id="submitter-name"
                label="Your name"
                type="text"
                value={submitterName}
                onChange={(event) => setSubmitterName(event.target.value)}
                placeholder="Jane Developer"
                required
                error={formErrors.submitterName}
                hint={
                  isAuthenticated
                    ? "Required because your account does not include a name"
                    : "Used to credit your submission"
                }
              />
            ) : null}

            {requireGithubUsername ? (
              <TextInput
                id="submitter-github-username"
                label="GitHub username"
                type="text"
                value={submitterGithubUsername}
                onChange={(event) => setSubmitterGithubUsername(event.target.value)}
                placeholder="username"
                required
                error={formErrors.submitterGithubUsername}
                hint="Used to link your attribution to your GitHub profile"
              />
            ) : null}
          </fieldset>
        ) : null}

        <div className="SubmitPage-actions">
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Resource"}
          </Button>
        </div>
      </form>
    </div>
  );
}
