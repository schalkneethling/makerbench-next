import type { Config, Context } from "@netlify/functions";

import { handlePublicSubmission } from "./lib/submissions";

export default async (req: Request, context: Context) => {
  return await handlePublicSubmission(req, {
    context,
    endpointName: "process-tool",
    allowedTypes: ["tool"],
    rejectedTypeDetails: {
      type: ["/api/tools only accepts tool submissions"],
    },
  });
};

export const config: Config = {
  path: "/api/tools",
  method: "POST",
};
