import { z } from 'zod';

// URL validation schema
const urlSchema = z.string().url('Please enter a valid URL');

// Tag validation schema
export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name must be 50 characters or less'),
  description: z.string().optional()
});

// Submitter validation schema
export const submitterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  githubUrl: z.string().url('Please enter a valid GitHub URL')
});

// Tool submission validation schema
export const toolSubmissionSchema = z.object({
  url: urlSchema,
  githubUrl: z.string().url('Please enter a valid GitHub URL').optional().or(z.literal('')),
  tags: z.array(z.string().min(1, 'Tag cannot be empty')).min(1, 'At least one tag is required'),
  submitterName: z.string().max(100, 'Name must be 100 characters or less').optional(),
  submitterGithubUrl: z.string().url('Please enter a valid GitHub URL').optional().or(z.literal(''))
});

// Bookmark request schema (for API endpoint)
export const bookmarkRequestSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .max(2000, 'URL must be 2000 characters or less')
    .url('Please enter a valid URL'),
  tags: z.array(
    z.string()
      .min(1, 'Tag cannot be empty')
      .max(50, 'Tag must be 50 characters or less')
  )
    .min(1, 'At least one tag is required')
    .max(10, 'Maximum 10 tags allowed'),
  submitterName: z.string()
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  submitterGithubUrl: z.string()
    .url('Please enter a valid URL')
    .refine(
      (url) => url.includes('github.com'),
      'Please enter a valid GitHub URL'
    )
    .optional()
    .or(z.literal(''))
});

// Tool metadata validation schema
export const toolMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  screenshotUrl: z.string().url().optional(),
  extractedAt: z.string().datetime()
});

// Tool data validation schema
export const toolSchema = z.object({
  id: z.string().uuid(),
  url: urlSchema,
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  tags: z.array(tagSchema),
  submitter: submitterSchema.optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: z.string().datetime(),
  approvedAt: z.string().datetime().optional()
});

// Search request validation schema
export const searchRequestSchema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

// API response schemas
export const submitToolResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  toolId: z.string().uuid().optional()
});

export const getToolsResponseSchema = z.object({
  tools: z.array(toolSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean()
});

// TypeScript types inferred from Zod schemas
export type Tag = z.infer<typeof tagSchema>;
export type Submitter = z.infer<typeof submitterSchema>;
export type ToolSubmissionData = z.infer<typeof toolSubmissionSchema>;
export type BookmarkRequest = z.infer<typeof bookmarkRequestSchema>;
export type ToolMetadata = z.infer<typeof toolMetadataSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SubmitToolResponse = z.infer<typeof submitToolResponseSchema>;
export type GetToolsResponse = z.infer<typeof getToolsResponseSchema>;

// Utility validation functions
export const validateToolSubmission = (data: unknown) => {
  return toolSubmissionSchema.safeParse(data);
};

export const validateBookmarkRequest = (data: unknown) => {
  return bookmarkRequestSchema.safeParse(data);
};

export const validateSearchRequest = (data: unknown) => {
  return searchRequestSchema.safeParse(data);
};

export const validateToolMetadata = (data: unknown) => {
  return toolMetadataSchema.safeParse(data);
};

// Form validation helpers
export const validateUrl = (url: string) => {
  return urlSchema.safeParse(url);
};

export const validateTags = (tags: string[]) => {
  const tagArraySchema = z.array(z.string().min(1, 'Tag cannot be empty')).min(1, 'At least one tag is required');
  return tagArraySchema.safeParse(tags);
};

// Parse comma-separated tags utility
export const parseTagsFromString = (tagsString: string): string[] => {
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
};
