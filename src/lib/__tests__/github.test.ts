import { describe, expect, it } from "vitest";
import {
  getGithubUsernameFromProfileUrl,
  isValidGithubProfileUrl,
} from "../github";

describe("github utils", () => {
  describe("isValidGithubProfileUrl", () => {
    it("accepts valid profile URLs", () => {
      expect(isValidGithubProfileUrl("https://github.com/octocat")).toBe(true);
      expect(isValidGithubProfileUrl("https://github.com/octocat/")).toBe(true);
      expect(isValidGithubProfileUrl("https://www.github.com/octocat")).toBe(
        true,
      );
    });

    it("rejects non-profile or non-github URLs", () => {
      expect(isValidGithubProfileUrl("https://github.com/octocat/repo")).toBe(
        false,
      );
      expect(isValidGithubProfileUrl("https://github.com")).toBe(false);
      expect(isValidGithubProfileUrl("https://gitlab.com/octocat")).toBe(false);
      expect(isValidGithubProfileUrl("https://bit.ly/octocat")).toBe(false);
      expect(isValidGithubProfileUrl("http://github.com/octocat")).toBe(false);
    });
  });

  describe("getGithubUsernameFromProfileUrl", () => {
    it("extracts username from valid profile URL", () => {
      expect(getGithubUsernameFromProfileUrl("https://github.com/octocat")).toBe(
        "octocat",
      );
    });

    it("returns null for invalid URLs", () => {
      expect(getGithubUsernameFromProfileUrl("https://github.com/octocat/repo")).toBe(
        null,
      );
      expect(getGithubUsernameFromProfileUrl("https://bit.ly/octocat")).toBe(
        null,
      );
    });
  });
});
