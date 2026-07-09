import type { Config, Context } from "@netlify/functions";

import { handlePublicSubmission } from "./lib/submissions";

export default async (req: Request, _context: Context) => {
  return await handlePublicSubmission(req, {
    endpointName: "public-submissions",
  });
};

export const config: Config = {
  path: "/api/submissions",
  method: "POST",
};
