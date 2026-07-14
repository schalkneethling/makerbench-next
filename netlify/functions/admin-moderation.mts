import type { Config, Context } from "@netlify/functions";
import * as v from "valibot";

import {
  badRequest,
  conflict,
  forbidden,
  methodNotAllowed,
  notFound,
  ok,
  serverError,
  unauthorized,
  validationError,
} from "./lib";
import {
  listPendingModerationItems,
  moderationReviewSchema,
  moderationTypeFilterSchema,
  reviewModerationItem,
  type ModerationEntityType,
} from "./lib/admin-moderation";
import { verifyAuthenticatedUser } from "./lib/auth";
import { getValidationDetails } from "./lib/validation";

function parseTypeFilter(req: Request): ModerationEntityType | null | Response {
  const typeParam = new URL(req.url).searchParams.get("type");
  const parsed = v.safeParse(moderationTypeFilterSchema, typeParam);

  if (!parsed.success) {
    return badRequest("type must be one of tool, resource, stack, stack-item");
  }

  return parsed.output;
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

  const result = await reviewModerationItem(parsed.output, reviewerId);

  if (result.outcome === "not-found") {
    return notFound("Moderation item not found");
  }

  if (result.outcome === "already-reviewed") {
    return conflict(`Moderation item is already ${result.status}`);
  }

  return ok({
    id: result.item.id,
    type: parsed.output.type,
    status: result.item.status,
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
