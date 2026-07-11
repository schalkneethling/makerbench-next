const secretBytes = crypto.getRandomValues(new Uint8Array(32));

export const TEST_SUBMISSION_RATE_LIMIT_SECRET = Array.from(secretBytes, (byte) =>
  byte.toString(16).padStart(2, "0"),
).join("");
