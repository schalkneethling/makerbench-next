import * as v from "valibot";
import {
  GITHUB_USERNAME_MAX_LENGTH,
  isValidGithubProfileUrl,
  isValidGithubUsername,
} from "./github";

const urlSchema = v.pipe(v.string(), v.url("Please enter a valid URL"));
const MAX_URL_LENGTH = 2000;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const resourceUrlSchema = v.pipe(
  v.string(),
  v.minLength(1, "URL is required"),
  v.maxLength(
    MAX_URL_LENGTH,
    `URL must be ${MAX_URL_LENGTH} characters or less`,
  ),
  v.url("Please enter a valid URL"),
  v.check(isHttpUrl, "Please enter a valid HTTP/HTTPS URL"),
);

const resourceTagValueSchema = v.pipe(
  v.string(),
  v.minLength(1, "Tag cannot be empty"),
  v.maxLength(50, "Tag must be 50 characters or less"),
);

const resourceTagsSchema = v.pipe(
  v.array(resourceTagValueSchema),
  v.minLength(1, "At least one tag is required"),
  v.maxLength(10, "Maximum 10 tags allowed"),
);

const githubProfileUrlSchema = v.pipe(
  v.string(),
  v.url("Please enter a valid GitHub URL"),
  v.check(
    (url) => isValidGithubProfileUrl(url),
    "Please enter a valid GitHub profile URL (https://github.com/username)",
  ),
);

const optionalGithubProfileUrlSchema = v.optional(
  v.union([githubProfileUrlSchema, v.literal("")]),
);

const optionalSubmitterNameSchema = v.optional(
  v.pipe(v.string(), v.maxLength(100, "Name must be 100 characters or less")),
);

const optionalGithubUsernameSchema = v.optional(
  v.union([
    v.pipe(
      v.string(),
      v.maxLength(
        GITHUB_USERNAME_MAX_LENGTH,
        `GitHub username must be ${GITHUB_USERNAME_MAX_LENGTH} characters or less`,
      ),
      v.check(isValidGithubUsername, "Please enter a valid GitHub username"),
    ),
    v.literal(""),
  ]),
);

const publicSubmissionTypeSchema = v.picklist(["tool", "resource"]);
const publicSubmissionStatusSchema = v.picklist([
  "pending",
  "approved",
  "rejected",
]);

export const publicSubmissionRequestSchema = v.strictObject({
  type: publicSubmissionTypeSchema,
  url: resourceUrlSchema,
  tags: resourceTagsSchema,
  submitterName: optionalSubmitterNameSchema,
  submitterGithubUsername: optionalGithubUsernameSchema,
  submitterGithubUrl: optionalGithubProfileUrlSchema,
});

const publicSubmissionResponseDataSchema = v.object({
  submittedItemId: v.pipe(v.string(), v.uuid()),
  type: publicSubmissionTypeSchema,
  status: publicSubmissionStatusSchema,
  message: v.string(),
});

export const publicSubmissionResponseSchema = v.object({
  success: v.literal(true),
  data: publicSubmissionResponseDataSchema,
});

export const apiErrorResponseSchema = v.object({
  success: v.literal(false),
  error: v.string(),
  details: v.optional(v.record(v.string(), v.array(v.string()))),
});

const toolSubmissionSchema = v.object({
  url: urlSchema,
  githubUrl: optionalGithubProfileUrlSchema,
  tags: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1, "Tag cannot be empty"))),
    v.minLength(1, "At least one tag is required"),
  ),
  submitterName: optionalSubmitterNameSchema,
  submitterGithubUrl: optionalGithubProfileUrlSchema,
});

export const personalResourceRequestSchema = v.object({
  url: resourceUrlSchema,
  title: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(300, "Title must be 300 characters or less"),
    ),
  ),
  description: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(2000, "Description must be 2000 characters or less"),
    ),
  ),
  tags: resourceTagsSchema,
  notes: v.optional(
    v.pipe(
      v.string(),
      v.maxLength(5000, "Notes must be 5000 characters or less"),
    ),
  ),
});

export const libraryInspectionRequestSchema = v.strictObject({
  url: resourceUrlSchema,
});

export const libraryInspectionResponseSchema = v.object({
  success: v.literal(true),
  data: v.object({
    title: v.nullable(v.string()),
    description: v.nullable(v.string()),
  }),
});

export type BookmarkRequest = Omit<PublicSubmissionRequest, "type">;
export type PersonalResourceRequest = v.InferOutput<
  typeof personalResourceRequestSchema
>;
export type LibraryInspectionResponse = v.InferOutput<
  typeof libraryInspectionResponseSchema
>;
export type PublicSubmissionType = v.InferOutput<
  typeof publicSubmissionTypeSchema
>;
export type PublicSubmissionRequest = v.InferOutput<
  typeof publicSubmissionRequestSchema
>;
export type PublicSubmissionResponseData = v.InferOutput<
  typeof publicSubmissionResponseDataSchema
>;

export const validateToolSubmission = (data: unknown) => {
  return v.safeParse(toolSubmissionSchema, data);
};

export const validatePersonalResourceRequest = (data: unknown) => {
  return v.safeParse(personalResourceRequestSchema, data);
};

export const validateLibraryInspectionRequest = (data: unknown) => {
  return v.safeParse(libraryInspectionRequestSchema, data);
};

export const validatePublicSubmissionRequest = (data: unknown) => {
  return v.safeParse(publicSubmissionRequestSchema, data);
};

export const validatePublicSubmissionResponse = (data: unknown) => {
  return v.safeParse(publicSubmissionResponseSchema, data);
};

export const validateUrl = (url: string) => {
  return v.safeParse(urlSchema, url);
};

export const validateTags = (tags: string[]) => {
  const tagArraySchema = v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1, "Tag cannot be empty"))),
    v.minLength(1, "At least one tag is required"),
  );
  return v.safeParse(tagArraySchema, tags);
};

export const parseTagsFromString = (tagsString: string): string[] => {
  return tagsString
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};
