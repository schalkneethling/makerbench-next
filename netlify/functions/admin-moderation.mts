import type { Config, Context } from "@netlify/functions";
import type { BaseIssue } from "valibot";
import * as v from "valibot";

import {
  badRequest,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  serverError,
  unauthorized,
  validationError,
} from "./lib";
import {
  isModerationEntityType,
  listPendingModerationItems,
  moderationReviewSchema,
  reviewModerationItem,
  type ModerationEntityType,
} from "./lib/admin-moderation";
import { verifyAuthenticatedUser } from "./lib/auth";

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

function parseTypeFilter(req: Request): ModerationEntityType | null | Response {
  const typeParam = new URL(req.url).searchParams.get("type");
  let type: ModerationEntityType | null = null;

  if (typeParam) {
    if (!isModerationEntityType(typeParam)) {
      return badRequest(
        "type must be one of tool, resource, stack, stack-item",
      );
    }
    type = typeParam;
  }

  return type;
}

async function requireAdmin(req: Request) {
  const auth = await verifyAuthenticatedUser(req);

  if (!auth) {
    return { response: unauthorized(), auth: null };
  }

  if (!auth.isAdmin) {
    return { response: forbidden("Admin access required"), auth: null };
  }

  return { response: null, auth };
}

async function handleGet(req: Request) {
  const type = parseTypeFilter(req);
  if (type instanceof Response) {
    return type;
  }

  const items = await listPendingModerationItems(type);
  return ok({ items });
}

async function handlePatch(req: Request, reviewerId: string) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  const parsed = v.safeParse(moderationReviewSchema, body);
  if (!parsed.success) {
    return validationError(
      "Validation failed",
      getValidationDetails(parsed.issues),
    );
  }

  const updated = await reviewModerationItem(parsed.output, reviewerId);

  if (!updated) {
    return notFound("Moderation item not found");
  }

  return ok({
    id: updated.id,
    type: parsed.output.type,
    status: updated.status,
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET" && req.method !== "PATCH") {
    return methodNotAllowed(["GET", "PATCH"]);
  }

  try {
    const { response, auth } = await requireAdmin(req);
    if (response) {
      return response;
    }

    return req.method === "GET"
      ? await handleGet(req)
      : await handlePatch(req, auth.user.id);
  } catch (error) {
    console.error("[admin-moderation]", error);
    return serverError("An error occurred while handling moderation");
  }
};

export const config: Config = {
  path: "/api/admin/moderation",
};
