# Makerbench Project Overview

## Vision

Makerbench is a curated URL bookmarking platform designed for makers, developers, and creators. It allows users to submit, tag, search, and discover tools, resources, and interesting links. The platform features an approval workflow to maintain content quality and prevent spam.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19 + TypeScript |
| **Build Tool** | Vite 6 |
| **Backend** | Netlify Functions (serverless) |
| **Database** | Turso (libSQL/SQLite) |
| **ORM** | Drizzle ORM |
| **Validation** | Zod |
| **Hosting** | Netlify |
| **Screenshots** | Browserless API |
| **Image Storage** | AWS S3 |
| **Search** | Algolia (planned) |
| **Styling** | Pure CSS (no frameworks) |
| **Testing** | Vitest |
| **Linting** | ESLint + Stylelint + Prettier |

---

## Core Features (Planned)

### User-Facing
1. **URL Submission** - Submit URLs with comma-separated tags
2. **Bookmark Listing** - Browse all approved bookmarks on landing page
3. **Search & Filter** - Search by title and/or tags
4. **Bookmark Cards** - Display title, description, image (OG or screenshot)
5. **Tag Navigation** - Click tags to filter related bookmarks

### Admin
1. **Approval Queue** - Review pending submissions
2. **Status Management** - Approve/reject bookmarks
3. **Content Moderation** - Prevent spam and inappropriate content

### Backend Processing
1. **Metadata Extraction** - Fetch page title, description, OG image using Cheerio
2. **Screenshot Generation** - Use Browserless when no OG image exists
3. **Image Storage** - Store screenshots in AWS S3
4. **Fallback Image** - Default image when screenshot fails

---

## Current Implementation Status

### ✅ Completed

| Component | Status | Notes |
|-----------|--------|-------|
| **Project Setup** | ✅ Done | Vite + React + TypeScript configured |
| **Database Schema** | ✅ Done | Three tables: bookmarks, tags, bookmark_tags |
| **Drizzle ORM Setup** | ✅ Done | Schema, types, config complete |
| **Migrations** | ✅ Done | Initial migration generated |
| **DB Queries** | ✅ Done | CRUD for bookmarks and tags |
| **Utility Functions** | ✅ Done | UUID, URL validation, tag normalization, metadata parsing |
| **Custom Errors** | ✅ Done | MetadataParseError, InvalidUrlError, TagValidationError |
| **Zod Validation** | ✅ Done | Schemas for submissions, tools, search, API responses |
| **Unit Tests** | ✅ Done | Validation tests with Vitest |
| **Netlify Config** | ✅ Done | Basic netlify.toml configured |
| **ESLint/Stylelint** | ✅ Done | Code quality tools configured |
| **Environment Config** | ✅ Done | DATABASE_SETUP.md with instructions |

### 🚧 Not Yet Implemented

| Component | Priority | Notes |
|-----------|----------|-------|
| **UI Components** | High | Still using Vite template placeholder |
| **Netlify Functions** | High | `process-bookmark` function not created |
| **Submission Form** | High | URL + tags input form |
| **Bookmark List** | High | Card-based display |
| **Search UI** | High | Search input + results |
| **Cheerio Integration** | High | Metadata extraction |
| **Browserless Integration** | Medium | Screenshot generation |
| **S3 Integration** | Medium | Image storage |
| **Algolia Integration** | Medium | Search indexing |
| **Admin Panel** | Medium | Approval workflow UI |
| **Routing** | Medium | React Router or similar |
| **Error Handling UI** | Medium | User-friendly error states |
| **Loading States** | Low | Skeleton/spinner components |
| **Fallback Image** | Low | Default placeholder image |

---

## Database Schema

### `bookmarks` Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| url | TEXT | Submitted URL |
| title | TEXT | Page title (from OG/meta) |
| description | TEXT | Page description |
| status | TEXT | pending / approved / rejected |
| metadata | TEXT | JSON: screenshot path, OG image, etc. |
| createdAt | TEXT | Submission timestamp |
| approvedAt | TEXT | Approval timestamp |
| updatedAt | TEXT | Last update timestamp |

### `tags` Table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| name | TEXT | Unique tag name (normalized) |
| description | TEXT | Optional tag description |
| createdAt | TEXT | Creation timestamp |

### `bookmark_tags` Table (Junction)
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (UUID) | Primary key |
| bookmarkId | TEXT | FK → bookmarks.id |
| tagId | TEXT | FK → tags.id |
| createdAt | TEXT | Relationship timestamp |

---

## File Structure

```
makerbench-next/
├── src/
│   ├── App.tsx              # Main React component (placeholder)
│   ├── App.css              # App styles (placeholder)
│   ├── index.css            # Global styles (placeholder)
│   ├── main.tsx             # React entry point
│   ├── db/
│   │   ├── index.ts         # Drizzle client setup
│   │   ├── schema.ts        # Database schema definitions
│   │   ├── errors.ts        # Custom error classes
│   │   ├── utils.ts         # DB utility functions
│   │   └── queries/
│   │       ├── bookmarks.ts # Bookmark CRUD operations
│   │       └── tags.ts      # Tag CRUD operations
│   └── lib/
│       ├── validation.ts    # Zod schemas and validators
│       └── __tests__/
│           └── validation.test.ts
├── netlify/
│   └── functions/           # (TO CREATE) Serverless functions
├── migrations/              # Drizzle migrations
├── public/                  # Static assets
├── netlify.toml             # Netlify configuration
├── drizzle.config.ts        # Drizzle ORM config
├── package.json
└── ...config files
```

---

## External Service Dependencies

| Service | Purpose | Status |
|---------|---------|--------|
| **Turso** | SQLite database | Config ready, needs credentials |
| **Netlify** | Hosting + serverless | Config ready |
| **Browserless** | Screenshot API | Not integrated |
| **AWS S3** | Screenshot storage | Not integrated |
| **Algolia** | Full-text search | Not integrated |

---

## Known Issues & Technical Debt

### Issues
1. **No UI implemented** - App.tsx still shows Vite template
2. **No Netlify functions** - Backend processing not created
3. **Missing dependencies** - Cheerio, AWS SDK, etc. not installed

### Technical Debt
1. **VITE_ prefix on server env vars** - Should use server-side env vars for Netlify functions (no VITE_ prefix needed)
2. **Client-side DB access** - Current db/index.ts uses VITE_ prefix, but DB should only be accessed server-side
3. **Missing indexes** - May need additional indexes for search performance

---

## Design Principles

1. **Accessibility First** - WCAG compliance required
2. **Semantic HTML** - Proper element usage
3. **Web Components Preference** - React enhances, doesn't replace
4. **Pure CSS** - No CSS frameworks
5. **Progressive Enhancement** - Works without JS where possible
6. **Curly Braces Always** - Code style enforcement

---

## Environment Variables Required

```env
# Database
VITE_TURSO_DATABASE_URL=libsql://...
VITE_TURSO_AUTH_TOKEN=...

# Search
VITE_ALGOLIA_APP_ID=...
VITE_ALGOLIA_SEARCH_API_KEY=...
VITE_ALGOLIA_ADMIN_API_KEY=...

# Screenshots
VITE_BROWSERLESS_API_KEY=...

# Image Storage
VITE_AWS_ACCESS_KEY_ID=...
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_AWS_REGION=...
VITE_AWS_S3_BUCKET=...
```

---

## Development Commands

```bash
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests
npm run test:watch   # Watch mode tests
npm run lint         # ESLint
npm run lint:css     # Stylelint
npm run db:generate  # Generate Drizzle migrations
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio
```

---

## License

MIT License - Copyright (c) 2025 Schalk Neethling

