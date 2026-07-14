import type { Config, Context } from "@netlify/functions";

import {
  assertRequiredEnv,
  captureError,
  consumeSubmissionRateLimit,
  createSubmissionRateLimitKey,
  dependencyUnavailable,
  flushSentry,
  getSubmissionRateLimitConfig,
  handleMissingEnvironmentError,
  initSentry,
  methodNotAllowed,
  ok,
  serviceUnavailable,
  tooManyRequests,
  unauthorized,
  validationError,
  verifyAuthenticatedUser,
} from "./lib";
import { handleInvalidEnvironmentError } from "./lib/env";
import { resolvePublicHttpUrl } from "./lib/public-url";
import type { SubmissionRateLimitConfig } from "./lib/submission-rate-limit";
import { getValidationDetails } from "./lib/validation";
import { extractMetadata } from "../../src/lib/services/metadata";
import { validateLibraryInspectionRequest } from "../../src/lib/validation";

const PUBLIC_URL_ERROR = "Please enter a publicly reachable HTTP/HTTPS URL";
const INSPECTION_ERROR =
  "We couldn't inspect this URL right now. You can still save it to your library.";

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

  let rateLimitConfig: SubmissionRateLimitConfig;
  let keyHash: string;
  try {
    rateLimitConfig = getSubmissionRateLimitConfig();
    keyHash = createSubmissionRateLimitKey(
      { authenticated, clientIp: undefined },
      rateLimitConfig.secret,
      "library-inspection",
    );
  } catch (error) {
    return handleInvalidEnvironmentError(error, "inspect-library");
  }

  try {
    const allowed = await consumeSubmissionRateLimit(keyHash, rateLimitConfig);
    if (!allowed) {
      return tooManyRequests();
    }
  } catch {
    captureError(
      new Error("Library inspection rate limit datastore operation failed"),
      {
        function: "inspect-library",
        dependency: "submission-rate-limit-store",
      },
    );
    await flushSentry();
    return dependencyUnavailable();
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

  const publicTarget = await resolvePublicHttpUrl(validation.output.url);
  if (!publicTarget) {
    return validationError("Validation failed", {
      url: [PUBLIC_URL_ERROR],
    });
  }

  try {
    const metadata = await extractMetadata(publicTarget.url, {
      dispatcher: publicTarget.dispatcher,
    });
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
  } finally {
    await publicTarget.dispatcher.close();
  }
};

export const config: Config = {
  path: "/api/library/inspect",
  method: "POST",
};
