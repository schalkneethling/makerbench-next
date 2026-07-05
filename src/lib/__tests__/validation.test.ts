import { describe, it, expect } from "vitest";
import {
  validateToolSubmission,
  validatePersonalResourceRequest,
  validatePublicSubmissionRequest,
  validatePublicSubmissionResponse,
  validateUrl,
  validateTags,
  parseTagsFromString,
} from "../validation";

describe("Validation Schemas", () => {
  describe("validateToolSubmission", () => {
    it("should validate a valid tool submission", () => {
      const validSubmission = {
        url: "https://example.com",
        tags: ["development", "tools"],
        submitterName: "John Doe",
        submitterGithubUrl: "https://github.com/johndoe",
      };

      const result = validateToolSubmission(validSubmission);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const invalidSubmission = {
        url: "not-a-url",
        tags: ["development"],
      };

      const result = validateToolSubmission(invalidSubmission);
      expect(result.success).toBe(false);
    });

    it("should reject empty tags array", () => {
      const invalidSubmission = {
        url: "https://example.com",
        tags: [],
      };

      const result = validateToolSubmission(invalidSubmission);
      expect(result.success).toBe(false);
    });

    it("should reject non-GitHub submitter URLs", () => {
      const invalidSubmission = {
        url: "https://example.com",
        tags: ["development"],
        submitterGithubUrl: "https://gitlab.com/johndoe",
      };

      const result = validateToolSubmission(invalidSubmission);
      expect(result.success).toBe(false);
    });

    it("should reject GitHub URLs that are not profile URLs", () => {
      const invalidSubmission = {
        url: "https://example.com",
        tags: ["development"],
        submitterGithubUrl: "https://github.com/johndoe/repo",
      };

      const result = validateToolSubmission(invalidSubmission);
      expect(result.success).toBe(false);
    });
  });

  describe("validatePersonalResourceRequest", () => {
    it("should accept HTTP and HTTPS resource URLs", () => {
      expect(
        validatePersonalResourceRequest({
          url: "https://example.com/resource",
          tags: ["react"],
        }).success,
      ).toBe(true);
      expect(
        validatePersonalResourceRequest({
          url: "http://example.com/resource",
          tags: ["react"],
        }).success,
      ).toBe(true);
    });

    it("should reject URL schemes the server will not normalize", () => {
      const result = validatePersonalResourceRequest({
        url: "mailto:test@example.com",
        tags: ["react"],
      });

      expect(result.success).toBe(false);
    });
  });

  describe("validatePublicSubmissionRequest", () => {
    it.each(["tool", "article", "resource"] as const)(
      "should validate %s public submissions",
      (type) => {
        const result = validatePublicSubmissionRequest({
          type,
          url: `https://example.com/${type}`,
          tags: ["development"],
        });

        expect(result.success).toBe(true);
      },
    );

    it("should validate optional anonymous submitter attribution", () => {
      const result = validatePublicSubmissionRequest({
        type: "resource",
        url: "https://example.com/resource",
        tags: ["reference"],
        submitterName: "Zoë Álvarez",
        submitterGithubUrl: "https://github.com/alexmaker",
      });

      expect(result.success).toBe(true);
    });

    it("should reject invalid GitHub usernames without constraining display names to ASCII", () => {
      expect(
        validatePublicSubmissionRequest({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["development"],
          submitterName: "Renée Developer",
          submitterGithubUsername: "renée-dev",
        }).success,
      ).toBe(false);

      expect(
        validatePublicSubmissionRequest({
          type: "tool",
          url: "https://example.com/tool",
          tags: ["development"],
          submitterName: "Renée Developer",
          submitterGithubUsername: "renee-dev",
        }).success,
      ).toBe(true);
    });

    it("should validate optional authenticated user context", () => {
      const result = validatePublicSubmissionRequest({
        type: "article",
        url: "https://example.com/article",
        tags: ["writing"],
        authenticatedUser: {
          userId: "11111111-1111-4111-8111-111111111111",
        },
      });

      expect(result.success).toBe(true);
    });

    it("should reject unsupported public submission types", () => {
      const result = validatePublicSubmissionRequest({
        type: "video",
        url: "https://example.com/video",
        tags: ["media"],
      });

      expect(result.success).toBe(false);
    });

    it("should reject invalid authenticated user ids", () => {
      const result = validatePublicSubmissionRequest({
        type: "resource",
        url: "https://example.com/resource",
        tags: ["reference"],
        authenticatedUser: {
          userId: "not-a-user-id",
        },
      });

      expect(result.success).toBe(false);
    });
  });

  describe("validatePublicSubmissionResponse", () => {
    it("should validate standardized pending review response data", () => {
      const result = validatePublicSubmissionResponse({
        success: true,
        data: {
          submittedItemId: "11111111-1111-4111-8111-111111111111",
          type: "tool",
          status: "pending",
          message: "Tool submitted. It will be reviewed shortly.",
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("validateUrl", () => {
    it("should validate correct URLs", () => {
      expect(validateUrl("https://example.com").success).toBe(true);
      expect(validateUrl("http://localhost:3000").success).toBe(true);
    });

    it("should reject invalid URLs", () => {
      expect(validateUrl("not-a-url").success).toBe(false);
      expect(validateUrl("").success).toBe(false);
    });
  });

  describe("validateTags", () => {
    it("should validate non-empty tag arrays", () => {
      expect(validateTags(["react", "javascript"]).success).toBe(true);
    });

    it("should reject empty arrays", () => {
      expect(validateTags([]).success).toBe(false);
    });

    it("should reject arrays with empty strings", () => {
      expect(validateTags(["react", ""]).success).toBe(false);
    });
  });

  describe("parseTagsFromString", () => {
    it("should parse comma-separated tags", () => {
      const result = parseTagsFromString("react, javascript, web development");
      expect(result).toEqual(["react", "javascript", "web development"]);
    });

    it("should handle extra whitespace", () => {
      const result = parseTagsFromString("  react  ,  javascript  ,  ");
      expect(result).toEqual(["react", "javascript"]);
    });

    it("should handle empty string", () => {
      const result = parseTagsFromString("");
      expect(result).toEqual([]);
    });
  });
});
