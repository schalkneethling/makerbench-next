import type { BaseIssue } from "valibot";

/** Maps a Valibot issue path to the API field name used in error details. */
export function getIssueField(issue: BaseIssue<unknown>): string {
  const path = issue.path
    ?.map((pathItem) => pathItem.key)
    .filter(
      (key): key is string | number =>
        typeof key === "string" || typeof key === "number",
    );

  return path && path.length > 0 ? path.join(".") : "form";
}

/** Aggregates Valibot issues into the shared field-to-messages API shape. */
export function getValidationDetails(
  issues: readonly BaseIssue<unknown>[],
): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = getIssueField(issue);
    details[field] ??= [];
    details[field].push(issue.message);
    return details;
  }, {});
}
