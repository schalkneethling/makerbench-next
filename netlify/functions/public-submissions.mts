import type { Config, Context } from "@netlify/functions";

import { handlePublicSubmission } from "./lib/submissions";

export default async (req: Request, context: Context) => {
  return await handlePublicSubmission(req, {
    context,
    endpointName: "public-submissions",
  });
};

export const config: Config = {
  path: "/api/submissions",
  method: "POST",
};
