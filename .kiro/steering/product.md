# Product Overview

Makerbench is a bookmark management platform that allows users to save and organize URLs with tags. The application provides:

- URL submission with custom tagging
- Automatic metadata extraction (title, description, Open Graph images)
- Screenshot generation for URLs without images (via Browserless)
- Content moderation with approval workflow
- Search and filtering capabilities across bookmarks and tags
- Image storage on AWS S3 for screenshots

## Key Features

- **URL Bookmarking**: Submit URLs with comma-separated tags
- **Metadata Extraction**: Automatic title, description, and image extraction using Cheerio
- **Screenshot Fallback**: Browserless integration for pages without Open Graph images
- **Content Approval**: All submissions require approval to prevent spam
- **Search & Filter**: Full-text search across titles and tags
- **Tag Management**: Organize bookmarks with a flexible tagging system

## User Flow

1. User submits URL with tags via form
2. System processes via Netlify function (`process-bookmark.mts`)
3. HTML is fetched and parsed for metadata
4. If no Open Graph image exists, screenshot is taken via Browserless
5. Images stored on AWS S3, bookmark saved to Turso database
6. Content awaits approval before appearing in public index
