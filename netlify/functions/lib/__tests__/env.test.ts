import { describe, expect, it, vi } from "vitest";

import { getEnv } from "../env";

describe("function environment access", () => {
  it("reads only from the Netlify runtime environment", () => {
    const key = "RATE_LIMIT_ENV_SOURCE_TEST";
    process.env[key] = "process-value";
    const get = vi.spyOn(Netlify.env, "get").mockReturnValue(undefined);

    try {
      expect(getEnv(key)).toBeUndefined();
      expect(get).toHaveBeenCalledWith(key);
    } finally {
      delete process.env[key];
      get.mockRestore();
    }
  });
});
