import * as v from "valibot";
import { isValidGithubProfileUrl } from "./github";

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
  v.maxLength(MAX_URL_LENGTH, `URL must be ${MAX_URL_LENGTH} characters or less`),
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

const optionalGithubProfileUrlSchema = v.optional(v.union([githubProfileUrlSchema, v.literal("")]));

export const tagSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(
    v.string(),
    v.minLength(1, "Tag name is required"),
    v.maxLength(50, "Tag name must be 50 characters or less"),
  ),
  description: v.optional(v.string()),
});

export const submitterSchema = v.object({
  name: v.pipe(
    v.string(),
    v.minLength(1, "Name is required"),
    v.maxLength(100, "Name must be 100 characters or less"),
  ),
  githubUrl: githubProfileUrlSchema,
});

export const toolSubmissionSchema = v.object({
  url: urlSchema,
  githubUrl: optionalGithubProfileUrlSchema,
  tags: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1, "Tag cannot be empty"))),
    v.minLength(1, "At least one tag is required"),
  ),
  submitterName: v.optional(
    v.pipe(v.string(), v.maxLength(100, "Name must be 100 characters or less")),
  ),
  submitterGithubUrl: optionalGithubProfileUrlSchema,
});

export const bookmarkRequestSchema = v.object({
  url: resourceUrlSchema,
  tags: resourceTagsSchema,
  submitterName: v.optional(
    v.pipe(v.string(), v.maxLength(100, "Name must be 100 characters or less")),
  ),
  submitterGithubUsername: v.optional(
    v.union([
      v.pipe(
        v.string(),
        v.maxLength(39, "GitHub username must be 39 characters or less"),
        v.regex(
          /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/,
          "Please enter a valid GitHub username",
        ),
      ),
      v.literal(""),
    ]),
  ),
  submitterGithubUrl: optionalGithubProfileUrlSchema,
});

export const personalResourceRequestSchema = v.object({
  url: resourceUrlSchema,
  tags: resourceTagsSchema,
  notes: v.optional(v.pipe(v.string(), v.maxLength(5000, "Notes must be 5000 characters or less"))),
});

export const toolMetadataSchema = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  screenshotUrl: v.optional(v.pipe(v.string(), v.url())),
  extractedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export const toolSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  url: urlSchema,
  title: v.string(),
  description: v.string(),
  imageUrl: v.optional(v.pipe(v.string(), v.url())),
  githubUrl: v.optional(v.pipe(v.string(), v.url())),
  tags: v.array(tagSchema),
  submitter: v.optional(submitterSchema),
  status: v.picklist(["pending", "approved", "rejected"]),
  createdAt: v.pipe(v.string(), v.isoTimestamp()),
  approvedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const searchRequestSchema = v.object({
  query: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))),
  offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

export const submitToolResponseSchema = v.object({
  success: v.boolean(),
  message: v.string(),
  toolId: v.optional(v.pipe(v.string(), v.uuid())),
});

export const getToolsResponseSchema = v.object({
  tools: v.array(toolSchema),
  total: v.pipe(v.number(), v.integer(), v.minValue(0)),
  hasMore: v.boolean(),
});

export type Tag = v.InferOutput<typeof tagSchema>;
export type Submitter = v.InferOutput<typeof submitterSchema>;
export type ToolSubmissionData = v.InferOutput<typeof toolSubmissionSchema>;
export type BookmarkRequest = v.InferOutput<typeof bookmarkRequestSchema>;
export type PersonalResourceRequest = v.InferOutput<typeof personalResourceRequestSchema>;
export type ToolMetadata = v.InferOutput<typeof toolMetadataSchema>;
export type Tool = v.InferOutput<typeof toolSchema>;
export type SearchRequest = v.InferOutput<typeof searchRequestSchema>;
export type SubmitToolResponse = v.InferOutput<typeof submitToolResponseSchema>;
export type GetToolsResponse = v.InferOutput<typeof getToolsResponseSchema>;

export const validateToolSubmission = (data: unknown) => {
  return v.safeParse(toolSubmissionSchema, data);
};

export const validateBookmarkRequest = (data: unknown) => {
  return v.safeParse(bookmarkRequestSchema, data);
};

export const validatePersonalResourceRequest = (data: unknown) => {
  return v.safeParse(personalResourceRequestSchema, data);
};

export const validateSearchRequest = (data: unknown) => {
  return v.safeParse(searchRequestSchema, data);
};

export const validateToolMetadata = (data: unknown) => {
  return v.safeParse(toolMetadataSchema, data);
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
