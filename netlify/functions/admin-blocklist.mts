import type { Config, Context } from "@netlify/functions";
import type { BaseIssue } from "valibot";
import * as v from "valibot";

import {
  badRequest,
  captureError,
  conflict,
  created,
  flushSentry,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  serverError,
  unauthorized,
  validationError,
} from "./lib";
import { verifyAuthenticatedUser } from "./lib/auth";
import {
  blocklistDeleteRequestSchema,
  blocklistEntryRequestSchema,
  createSubmissionBlocklistEntry,
  deleteSubmissionBlocklistEntry,
  listSubmissionBlocklistEntries,
  listSubmissionBlocklistEvents,
} from "./lib/submission-blocklist";

function getValidationDetails(issues: readonly BaseIssue<unknown>[]) {
  return issues.reduce<Record<string, string[]>>((details, issue) => {
    const field = issue.path?.map((item) => item.key).join(".") || "form";
    details[field] ??= [];
    details[field].push(issue.message);
    return details;
  }, {});
}

async function parseRequest(req: Request): Promise<unknown | Response> {
  try {
    return await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }
}

export default async (req: Request, _context: Context) => {
  if (
    req.method !== "GET" &&
    req.method !== "POST" &&
    req.method !== "DELETE"
  ) {
    return methodNotAllowed(["GET", "POST", "DELETE"]);
  }

  try {
    const auth = await verifyAuthenticatedUser(req);
    if (!auth) {
      return unauthorized();
    }
    if (!auth.isAdmin) {
      return forbidden("Admin access required");
    }

    if (req.method === "GET") {
      const [entries, recentEvents] = await Promise.all([
        listSubmissionBlocklistEntries(),
        listSubmissionBlocklistEvents(),
      ]);
      return ok({ entries, recentEvents });
    }

    const body = await parseRequest(req);
    if (body instanceof Response) {
      return body;
    }

    if (req.method === "POST") {
      const parsed = v.safeParse(blocklistEntryRequestSchema, body);
      if (!parsed.success) {
        return validationError(
          "Validation failed",
          getValidationDetails(parsed.issues),
        );
      }

      const result = await createSubmissionBlocklistEntry(
        parsed.output,
        auth.user.id,
      );
      if (result.outcome === "invalid") {
        return badRequest(
          parsed.output.matchType === "domain"
            ? "Enter a domain without a path, query, or fragment"
            : "Enter a valid HTTP/HTTPS URL",
        );
      }
      if (result.outcome === "duplicate") {
        return conflict("This blocklist rule already exists");
      }
      return created(result.entry);
    }

    const parsed = v.safeParse(blocklistDeleteRequestSchema, body);
    if (!parsed.success) {
      return validationError(
        "Validation failed",
        getValidationDetails(parsed.issues),
      );
    }

    return (await deleteSubmissionBlocklistEntry(parsed.output.id))
      ? ok({ id: parsed.output.id })
      : notFound("Blocklist rule not found");
  } catch (error) {
    captureError(error, {
      function: "admin-blocklist",
      requestId: _context.requestId,
    });
    await flushSentry();
    return serverError("An error occurred while managing the blocklist");
  }
};

export const config: Config = {
  path: "/api/admin/blocklist",
};
