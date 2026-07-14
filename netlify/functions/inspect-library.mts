import type { Config, Context } from "@netlify/functions";
import type { BaseIssue } from "valibot";

import {
  assertRequiredEnv,
  captureError,
  flushSentry,
  handleMissingEnvironmentError,
  initSentry,
  methodNotAllowed,
  ok,
  serviceUnavailable,
  unauthorized,
  validationError,
  verifyAuthenticatedUser,
} from "./lib";
import { resolvePublicHttpUrl } from "./lib/public-url";
import { extractMetadata } from "../../src/lib/services/metadata";
import { validateLibraryInspectionRequest } from "../../src/lib/validation";

const PUBLIC_URL_ERROR = "Please enter a publicly reachable HTTP/HTTPS URL";
const INSPECTION_ERROR =
  "We couldn't inspect this URL right now. You can still save it to your library.";

function getIssueField(issue: BaseIssue<unknown>): string {
  const path = issue.path
    ?.map((pathItem) => pathItem.key)
    .filter(
      (key): key is string | number =>
        typeof key === "string" || typeof key === "number",
    );

  return path && path.length > 0 ? path.join(".") : "form";
}

function getValidationDetails(
  issues: readonly BaseIssue<unknown>[],
): Record<string, string[]> {
  return issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = getIssueField(issue);
    details[field] ??= [];
    details[field].push(issue.message);
    return details;
  }, {});
}

/** Records inspection failures without including request or user data. */
async function recordInspectionFailure(): Promise<void> {
  captureError(new Error("Library metadata inspection failed"), {
    function: "inspect-library",
    dependency: "metadata-extractor",
  });
  await flushSentry();
}

export default async (req: Request, _context: Context) => {
  initSentry();

  if (req.method !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  try {
    assertRequiredEnv([
      "SUPABASE_DATABASE_URL",
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_ANON_KEY",
    ]);
  } catch (error) {
    return handleMissingEnvironmentError(error, "inspect-library");
  }

  const authenticated = await verifyAuthenticatedUser(req);
  if (!authenticated) {
    return unauthorized();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  const validation = validateLibraryInspectionRequest(body);
  if (!validation.success) {
    return validationError(
      "Validation failed",
      getValidationDetails(validation.issues),
    );
  }

  const publicUrl = await resolvePublicHttpUrl(validation.output.url);
  if (!publicUrl) {
    return validationError("Validation failed", {
      url: [PUBLIC_URL_ERROR],
    });
  }

  try {
    const metadata = await extractMetadata(publicUrl);
    if (metadata.error) {
      await recordInspectionFailure();
      return serviceUnavailable(INSPECTION_ERROR);
    }

    return ok({
      title: metadata.title,
      description: metadata.description,
    });
  } catch {
    await recordInspectionFailure();
    return serviceUnavailable(INSPECTION_ERROR);
  }
};

export const config: Config = {
  path: "/api/library/inspect",
  method: "POST",
};
